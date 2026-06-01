from anthropic import AsyncAnthropic
from app.core.config import settings
from typing import AsyncIterator

client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def invoke_llm(
    messages: list[dict],
    system: str | None = None,
    max_tokens: int = 8192,
    tools: list[dict] | None = None,
    stream: bool = False,
) -> str:
    kwargs = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools

    response = await client.messages.create(**kwargs)
    return response.content[0].text


async def invoke_llm_json(
    messages: list[dict],
    system: str | None = None,
    max_tokens: int = 8192,
) -> dict:
    import json
    system_json = (system or "") + "\n\nResponda SOMENTE com JSON válido, sem texto extra, sem markdown."
    text = await invoke_llm(messages=messages, system=system_json, max_tokens=max_tokens)
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


async def stream_llm(
    messages: list[dict],
    system: str | None = None,
    max_tokens: int = 8192,
) -> AsyncIterator[str]:
    kwargs = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    async with client.messages.stream(**kwargs) as stream:
        async for text in stream.text_stream:
            yield text
