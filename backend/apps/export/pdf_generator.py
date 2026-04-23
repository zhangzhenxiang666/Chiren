"""
使用 Playwright 的 PDF 生成器（异步）。
本模块提供了一个异步函数，用于使用 Chromium（通过 Playwright）将 HTML 内容渲染为 PDF。
该函数设计为按需、无状态执行，不依赖任何持久化的浏览器实例。
"""

import asyncio
import contextlib

from playwright.async_api import async_playwright

from apps.export.browser_manager import check_browser_ready


async def generate_pdf(html_content: str, timeout_ms: int = 30000) -> bytes:
    """使用 Playwright 将 HTML 内容生成为 PDF。
    此函数启动一个无头 Chromium 实例，加载提供的 HTML 内容，
    等待网络空闲，确保字体已加载（包括 CJK 字体），并以 A4 尺寸和无边距渲染 PDF。
    PDF 以原始字节形式返回，适用于流式传输或保存到磁盘。

    Args:
        html_content: 要渲染为 PDF 的 HTML 内容。
        timeout_ms: 操作允许的最大时间（毫秒）。
                    超时后将抛出 asyncio.TimeoutError。
    Returns:
        生成的 PDF 作为字节对象。
    """
    check_browser_ready()
    coro = _generate_pdf_internal(html_content)
    pdf_bytes = await asyncio.wait_for(coro, timeout=timeout_ms / 1000.0)
    return pdf_bytes


async def _generate_pdf_internal(html_content: str) -> bytes:
    browser = None
    page = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            # 设置视口为 A4 大致的 CSS 像素尺寸
            await page.set_viewport_size({"width": 794, "height": 1123})
            await page.set_content(html_content, wait_until="networkidle")
            # 等待字体就绪
            await page.evaluate("document.fonts.ready")
            # 小延迟以确保字体渲染（特别是 CJK 字体）
            await asyncio.sleep(0.2)
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            return pdf_bytes
    finally:
        # 关闭已创建的资源
        if page is not None:
            with contextlib.suppress(Exception):
                await page.close()
        if browser is not None:
            with contextlib.suppress(Exception):
                await browser.close()
