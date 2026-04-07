import asyncio
import json
import re
from collections import Counter

import json_repair
from pydantic import BaseModel, Field, ValidationError

from apps.resume_assistant.schemas import SECTION_TYPE_TO_MODEL
from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
    SupportsStreamingMessages,
)
from shared.types.base_tool import BaseTool, ToolExecutionContext, ToolResult
from shared.types.messages import ConversationMessage, TextBlock

_ID_FORMAT = re.compile(r"^[0-9a-f]{8}-\d{4}$")
_MAX_RETRIES = 5


def _collect_existing_ids(content: dict, section_type: str) -> set[str]:
    """Collect existing item/category IDs from original content."""
    if section_type in (
        "work_experience",
        "education",
        "projects",
        "certifications",
        "languages",
        "github",
        "custom",
    ):
        items = content.get("items", [])
        return {
            item["id"] for item in items if isinstance(item, dict) and item.get("id")
        }
    if section_type == "skills":
        categories = content.get("categories", [])
        return {
            cat["id"] for cat in categories if isinstance(cat, dict) and cat.get("id")
        }
    return set()


def _validate_item_ids(
    submitted_items: list[dict],
    existing_ids: set[str],
    item_type: str,
) -> list[str]:
    """
    Validate that all submitted items have IDs that exist in original content,
    and that no ID appears more than once.

    Returns:
        List of error messages (empty if valid).
    """
    errors = []
    submitted_ids = []

    for i, item in enumerate(submitted_items):
        if not isinstance(item, dict):
            continue

        item_id = item.get("id")
        field_path = f"{item_type}[{i}]"

        # Check for missing ID
        if not item_id:
            errors.append(
                f"  - {field_path}: missing 'id' field. "
                f"Each item must preserve its original ID from the source content."
            )
            continue

        # Check ID format
        if not _ID_FORMAT.match(item_id):
            errors.append(
                f"  - {field_path}.id '{item_id}': invalid format. "
                f"Expected 8-hex-4-digit pattern like 'a1b2c3d4-0001'."
            )
            continue

        # Check if ID exists in original content
        if item_id not in existing_ids:
            errors.append(
                f"  - {field_path}.id '{item_id}': not found in original content. "
                f"Each item must use the exact ID from the source. "
                f"Available IDs: {sorted(existing_ids)}"
            )
            continue

        submitted_ids.append(item_id)

    # Check for duplicate IDs
    duplicates = [id_ for id_, count in Counter(submitted_ids).items() if count > 1]
    if duplicates:
        errors.append(
            f"  - Duplicate IDs found: {duplicates}. "
            f"Each item ID must appear exactly once."
        )

    return errors


def validate_translated_content(
    content: dict,
    section_type: str,
    original_content: dict,
) -> tuple[bool, str | None]:
    """
    Validate translated content against Pydantic model and ID consistency.

    Returns:
        (is_valid, error_message)
    """
    model = SECTION_TYPE_TO_MODEL.get(section_type)
    if model is None:
        return False, f"Unknown section type: {section_type}"

    # Schema validation
    try:
        if section_type in ("personal_info", "summary"):
            model.model_validate(content)
        elif section_type in (
            "work_experience",
            "education",
            "projects",
            "certifications",
            "languages",
            "github",
            "custom",
        ):
            for item_data in content.get("items", []):
                model.model_validate(item_data)
        elif section_type == "skills":
            for category_data in content.get("categories", []):
                model.model_validate(category_data)
    except ValidationError as e:
        errors = []
        for err in e.errors():
            field = ".".join(str(loc) for loc in err["loc"])
            errors.append(f"  - {field}: {err['msg']}")
        return False, f"[{section_type}] Schema validation failed:\n" + "\n".join(
            errors
        )

    # ID validation for array sections
    existing_ids = _collect_existing_ids(original_content, section_type)

    if section_type in (
        "work_experience",
        "education",
        "projects",
        "certifications",
        "languages",
        "github",
        "custom",
    ):
        id_errors = _validate_item_ids(content.get("items", []), existing_ids, "items")
        if id_errors:
            return False, f"[{section_type}] ID validation failed:\n" + "\n".join(
                id_errors
            )

    elif section_type == "skills":
        id_errors = _validate_item_ids(
            content.get("categories", []), existing_ids, "categories"
        )
        if id_errors:
            return False, f"[{section_type}] ID validation failed:\n" + "\n".join(
                id_errors
            )

    return True, None


def _is_content_empty(content: dict, section_type: str) -> bool:
    """Check if section content is empty to avoid unnecessary translation token cost."""
    if not content:
        return True

    if section_type in ("personal_info", "summary"):
        return not any(content.values())

    if section_type in (
        "work_experience",
        "education",
        "projects",
        "certifications",
        "languages",
        "github",
        "custom",
    ):
        return not content.get("items")

    if section_type == "skills":
        return not content.get("categories")

    return False


def build_system_prompt(target_language: str) -> str:
    """Build system prompt with generic translation instructions."""
    return f"Translate resume content to {target_language}. Only translate text fields, keep JSON structure unchanged. Return JSON only."


def build_user_prompt(section: dict) -> str:
    """
    Build user prompt with section-specific content (title, content).

    Args:
        section: section dict with type, title, content
    """
    return f"""
**Section type**: {section["type"]}
**Original title**: {section["title"]}

**Content to translate**:
---
{json.dumps(section["content"], indent=2, ensure_ascii=False)}
---
"""


class TranslateResumeToolInput(BaseModel):
    target_language: str = Field(description="Target language code, e.g. zh, en")
    section_id: str | None = Field(
        default=None,
        description="Resume section ID to translate. Defaults to entire resume if omitted.",
    )


class TranslateResumeTool(BaseTool):
    name = "translate_resume"
    description = "Translate a resume (or a specific section) to the target language."
    input_model = TranslateResumeToolInput

    # TODO: 这里更新sections时要同步数据库, 以及更改里面的update_at字段
    async def execute(
        self, arguments: TranslateResumeToolInput, context: ToolExecutionContext
    ) -> ToolResult:
        id_to_type = context.metadata.get("id_to_type", {})
        if arguments.section_id is not None and arguments.section_id not in id_to_type:
            return ToolResult(
                output=f"Invalid section ID: {arguments.section_id}",
                is_error=True,
            )

        # 确定要翻译的 sections
        if arguments.section_id is not None:
            target_sections = [
                s for s in context.sections if s["id"] == arguments.section_id
            ]
        else:
            target_sections = list(context.sections)

        # 过滤出非空的 sections
        non_empty = []
        for section in target_sections:
            if not _is_content_empty(section.get("content", {}), section["type"]):
                non_empty.append(section)

        skipped = len(target_sections) - len(non_empty)

        # 并发翻译所有非空 section
        tasks = [
            _translate_single_section(
                section, arguments.target_language, context.metadata
            )
            for section in non_empty
        ]
        section_results = await asyncio.gather(*tasks)

        # 汇总结果
        success = sum(1 for r in section_results if r["success"])
        failed = len(section_results) - success

        lines = []
        for r in section_results:
            if r["success"]:
                lines.append(f"✓ {r['section_id']} ({r['section_type']})")
            else:
                lines.append(f"✗ {r['section_id']} ({r['section_type']}): {r['error']}")

        if skipped:
            lines.append(f"Skipped {skipped} empty section(s)")

        lines.append(
            f"\nTotal: {len(non_empty)} translated, {success} succeeded, {failed} failed"
        )

        return ToolResult(output="\n".join(lines))


# TODO: 在翻译成功时同步数据库
async def _attempt_translation(
    client: SupportsStreamingMessages,
    model: str,
    messages: list[ConversationMessage],
    system_prompt: str | None,
    section_type: str,
    original_content: dict,
) -> tuple[bool, str | None, str | None]:
    """
    执行单次翻译尝试。

    Returns:
        (success, content, error_message)
        - success=True: 翻译成功，content 为翻译后的内容
        - success=False: content=None, error_message 描述错误类型
    """
    accumulated_content = ""
    request = ApiMessageRequest(
        model=model,
        messages=messages,
        system_prompt=system_prompt,
    )

    try:
        async for event in client.stream_message(request):
            if isinstance(event, ApiTextDeltaEvent):
                if event.is_think:
                    continue
                accumulated_content += event.text
            elif isinstance(event, ApiMessageCompleteEvent):
                pass
    except Exception as e:
        return False, None, f"Stream error: {type(e).__name__}: {e}"

    if not accumulated_content:
        return False, None, "No content in response"

    content = accumulated_content

    try:
        translated_content = json_repair.loads(content)
    except Exception as e:
        return False, None, f"JSON parse error: {e}"

    is_valid, error_msg = validate_translated_content(
        translated_content, section_type, original_content
    )

    if is_valid:
        return True, translated_content, None

    return False, None, f"Translation validation failed:\n{error_msg}"


async def _translate_single_section(
    section: dict, target_language: str, metadata: dict
) -> dict:
    """
    翻译单个 section，包含重试逻辑。

    Returns:
        {"success": bool, "section_id": str, "section_type": str, "error": str | None}
    """
    section_id = section["id"]
    section_type = section["type"]
    original_content = section.get("content", {})
    error_message = ""

    client: SupportsStreamingMessages = metadata.get("client")
    model: str = metadata.get("model")

    system_prompt, user_prompt = build_translate_prompt(section, target_language)
    messages: list[ConversationMessage] = [
        ConversationMessage.from_user_text(user_prompt),
    ]

    for attempt in range(1, _MAX_RETRIES + 1):
        success, content, error_message = await _attempt_translation(
            client, model, messages, system_prompt, section_type, original_content
        )

        if success:
            section["content"] = content
            return {
                "success": True,
                "section_id": section_id,
                "section_type": section_type,
                "error": None,
            }

        # 非验证类错误，需要重试
        if "validation failed" not in error_message.lower():
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(0.5 * attempt)
            continue

        # 验证失败：追加错误信息到消息列表，让模型修正
        messages.append(
            ConversationMessage(role="assistant", content=[TextBlock(text=content)]),
        )
        messages.append(
            ConversationMessage.from_user_text(
                f"Invalid output. Please fix the errors and try again:\n{error_message}"
            ),
        )

    return {
        "success": False,
        "section_id": section_id,
        "section_type": section_type,
        "error": error_message,
    }


def build_translate_prompt(section: dict, target_language: str) -> tuple[str, str]:
    """
    构建单个 section 的翻译提示词。

    Returns:
        (system_prompt, user_prompt)
    """
    system_prompt = build_system_prompt(target_language)
    user_prompt = build_user_prompt(section)
    return system_prompt, user_prompt
