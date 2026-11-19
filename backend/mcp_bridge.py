"""Talks to Registro's MCP server (registro_mcp/) as one signed-in person.

Ask Registro runs Claude's tool calls itself: it lists the MCP server's tools to hand to Claude,
and when Claude picks one, calls it here with the person's own sign-in. The MCP server then calls
the Registro API, so every rule the website follows applies to the chat too.
"""
import asyncio
import os

MCP_URL = os.environ.get("REGISTRO_MCP_URL", "https://registro-mcp.vercel.app/mcp")


async def _with_session(token: str, work):
    from mcp import ClientSession
    from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

    async with create_mcp_http_client(headers={"Authorization": f"Bearer {token}"}) as http:
        async with streamable_http_client(MCP_URL, http_client=http) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await work(session)


def list_tools(token: str) -> list[dict]:
    """The MCP server's tools, in the shape the Messages API takes."""

    async def work(session):
        listed = await session.list_tools()
        return [
            {"name": tool.name, "description": tool.description or "", "input_schema": tool.input_schema}
            for tool in listed.tools
        ]

    return asyncio.run(_with_session(token, work))


def call_tools(token: str, calls: list[tuple[str, dict]]) -> list[tuple[list[str], bool]]:
    """Run each (tool name, input) in order. Returns each result's text parts and whether it failed."""

    async def work(session):
        results = []
        for name, arguments in calls:
            try:
                result = await session.call_tool(name, arguments)
            except Exception as error:  # A failed call is reported to Claude, not raised.
                results.append(([f"The tool failed: {error}"], True))
                continue
            texts = [part.text for part in result.content if getattr(part, "text", None)]
            results.append((texts, bool(result.is_error)))
        return results

    return asyncio.run(_with_session(token, work))
