import asyncio
import json

from prompt_toolkit import PromptSession
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.patch_stdout import patch_stdout
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table

from apps.resume_assistant.schemas import ResumeAssistantRequest
from apps.resume_assistant.service import generate_content

# --- 初始化 Rich Console ---
console = Console()

# --- 配置区 ---
BASE_URL = "http://127.0.0.1:5564/anthropic"
API_KEY = "any-key"
MODEL = "an-minimax@minimax-m2.7"
RESUME_ID = "35242f8b-2ea2-4607-8038-5c2cd057e26f"

SECTIONS: list[dict] = [
    {
        "id": "ae6b2c85-a093-415a-8a47-47ac5dba5fee",
        "resume_id": RESUME_ID,
        "type": "personal_info",
        "title": "个人信息",
        "content": {},
    },
    {
        "id": "5a79c9c4-e8ad-494e-a471-76d3ada55ec1",
        "resume_id": RESUME_ID,
        "type": "summary",
        "title": "个人简介",
        "content": {"text": ""},
    },
    {
        "id": "4f4eb8be-7bff-4fbb-bc5e-69217fd87838",
        "resume_id": RESUME_ID,
        "type": "work_experience",
        "title": "工作经历",
        "content": {"items": []},
    },
    {
        "id": "fdd57768-1fa2-4ff0-9bff-8c237b25dded",
        "resume_id": RESUME_ID,
        "type": "education",
        "title": "教育背景",
        "content": {"items": []},
    },
    {
        "id": "b3c1d2e3-f4a5-6789-abcd-ef0123456789",
        "resume_id": RESUME_ID,
        "type": "projects",
        "title": "项目经历",
        "content": {"items": []},
    },
    {
        "id": "e279a487-2825-486c-97cc-2a2d3e9a1fcf",
        "resume_id": RESUME_ID,
        "type": "skills",
        "title": "技能特长",
        "content": {"categories": []},
    },
]

ID_TO_TYPE: dict[str, str] = {s["id"]: s["type"] for s in SECTIONS}


async def read_user_input(session: PromptSession) -> str:
    prompt_msg = HTML("<ansigreen><b>➤ User</b></ansigreen> (Alt+Enter 发送): \n")
    try:
        with patch_stdout():
            user_text = await session.prompt_async(prompt_msg, multiline=True)
            return user_text.strip()
    except (EOFError, KeyboardInterrupt):
        return ""


async def run_turn(
    user_input: str,
    sections: list[dict],
    id_to_type: dict[str, str],
) -> None:
    request = ResumeAssistantRequest(
        base_url=BASE_URL,
        api_key=API_KEY,
        model=MODEL,
        type="anthropic",
        input=user_input,
        resume_id=RESUME_ID,
    )

    loop_count = 0

    try:
        async for event in generate_content(request, sections, id_to_type):
            etype = event.get("event")
            data = json.loads(event.get("data", "{}"))

            if etype == "next":
                loop_count += 1

            elif etype == "thinking_start":
                console.rule(f"[bold yellow]Thinking Loop {loop_count}")

            elif etype == "thinking_delta":
                console.print(data.get("text", ""), end="", style="italic dim white")

            elif etype == "text_start":
                console.print("\n")
                console.rule("[bold blue]Assistant Response")

            elif etype == "text_delta":
                console.print(data.get("text", ""), end="", style="bold cyan")

            elif etype == "tool_use":
                name, args = data["name"], data["input"]
                console.print(
                    Panel(
                        f"[bold magenta]Call:[/bold magenta] {name}\n[bold white]Args:[/bold white] {args}",
                        title="[bold yellow]Tool Request",
                        border_style="yellow",
                        expand=False,
                    )
                )

            elif etype == "tool_result":
                success = not data.get("is_error")

                if success:
                    console.print(
                        Panel(
                            data["content"],
                            title=f"[bold green]✓ Tool Success[/bold green] [dim]({data['tool_use_id'][:8]})[/dim]",
                            border_style="green",
                            expand=False,
                        )
                    )
                else:
                    console.print(
                        Panel(
                            data["content"],
                            title=f"[bold red]✗ Tool Error[/bold red] [dim]({data['tool_use_id'][:8]})[/dim]",
                            border_style="red",
                            expand=False,
                        )
                    )

            elif etype == "done":
                console.print("\n")
                return

            elif etype == "error":
                console.print(
                    Panel(
                        data.get("message", "Unknown"),
                        title="Error",
                        border_style="red",
                    )
                )
                return

    except Exception as e:
        console.print_exception()


def print_resume_state(sections: list[dict]) -> None:
    """使用表格美化简历数据展示"""
    table = Table(
        title="\n[bold underline]RESUME REAL-TIME DATA[/]", show_lines=True, expand=True
    )
    table.add_column("Section", style="cyan", width=15)
    table.add_column("Content (JSON/Text)", style="white")

    for s in sections:
        content = s.get("content", {})
        # 判断是否有内容
        has_data = (
            any(v for v in content.values())
            if isinstance(content, dict)
            else bool(content)
        )

        if not has_data:
            content_display = "[dim italic]Empty[/dim italic]"
        else:
            json_str = json.dumps(content, indent=2, ensure_ascii=False)
            content_display = Syntax(
                json_str, "json", theme="monokai", background_color="default"
            )

        table.add_row(f"{s['title']}\n[dim]({s['type']})[/]", content_display)

    console.print(table)


async def main() -> None:
    console.print(
        Panel.fit(
            "[bold green]Resume Agent Tester[/bold green]\n[dim]Multi-Tool / Agentic Loop Support[/dim]",
            border_style="green",
        )
    )

    session = PromptSession()

    while True:
        user_input = await read_user_input(session)
        if not user_input:
            if console.input("[bold yellow]退出测试? (y/n): [/]").lower() == "y":
                break
            continue

        await run_turn(user_input, SECTIONS, ID_TO_TYPE)
        print_resume_state(SECTIONS)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[bold red]Exit.[/]")
