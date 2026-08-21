"""Ingress for call events.

This service is NOT on the public internet: lims-whatsapp-service owns the one
public webhook, verifies Meta's HMAC there, and forwards deliveries whose field
is "calls" to this endpoint over the host's loopback/compose boundary, carrying
a shared internal token. Pipecat's WhatsAppClient then runs the whole SDP dance
(answer, pre_accept, accept) and hands us a connected WebRTC session per call.
"""

import asyncio
import json
import hmac
from contextlib import asynccontextmanager

import aiohttp
from fastapi import FastAPI, Request, Response
from loguru import logger

from pipecat.transports.whatsapp.api import WhatsAppWebhookRequest
from pipecat.transports.whatsapp.client import WhatsAppClient

from .bot import run_bot
from .config import settings

_client: WhatsAppClient | None = None
_session: aiohttp.ClientSession | None = None
_call_tasks: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _client, _session
    _session = aiohttp.ClientSession()
    _client = WhatsAppClient(
        whatsapp_token=settings.whatsapp_token,
        phone_number_id=settings.phone_number_id,
        whatsapp_secret=settings.whatsapp_secret,
        session=_session,
    )
    logger.info("Voice gateway up (calls configured: {})", settings.calls_configured())
    try:
        yield
    finally:
        try:
            await _client.terminate_all_calls()
        except Exception:  # noqa: BLE001 — shutdown must not hang on a half-dead call
            logger.exception("Terminating calls on shutdown failed")
        await _session.close()


app = FastAPI(lifespan=lifespan)


def _authorized(request: Request) -> bool:
    # Fail closed: no configured token means no caller is ever authorized.
    provided = request.headers.get("X-Internal-Token", "")
    return bool(settings.internal_token) and hmac.compare_digest(provided, settings.internal_token)


@app.get("/health")
async def health():
    return {"status": "ok", "callsConfigured": settings.calls_configured()}


@app.post("/internal/calls/webhook")
async def calls_webhook(request: Request):
    if not _authorized(request):
        return Response(status_code=403)
    if not settings.calls_configured():
        logger.warning("Call event received but calling is not configured; ignoring")
        return {"handled": False}

    # Raw bytes, not request.json(): the WhatsApp client re-verifies Meta's HMAC over
    # the exact bytes, and the ingress forwards the signature header for that purpose.
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    webhook = WhatsAppWebhookRequest.model_validate(json.loads(raw_body))

    async def on_call(connection, call):
        caller = _caller_of(call)
        task = asyncio.create_task(run_bot(connection, caller))
        _call_tasks.add(task)
        task.add_done_callback(_call_tasks.discard)

    # Verified once at the public ingress, and again here against the app secret:
    # the hop across the host boundary is token-guarded, but a second HMAC check is
    # free and removes a trust assumption.
    handled = await _client.handle_webhook_request(
        webhook,
        connection_callback=on_call,
        raw_body=raw_body,
        sha256_signature=signature,
    )
    return {"handled": bool(handled)}


def _caller_of(call) -> str:
    """The caller's WhatsApp id off the connect event, defensively: this string
    becomes the order-status possession check, so absent beats wrong."""
    for attribute in ("from_", "from_user", "caller", "user"):
        value = getattr(call, attribute, None)
        if isinstance(value, str) and value:
            return value
    value = getattr(call, "from_", None)
    return str(value) if value else ""
