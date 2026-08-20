"""The voice channel's tools — thin HTTP calls into lims-whatsapp-service's
internal tool layer.

No business logic lives here on purpose (design principle: rules live next to
the data, in one tool layer both channels share). Each handler returns the
pre-rendered spoken strings that layer composed; on a native-audio path there
is no draft to inspect, so price grounding is structural — the model relays a
sentence it did not write.

The caller's WhatsApp number is bound into the order-status tool AT REGISTRATION,
from the call event — the model's arguments cannot influence whose order is
looked up.
"""

from typing import Any

import aiohttp
from loguru import logger

from .config import settings

_TIMEOUT = aiohttp.ClientTimeout(total=8)


async def _post(session: aiohttp.ClientSession, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.tools_base_url}/internal/voice/tools/{path}"
    try:
        async with session.post(
            url,
            json=payload,
            timeout=_TIMEOUT,
            headers={"X-Internal-Token": settings.internal_token},
        ) as response:
            if response.status != 200:
                logger.warning("Tool {} returned {}", path, response.status)
                return {"error": "lookup failed"}
            return await response.json()
    except Exception as exc:  # noqa: BLE001 — a tool failure must become words, not a crash
        logger.warning("Tool {} failed: {}", path, exc)
        return {"error": "lookup failed"}


def build_tool_handlers(session: aiohttp.ClientSession, caller_wa_id: str):
    """Returns {function_name: async handler} with the caller's identity closed over."""

    async def search_tests(params) -> None:
        args = params.arguments or {}
        result = await _post(session, "search-tests", {
            "query": args.get("query", ""),
            "locale": args.get("locale"),
        })
        await params.result_callback(result)

    async def list_packages(params) -> None:
        args = params.arguments or {}
        result = await _post(session, "list-packages", {"locale": args.get("locale")})
        await params.result_callback(result)

    async def get_order_status(params) -> None:
        args = params.arguments or {}
        result = await _post(session, "order-status", {
            "orderNo": args.get("orderNo", ""),
            # Server-side identity: the number that is actually on the call.
            "callerWaId": caller_wa_id,
        })
        await params.result_callback(result)

    return {
        "search_tests": search_tests,
        "list_packages": list_packages,
        "get_order_status": get_order_status,
    }


def tool_definitions():
    """Function schemas for Gemini Live. Note get_order_status takes only the
    order number — the phone is not a parameter the model can supply."""
    from pipecat.adapters.schemas.function_schema import FunctionSchema
    from pipecat.adapters.schemas.tools_schema import ToolsSchema

    search = FunctionSchema(
        name="search_tests",
        description=(
            "Search the laboratory test catalogue by name in any language "
            "(FBC, sugar test, HbA1c). Returns spoken sentences with the price, "
            "turnaround and fasting rules to read back to the caller."
        ),
        properties={
            "query": {"type": "string", "description": "What the caller called the test"},
            "locale": {"type": "string", "description": "Caller's language: si, ta or en"},
        },
        required=["query"],
    )
    packages = FunctionSchema(
        name="list_packages",
        description="List the laboratory's health packages with prices and savings, as spoken sentences.",
        properties={
            "locale": {"type": "string", "description": "Caller's language: si, ta or en"},
        },
        required=[],
    )
    order_status = FunctionSchema(
        name="get_order_status",
        description=(
            "Check how far a laboratory order has progressed and whether the report "
            "is ready. Needs the order number from the caller's receipt, like "
            "ORD-20260820-000123. Identity is verified automatically against the "
            "number the caller is calling from."
        ),
        properties={
            "orderNo": {"type": "string", "description": "The order number on the receipt"},
        },
        required=["orderNo"],
    )
    return ToolsSchema(standard_tools=[search, packages, order_status])
