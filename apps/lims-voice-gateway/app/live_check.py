"""What this key, model and API version will actually accept — asked once at
boot, instead of discovered by a caller.

The Live setup message is all-or-nothing. One field the server does not know —
``proactivity`` on ``v1beta``, say — and the entire session is refused with a
1007 close. Pipecat raises that inside its connection task, the pipeline keeps
running with no model attached, WhatsApp still reports the call as answered, and
the caller listens to a perfectly healthy silence. Every layer says OK and
nobody speaks. That is exactly how this broke in production on 2026-08-23.

So we ask first. At startup we open real sessions against the same model and API
version the calls will use: one plain baseline, then one per optional field. A
field the server refuses is switched off for the life of the process with a loud
log line, and calls go ahead without that flourish. If the baseline itself fails
we have learned nothing about the individual fields — the key, the model name or
the network is at fault — so we change nothing and say so.

The cost is four WebSocket handshakes and a couple of seconds of startup, inside
the container's 30 s health-check grace period.
"""

import asyncio
from dataclasses import dataclass, replace

from loguru import logger

from .config import settings

# One probe should never hold the boot open; the whole sweep is capped too.
_PER_PROBE_TIMEOUT = 4.0
_TOTAL_TIMEOUT = 12.0

# feature key -> the LiveCapabilities attribute it decides
_FEATURES = (
    ("affective", "affective_dialog"),
    ("proactive", "proactive_audio"),
    ("async_tools", "async_tools"),
)


@dataclass(frozen=True)
class LiveCapabilities:
    """Which optional Live fields we may send. Defaults are optimistic on
    purpose: before the probe runs, the configured intent stands."""

    affective_dialog: bool = True
    proactive_audio: bool = True
    async_tools: bool = True
    # False means the sweep never got a verdict — either it could not run or the
    # baseline failed. The flags above are then just what config asked for.
    probed: bool = False


_current = LiveCapabilities()


def current() -> LiveCapabilities:
    """What bot.py should send on the next call."""
    return _current


async def _default_connect(model: str, api_version: str, feature: str | None) -> None:
    """Open one real Live session with a single optional field under test.

    Raises whatever the API raises; returning normally means the server accepted
    the setup. Imports live in here so the module stays importable — and
    testable — without the Google SDK.
    """
    from google import genai
    from google.genai import types

    extra: dict = {}
    if feature == "affective":
        extra["enable_affective_dialog"] = True
    elif feature == "proactive":
        extra["proactivity"] = types.ProactivityConfig(proactive_audio=True)
    elif feature == "async_tools":
        # The one property under test is behavior=NON_BLOCKING; the rest of the
        # declaration is filler shaped like our real tools.
        extra["tools"] = [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="probe",
                        description="Capability probe.",
                        behavior="NON_BLOCKING",
                        parameters=types.Schema(
                            type="OBJECT",
                            properties={"query": types.Schema(type="STRING")},
                            required=["query"],
                        ),
                    )
                ]
            )
        ]

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(api_version=api_version) if api_version else None,
    )
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction="Capability probe. Say nothing.",
        **extra,
    )
    async with client.aio.live.connect(model=model, config=config):
        # Reaching the body means setupComplete came back: the server took it.
        return


async def probe_live_capabilities(
    *,
    model: str,
    api_version: str,
    want: LiveCapabilities,
    connect=_default_connect,
) -> LiveCapabilities:
    """Resolve `want` against what the server will actually accept."""

    async def attempt(feature: str | None) -> tuple[bool, str]:
        try:
            await asyncio.wait_for(connect(model, api_version, feature), timeout=_PER_PROBE_TIMEOUT)
            return True, ""
        except Exception as exc:  # noqa: BLE001 — any failure is a "no" for this field
            return False, str(exc)[:200].replace("\n", " ")

    ok, error = await attempt(None)
    if not ok:
        # The plain session failed, so a refused optional field is not what we
        # are looking at. Say so and leave the configuration alone rather than
        # switching off features over a network blip.
        logger.error(
            "Gemini Live baseline probe FAILED (model={} api_version={}): {} — "
            "leaving optional features as configured; calls may not work.",
            model, api_version or "default", error,
        )
        return replace(want, probed=False)

    resolved = want
    for feature, attribute in _FEATURES:
        if not getattr(want, attribute):
            continue  # not asked for; nothing to verify
        ok, error = await attempt(feature)
        if ok:
            continue
        logger.warning(
            "Gemini Live refused '{}' (model={} api_version={}): {} — disabling it for "
            "this process. Calls continue without it.",
            feature, model, api_version or "default", error,
        )
        resolved = replace(resolved, **{attribute: False})

    return replace(resolved, probed=True)


async def refresh() -> LiveCapabilities:
    """Run the sweep and publish the result. Never raises: a probe that cannot
    run must not stop the service from answering calls."""
    global _current

    want = LiveCapabilities(
        affective_dialog=settings.affective_dialog,
        proactive_audio=settings.proactive_audio,
        async_tools=settings.async_tools,
    )
    model = settings.resolved_model()
    api_version = settings.resolved_api_version()
    try:
        _current = await asyncio.wait_for(
            probe_live_capabilities(model=model, api_version=api_version, want=want),
            timeout=_TOTAL_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini Live capability probe did not complete ({}); using configuration as written.", exc)
        _current = replace(want, probed=False)

    logger.info(
        "Gemini Live resolved: model={} api_version={} voice={} affective={} proactive={} async_tools={} probed={}",
        model, api_version or "default", settings.gemini_voice,
        _current.affective_dialog, _current.proactive_audio, _current.async_tools, _current.probed,
    )
    return _current
