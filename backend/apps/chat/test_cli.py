"""
交互式 CLI 测试脚本，用于测试 generate_content 异步生成器（多轮对话 + 流式输出）。

messages_history 同步策略：
- tool_call / tool_result 事件交错出现（每个工具一对）
- 必须保证写入顺序：assistant(with tool_calls) → tool → tool → ... → assistant(最终回复)
- 因此用"轮次缓冲"：在下一个 next 或 done 时批量将上一轮数据写入 messages_history
"""

import asyncio
import json

from apps.chat.schemas import ChatRequest, Message, ToolCall
from apps.chat.service import generate_content

BASE_URL = "http://127.0.0.1:5564/openai"
API_KEY = "any-key"
MODEL = "qwen-code@coder-model"
RESUME_ID = "35242f8b-2ea2-4607-8038-5c2cd057e26f"

SECTIONS: list[dict] = [
    {
        "id": "ae6b2c85-a093-415a-8a47-47ac5dba5fee",
        "resume_id": RESUME_ID,
        "type": "personal_info",
        "title": "个人信息",
        "sort_order": 0,
        "visible": True,
        "content": {
            "full_name": "",
            "job_title": "",
            "phone": "",
            "email": "",
            "salary": "",
            "location": "",
            "age": "",
            "gender": "",
            "political_status": "",
            "education_level": "",
        },
        "created_at": "2026-04-04T08:42:28.000Z",
        "updated_at": "2026-04-04T08:42:28.000Z",
    },
    {
        "id": "5a79c9c4-e8ad-494e-a471-76d3ada55ec1",
        "resume_id": RESUME_ID,
        "type": "summary",
        "title": "个人简介",
        "sort_order": 1,
        "visible": True,
        "content": {"text": ""},
        "created_at": "2026-04-04T08:42:28.000Z",
        "updated_at": "2026-04-04T08:42:28.000Z",
    },
    {
        "id": "4f4eb8be-7bff-4fbb-bc5e-69217fd87838",
        "resume_id": RESUME_ID,
        "type": "work_experience",
        "title": "工作经历",
        "sort_order": 2,
        "visible": True,
        "content": {"items": []},
        "created_at": "2026-04-04T08:42:28.000Z",
        "updated_at": "2026-04-04T08:42:28.000Z",
    },
    {
        "id": "fdd57768-1fa2-4ff0-9bff-8c237b25dded",
        "resume_id": RESUME_ID,
        "type": "education",
        "title": "教育背景",
        "sort_order": 3,
        "visible": True,
        "content": {"items": []},
        "created_at": "2026-04-04T08:42:28.000Z",
        "updated_at": "2026-04-04T08:42:28.000Z",
    },
    {
        "id": "b3c1d2e3-f4a5-6789-abcd-ef0123456789",
        "resume_id": RESUME_ID,
        "type": "projects",
        "title": "项目经历",
        "sort_order": 4,
        "visible": True,
        "content": {"items": []},
        "created_at": "2026-04-04T08:42:28.000Z",
        "updated_at": "2026-04-04T08:42:28.000Z",
    },
    {
        "id": "e279a487-2825-486c-97cc-2a2d3e9a1fcf",
        "resume_id": RESUME_ID,
        "type": "skills",
        "title": "技能特长",
        "sort_order": 5,
        "visible": True,
        "content": {"categories": []},
        "created_at": "2026-04-04T08:42:28.000Z",
        "updated_at": "2026-04-04T08:42:28.000Z",
    },
]

ID_TO_TYPE: dict[str, str] = {s["id"]: s["type"] for s in SECTIONS}

W = 60


def _header(label: str) -> None:
    print(f"\n{'=' * W}")
    print(label)
    print("=" * W)


def _footer() -> None:
    print("=" * W)


def read_user_input() -> str:
    _header("input  (回车换行，空行发送；直接空行退出)")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line == "" and not lines:
            return ""
        if line == "":
            break
        lines.append(line)
    user_text = "\n".join(lines)

    _header("user")
    print(user_text)
    _footer()
    return user_text


async def run_turn(
    messages_history: list[Message],
    sections: list[dict],
    id_to_type: dict[str, str],
) -> None:
    request = ChatRequest(
        base_url=BASE_URL,
        api_key=API_KEY,
        model=MODEL,
        type="openai",
        messages=messages_history,
        resume_id=RESUME_ID,
    )

    # ── 轮次缓冲 ─────────────────────────────────────────────────────────
    # tool_call 和 tool_result 交错出现，必须等整轮结束后按正确顺序写入
    # messages_history：assistant(with all tool_calls) → tool → tool → ...
    #
    # 缓冲结构：
    #   round_content    : 本轮 text_delta 累积（assistant 正文）
    #   round_tool_calls : 本轮所有 tool_call 事件数据（合并成一条 assistant msg）
    #   round_tool_msgs  : 本轮成功的 tool_result（每个对应一条 tool msg）
    round_content: list[str] = []
    round_tool_calls: list[dict] = []  # [{tool_call_id, name, arguments}, ...]
    round_tool_msgs: list[dict] = []  # [{tool_call_id, content}, ...]  仅成功

    def flush_round_to_history() -> None:
        """将上一轮缓冲的 assistant + tool 消息按正确顺序写入 messages_history。"""
        if not round_tool_calls:
            return
        # 1. assistant 消息（含所有 tool_calls + 可能有的正文）
        messages_history.append(
            Message(
                role="assistant",
                content="".join(round_content) or None,
                tool_calls=[
                    ToolCall(
                        id=tc["tool_call_id"],
                        name=tc["name"],
                        arguments=tc["arguments"],
                    )
                    for tc in round_tool_calls
                ],
            )
        )
        # 2. 每个成功 tool 调用的结果消息
        for tm in round_tool_msgs:
            messages_history.append(
                Message(
                    role="tool",
                    tool_call_id=tm["tool_call_id"],
                    content=tm["content"],
                )
            )

    loop_index = 0
    in_thinking = False
    in_content = False

    async for event in generate_content(request, sections, id_to_type):
        event_type: str = event.get("event") or event.get("type", "")
        raw_data: str = event.get("data", "{}")

        # ── 新一轮 agentic loop ───────────────────────────────────────
        if event_type == "next":
            # 将上一轮缓冲写入历史（首轮时缓冲为空，flush 是空操作）
            flush_round_to_history()
            # 重置轮次缓冲
            round_content.clear()
            round_tool_calls.clear()
            round_tool_msgs.clear()

            loop_index += 1
            in_thinking = False
            in_content = False

        # ── 思考块 ────────────────────────────────────────────────────
        elif event_type == "thinking_start":
            _header(f"thinking  (loop {loop_index})")
            in_thinking = True

        elif event_type == "thinking_delta":
            data = json.loads(raw_data)
            print(data.get("text", ""), end="", flush=True)

        # ── 正文块 ────────────────────────────────────────────────────
        elif event_type == "text_start":
            if in_thinking:
                print()
                _footer()
                in_thinking = False
            _header(f"assistant content  (loop {loop_index})")
            in_content = True

        elif event_type == "text_delta":
            data = json.loads(raw_data)
            text = data.get("text", "")
            round_content.append(text)
            print(text, end="", flush=True)

        # ── 工具调用请求 ──────────────────────────────────────────────
        elif event_type == "tool_call":
            if in_content:
                print()
                _footer()
                in_content = False
            data = json.loads(raw_data)
            tid = data.get("tool_call_id", "?")
            name = data.get("name", "?")
            args = data.get("arguments", "")
            # 缓冲，等整轮结束后统一写入
            round_tool_calls.append(
                {
                    "tool_call_id": tid,
                    "name": name,
                    "arguments": args,
                }
            )
            _header(f"tool call  [{name}]  [{tid[:16]}]")
            try:
                parsed = json.loads(args)
                print(json.dumps(parsed, ensure_ascii=False, indent=2))
            except Exception:
                print(args)
            _footer()

        # ── 工具调用结果 ──────────────────────────────────────────────
        elif event_type == "tool_result":
            data = json.loads(raw_data)
            tid = data.get("tool_call_id", "?")
            _header(f"tool result  [{tid[:16]}]")
            if data.get("success"):
                print("✓ 成功")
                # 缓冲成功的 tool 消息
                round_tool_msgs.append(
                    {
                        "tool_call_id": tid,
                        "content": json.dumps({"success": True}),
                    }
                )
            else:
                print(f"✗ 失败: {data.get('error', '未知错误')}")
            _footer()

        # ── 完成 ──────────────────────────────────────────────────────
        elif event_type == "done":
            if in_thinking:
                print()
                _footer()
            if in_content:
                print()
                _footer()
            # 最终轮是纯文本回复（无 tool_calls），直接写入
            messages_history.append(
                Message(
                    role="assistant",
                    content="".join(round_content) or None,
                )
            )

        # ── 错误 ──────────────────────────────────────────────────────
        elif event_type == "error":
            if in_thinking or in_content:
                print()
                _footer()
            data = json.loads(raw_data)
            _header("error")
            print(data.get("message", "未知错误"))
            _footer()
            break


def _is_empty(value) -> bool:
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return all(_is_empty(v) for v in value.values())
    return not value


def _print_sections(sections: list[dict]) -> None:
    _header("sections")
    for s in sections:
        content = s.get("content", {})
        if _is_empty(content):
            print(f"[{s['type']}]  (空)")
        else:
            pretty = json.dumps(content, ensure_ascii=False, indent=2)
            indented = "\n".join("  " + line for line in pretty.splitlines())
            print(f"[{s['type']}]")
            print(indented)
    _footer()


async def main() -> None:
    print("=" * W)
    print("  Resume Agent — 交互式 CLI 测试")
    print("=" * W)

    messages_history: list[Message] = []

    while True:
        user_input = read_user_input()
        if not user_input.strip():
            print("已退出。")
            break

        messages_history.append(Message(role="user", content=user_input))
        await run_turn(messages_history, SECTIONS, ID_TO_TYPE)
        _print_sections(SECTIONS)


if __name__ == "__main__":
    asyncio.run(main())
