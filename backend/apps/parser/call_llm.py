import json

import json_repair
from pydantic import ValidationError

from apps.parser.prompt import CONTENT, SYSTEM
from apps.parser.schemas import ParserResult
from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
    SupportsStreamingMessages,
)
from shared.types.messages import ConversationMessage

MAX_RETRIES = 3


async def executor_llm(
    client: SupportsStreamingMessages, model: str, content: str
) -> ParserResult:
    accumulated_content = ""
    messages = [ConversationMessage.from_user_text(CONTENT.format(content=content))]
    system_prompt = SYSTEM.format(
        json_schema=json.dumps(
            ParserResult.model_json_schema(),
            indent=2,
            ensure_ascii=False,
        )
    )

    for i in range(MAX_RETRIES):
        complete_event: ApiMessageCompleteEvent | None = None
        async for event in client.stream_message(
            ApiMessageRequest(
                model=model, messages=messages, system_prompt=system_prompt
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
            result = ParserResult.model_validate(parser_content)
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
        return result

    raise Exception("Max retries exceeded")
