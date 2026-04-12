import json

import json_repair
from pydantic import ValidationError

from apps.jd_analysis.prompt import SYSTEM, build_user_prompt
from apps.jd_analysis.schemas import MatchResult
from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
    SupportsStreamingMessages,
)
from shared.types.messages import ConversationMessage
from shared.types.resume import ResumeSectionSchema

MAX_RETRIES = 3


async def executor_llm(
    client: SupportsStreamingMessages,
    model: str,
    sections: list[ResumeSectionSchema],
    job_description: str,
    job_title: str | None = None,
) -> MatchResult:
    accumulated_content = ""
    messages = [
        ConversationMessage.from_user_text(
            build_user_prompt(sections, job_description, job_title)
        )
    ]
    system_prompt = SYSTEM.format(
        json_schema=json.dumps(
            MatchResult.model_json_schema(),
            indent=2,
            ensure_ascii=False,
        )
    )

    for i in range(MAX_RETRIES):
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

        parser_content = json_repair.loads(accumulated_content)

        try:
            result = MatchResult.model_validate(parser_content)
        except ValidationError as e:
            if i == MAX_RETRIES - 1:
                raise e

            errors = []
            for err in e.errors():
                field = ".".join(str(loc) for loc in err["loc"])
                errors.append(f"  - {field}: {err['msg']}")
            error_msg = f"Validation failed:\n" + "\n".join(errors)

            messages.append(complete_event.message)
            messages.append(ConversationMessage.from_user_text(error_msg))
            continue
        except Exception as e:
            raise e

        # Validate section_id references in suggestions exist in provided sections
        valid_section_ids = {s.id for s in sections}
        invalid_section_ids = [
            s.section_id
            for s in result.suggestions
            if s.section_id not in valid_section_ids
        ]
        if invalid_section_ids:
            if i == MAX_RETRIES - 1:
                raise ValueError(
                    f"Invalid section_id: {invalid_section_ids}, "
                    f"these IDs do not exist in the provided sections"
                )
            error_msg = (
                "Validation failed:\n"
                f"  - suggestions: invalid section_id {invalid_section_ids}, "
                f"valid section_id are: {list(valid_section_ids)}"
            )
            messages.append(complete_event.message)
            messages.append(ConversationMessage.from_user_text(error_msg))
            continue

        return result

    raise Exception("Max retries exceeded")
