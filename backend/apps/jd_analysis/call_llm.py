import json
from collections.abc import Callable

import json_repair
from pydantic import ValidationError

from apps.jd_analysis.prompt import (
    EXTRACTION_SYSTEM,
    SYSTEM,
    build_extraction_user_prompt,
    build_match_user_prompt,
    derive_requirements_summary,
)
from apps.jd_analysis.schemas import JdExtractionResult, MatchResult
from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
    SupportsStreamingMessages,
)
from shared.types.messages import ConversationMessage
from shared.types.resume import ResumeSectionSchema

MAX_RETRIES = 3


async def _stream_llm(
    client: SupportsStreamingMessages,
    model: str,
    system_prompt: str,
    messages: list[ConversationMessage],
) -> tuple[str, ApiMessageCompleteEvent | None]:
    accumulated_content = ""
    complete_event: ApiMessageCompleteEvent | None = None
    async for event in client.stream_message(
        ApiMessageRequest(
            model=model,
            messages=messages,
            system_prompt=system_prompt,
            temperature=0.0,
        )
    ):
        if isinstance(event, ApiTextDeltaEvent):
            if event.is_think:
                continue
            accumulated_content += event.text
        elif isinstance(event, ApiMessageCompleteEvent):
            complete_event = event
    return accumulated_content, complete_event


async def _call_with_retry[T](
    client: SupportsStreamingMessages,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema_class: type[T],
    post_validator: Callable[[T], str | None] | None = None,
) -> T:
    messages = [ConversationMessage.from_user_text(user_prompt)]

    for i in range(MAX_RETRIES):
        accumulated_content, complete_event = await _stream_llm(
            client, model, system_prompt, messages
        )

        parsed = json_repair.loads(accumulated_content)

        try:
            result = schema_class.model_validate(parsed)
        except ValidationError as e:
            if i == MAX_RETRIES - 1:
                raise e
            errors = []
            for err in e.errors():
                field = ".".join(str(loc) for loc in err["loc"])
                errors.append(f"  - {field}: {err['msg']}")
            error_msg = "Validation failed:\n" + "\n".join(errors)
            messages.append(complete_event.message)
            messages.append(ConversationMessage.from_user_text(error_msg))
            continue
        except Exception:
            raise

        if post_validator:
            error = post_validator(result)
            if error:
                if i == MAX_RETRIES - 1:
                    raise ValueError(error)
                messages.append(complete_event.message)
                messages.append(ConversationMessage.from_user_text(error))
                continue

        return result

    raise Exception("Max retries exceeded")


def _make_section_id_validator(
    sections: list[ResumeSectionSchema],
) -> Callable[[MatchResult], str | None]:
    valid_section_ids = {s.id for s in sections}

    def validator(result: MatchResult) -> str | None:
        invalid_section_ids = [
            s.section_id
            for s in result.suggestions
            if s.section_id not in valid_section_ids
        ]
        if invalid_section_ids:
            return (
                f"Validation failed:\n"
                f"  - suggestions: invalid sectionId {invalid_section_ids}, "
                f"valid sectionId are: {list(valid_section_ids)}"
            )
        return None

    return validator


async def executor_llm(
    client: SupportsStreamingMessages,
    model: str,
    sections: list[ResumeSectionSchema],
    job_description: str,
    job_title: str | None = None,
) -> tuple[MatchResult, JdExtractionResult]:
    extraction_system = EXTRACTION_SYSTEM.format(
        json_schema=json.dumps(
            JdExtractionResult.model_json_schema(),
            indent=2,
            ensure_ascii=False,
        )
    )
    extraction_prompt = build_extraction_user_prompt(job_description, job_title)
    extraction = await _call_with_retry(
        client, model, extraction_system, extraction_prompt, JdExtractionResult
    )

    requirements_content = derive_requirements_summary(extraction)

    match_system = SYSTEM.format(
        requirements=requirements_content,
        json_schema=json.dumps(
            MatchResult.model_json_schema(),
            indent=2,
            ensure_ascii=False,
        ),
    )
    match_prompt = build_match_user_prompt(sections, job_description, job_title)
    result = await _call_with_retry(
        client,
        model,
        match_system,
        match_prompt,
        MatchResult,
        post_validator=_make_section_id_validator(sections),
    )

    return result, extraction
