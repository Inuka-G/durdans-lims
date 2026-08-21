"""One Pipecat pipeline per answered call: WhatsApp audio in, Gemini Live native
audio out, tools over HTTP to the shared policy layer. No transcription hop and
no synthesis hop — the model hears Opus-decoded audio and speaks back.

Carries no business logic. The strongest statement this file makes is the system
prompt, and even that only tells the model to RELAY tool sentences, never to
compose a price.

Written against pipecat-ai 1.7: GeminiLiveLLMService plus the universal
LLMContext / LLMContextAggregatorPair (the pair auto-detects a realtime service)."""

import aiohttp
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from .config import settings
from .tools import build_tool_handlers, tool_definitions

try:  # 1.x: "run inference on the current context" is an explicit frame.
    from pipecat.frames.frames import LLMRunFrame
except ImportError:  # pragma: no cover - older line
    LLMRunFrame = None

VOICE_PROMPT = """\
You are the telephone assistant of Durdans Laboratory, a medical laboratory in
Colombo, Sri Lanka, answering a WhatsApp voice call.

Language: greet in Sinhala. If the caller speaks English or Tamil, switch to
their language immediately and stay in it. Speak naturally and briefly — one or
two short sentences at a time, as a person would on the phone. Never read out
markdown, symbols or URLs.

You can help with: test prices, health packages, fasting and preparation
instructions, whether a report is ready, and the laboratory's location and
hours (3 Alfred Place, Colombo 3, open daily 7 in the morning to 8 at night,
phone 011 5 410 000).

Hard rules, no exceptions:
- Prices, packages, preparation and report status MUST come from your tools.
  The tools return ready-made spoken sentences — read the one matching the
  caller's language out loud, and do not change any number in it.
- If a tool finds nothing, say so and suggest calling the laboratory desk.
- NEVER state test results, report values, reference ranges, or any medical
  advice. If asked, say reports are issued at the laboratory desk and that
  report delivery over WhatsApp is coming soon.
- For report status the caller must tell you the order number from their
  receipt. Their identity is checked automatically against the number they are
  calling from — if the check fails, ask them to visit the laboratory desk;
  never speculate about why it failed.
- Anything outside laboratory matters: politely say you can only help with the
  laboratory, and say goodbye warmly when the caller is done."""


async def run_bot(connection, caller_wa_id: str) -> None:
    """Owns the whole life of one call; returns when the call ends."""
    logger.info("Starting voice pipeline for caller ending {}", caller_wa_id[-4:] if caller_wa_id else "????")

    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    async with aiohttp.ClientSession() as tool_session:
        llm_kwargs = {
            "api_key": settings.gemini_api_key,
            "voice_id": settings.gemini_voice,
            "system_instruction": VOICE_PROMPT,
            "tools": tool_definitions(),
        }
        if settings.gemini_live_model:
            llm_kwargs["model"] = settings.gemini_live_model
        llm = GeminiLiveLLMService(**llm_kwargs)

        for name, handler in build_tool_handlers(tool_session, caller_wa_id).items():
            llm.register_function(name, handler)

        # The context opens with an instruction to greet, so the bot speaks first
        # — a silent line after the connect tone reads as a dead call. The service
        # runs inference on context initialization by default; the explicit run
        # frame on connect is belt-and-braces.
        context = LLMContext(
            messages=[{"role": "user", "content": "The call has just connected. Greet the caller in Sinhala and ask how you can help."}],
        )
        context_aggregator = LLMContextAggregatorPair(context)

        pipeline = Pipeline([
            transport.input(),
            context_aggregator.user(),
            llm,
            transport.output(),
            context_aggregator.assistant(),
        ])

        task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

        @transport.event_handler("on_client_connected")
        async def on_client_connected(_transport, _client):
            if LLMRunFrame is not None:
                await task.queue_frames([LLMRunFrame()])
            else:
                await context_aggregator.user().push_context_frame()

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(_transport, _client):
            logger.info("Caller disconnected; stopping pipeline")
            await task.cancel()

        runner = PipelineRunner(handle_sigint=False)
        await runner.run(task)

    logger.info("Voice pipeline finished")
