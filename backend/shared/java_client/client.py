"""Java 后端 HTTP 客户端封装。"""

import httpx

from shared.exceptions.base import JavaClientError


class JavaClient:
    """Java 后端通信客户端（双向调用）。"""

    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
            )
        return self._client

    async def close(self) -> None:
        """关闭 HTTP 客户端。"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def post(
        self,
        path: str,
        json: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """
        发送 POST 请求。

        Args:
            path: 相对路径。
            json: 请求体 JSON 数据。
            params: URL 查询参数。

        Returns:
            响应 JSON 数据。

        Raises:
            JavaClientError: 请求失败时抛出。
        """
        url = f"{self.base_url}{path}"
        try:
            client = await self._get_client()
            response = await client.post(url, json=json, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise JavaClientError(
                message=f"Java API 请求失败: {e.response.text}",
                status_code=e.response.status_code,
            )
        except httpx.RequestError as e:
            raise JavaClientError(message=f"Java API 请求异常: {str(e)}")

    async def get(self, path: str, params: dict | None = None) -> dict:
        """
        发送 GET 请求。

        Args:
            path: 相对路径。
            params: URL 查询参数。

        Returns:
            响应 JSON 数据。

        Raises:
            JavaClientError: 请求失败时抛出。
        """
        url = f"{self.base_url}{path}"
        try:
            client = await self._get_client()
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise JavaClientError(
                message=f"Java API 请求失败: {e.response.text}",
                status_code=e.response.status_code,
            )
        except httpx.RequestError as e:
            raise JavaClientError(message=f"Java API 请求异常: {str(e)}")
