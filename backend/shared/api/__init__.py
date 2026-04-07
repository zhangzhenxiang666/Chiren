from shared.api.client import AnthropicApiClient
from shared.api.errors import ChirenApiError
from shared.api.openai_client import OpenAICompatibleClient
from shared.api.usage import UsageSnapshot

__all__ = [
    "AnthropicApiClient",
    "OpenAICompatibleClient",
    "ChirenApiError",
    "UsageSnapshot",
    "get_client",
]


from typing import Literal

from shared.api.client import SupportsStreamingMessages


def get_client(
    type: Literal["anthropic", "openai"], api_key: str, base_url: str
) -> SupportsStreamingMessages:
    if type == "openai":
        return OpenAICompatibleClient(api_key=api_key, base_url=base_url)
    elif type == "anthropic":
        return AnthropicApiClient(api_key=api_key, base_url=base_url)
