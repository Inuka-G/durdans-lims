"""One Pipecat pipeline per answered call: WhatsApp audio in, Gemini Live native
audio out, tools over HTTP to the shared policy layer. No transcription hop and
no synthesis hop — the model hears Opus-decoded audio and speaks back.

Carries no business logic. The strongest statement this file makes is the choice
of register and turn-taking; what the agent is allowed to SAY about a price or a
report still comes from a tool sentence it did not compose (see prompt.py).

Written against pipecat-ai 1.7: GeminiLiveLLMService plus the universal
LLMContext / LLMContextAggregatorPair (the pair auto-detects a realtime service).
"""

import asyncio

import aiohttp
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import Frame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService, GeminiVADParams
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from . import live_check
from .config import settings
from .language import call_locale
from .prompt import build_system_prompt, opening_instruction
from .tools import build_tool_handlers, fetch_caller_profile, save_call_memory, tool_definitions

try:  # 1.x: "run inference on the current context" is an explicit frame.
    from pipecat.frames.frames import LLMRunFrame
except ImportError:  # pragma: no cover - older line
    LLMRunFrame = None


class CallTranscript(FrameProcessor):
    """Watches the caller's transcribed turns go by so the call can be remembered
    in the language it happened in.

    Gemini Live pushes user transcriptions UPSTREAM, so this sits directly after
    the transport input, where those frames pass on their way back out. It only
    reads; every frame is forwarded untouched.
    """

    def __init__(self) -> None:
        super().__init__()
        self.utterances: list[str] = []

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            text = (frame.text or "").strip()
            if text:
                self.utterances.append(text)
        await self.push_frame(frame, direction)


def _sensitivity(enum_cls, prefix: str, value: str):
    """Map a HIGH/LOW env string onto a google-genai sensitivity enum.

    Deliberately forgiving: a mistyped environment variable should cost us the
    tuning, not the call.
    """
    name = f"{prefix}_{value.strip().upper()}"
    member = getattr(enum_cls, name, None)
    if member is None and value.strip():
        logger.warning("Unknown VAD sensitivity {!r}; leaving Google's default", value)
    return member


def _vad_params() -> GeminiVADParams | None:
    """Gemini's own server-side VAD, which is what decides turn-taking on this path.

    Google's defaults are tuned for a headset in a quiet room. A Sinhala speaker on
    a phone pauses mid-sentence more often than the American English these were set
    against, so the end-of-speech threshold is the knob worth moving: too short and
    the agent talks over people, which is the single most robotic thing it can do.
    """
    from google.genai.types import EndSensitivity, StartSensitivity

    params = GeminiVADParams()
    touched = False
    if settings.vad_start_sensitivity:
        member = _sensitivity(StartSensitivity, "START_SENSITIVITY", settings.vad_start_sensitivity)
        if member is not None:
            params.start_sensitivity = member
            touched = True
    if settings.vad_end_sensitivity:
        member = _sensitivity(EndSensitivity, "END_SENSITIVITY", settings.vad_end_sensitivity)
        if member is not None:
            params.end_sensitivity = member
            touched = True
    if settings.vad_prefix_padding_ms is not None:
        params.prefix_padding_ms = settings.vad_prefix_padding_ms
        touched = True
    if settings.vad_silence_duration_ms is not None:
        params.silence_duration_ms = settings.vad_silence_duration_ms
        touched = True
    return params if touched else None


def _llm_settings(system_instruction: str, caps):
    """The delta we apply over Pipecat's defaults.

    Only fields set here move. The optional native-audio fields are sent only if
    config asked for them AND the boot-time probe saw the server accept them —
    an unsupported field does not degrade the session, it destroys it.
    """
    kwargs = {
        "model": settings.resolved_model(),
        "voice": settings.gemini_voice,
        "system_instruction": system_instruction,
    }
    if settings.affective_dialog and caps.affective_dialog:
        # What lets the reply to a worried caller sound different from the reply
        # to a cheerful one. v1alpha only — see Settings.resolved_api_version().
        kwargs["enable_affective_dialog"] = True
    if settings.proactive_audio and caps.proactive_audio:
        from google.genai.types import ProactivityConfig

        kwargs["proactivity"] = ProactivityConfig(proactive_audio=True)
    vad = _vad_params()
    if vad is not None:
        kwargs["vad"] = vad
    return GeminiLiveLLMService.Settings(**kwargs)


def _http_options():
    """Pinned only when we need a non-default API surface, so the SDK keeps its
    own default everywhere else."""
    api_version = settings.resolved_api_version()
    if not api_version:
        return None
    from google.genai.types import HttpOptions

    return HttpOptions(api_version=api_version)


async def run_bot(connection, caller_wa_id: str) -> None:
    """Owns the whole life of one call; returns when the call ends."""
    logger.info("Starting voice pipeline for caller ending {}", caller_wa_id[-4:] if caller_wa_id else "????")

    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            # Kept alongside Gemini's server-side VAD on purpose: Gemini signals
            # barge-in but emits no turn-start/-end frames, so the context
            # aggregator needs a local VAD to track turns. Turn-taking *timing*
            # is tuned on the Gemini side, in _vad_params().
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    async with aiohttp.ClientSession() as tool_session:
        # Best effort, bounded: a known caller gets greeted by name and in the
        # language they last used. The lookup must never delay the opening line.
        profile = await fetch_caller_profile(tool_session, caller_wa_id)
        display_name = str(profile.get("displayName") or "").strip()

        caps = live_check.current()
        llm = GeminiLiveLLMService(
            api_key=settings.gemini_api_key,
            settings=_llm_settings(build_system_prompt(
                settings.agent_name_si, settings.agent_name_en, profile,
            ), caps),
            tools=tool_definitions(),
            http_options=_http_options(),
        )

        topics: list[str] = []
        for name, handler in build_tool_handlers(tool_session, caller_wa_id, topics).items():
            # cancel_on_interruption=False marks the tool asynchronous, which is
            # what makes Pipecat declare it NON_BLOCKING to Gemini: the model
            # keeps the conversation going ("ටිකක් ඉන්න, බලන්නම්") while the
            # lookup is in flight instead of leaving the line silent for a
            # second or two. Dead air is the tell that gives a bot away.
            llm.register_function(
                name, handler,
                cancel_on_interruption=not (settings.async_tools and caps.async_tools),
            )

        context = LLMContext(
            messages=[{
                "role": "user",
                "content": opening_instruction(settings.agent_name_si, display_name),
            }],
        )
        context_aggregator = LLMContextAggregatorPair(context)
        transcript = CallTranscript()

        pipeline = Pipeline([
            transport.input(),
            transcript,
            context_aggregator.user(),
            llm,
            transport.output(),
            context_aggregator.assistant(),
        ])

        task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

        @transport.event_handler("on_client_connected")
        async def on_client_connected(_transport, _client):
            # Let the Gemini Live handshake settle before the opening turn. In the
            # first live calls the run frame landed mid-setup and the caller heard
            # silence until they spoke; a short beat is what makes "speak first" true.
            await asyncio.sleep(settings.greeting_delay_secs)
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

        # The call is over; leave one line behind for the next one. Topics only —
        # nothing the caller said is stored. A caller who never spoke gets no
        # language recorded either: silence is not evidence of Sinhala, and a
        # guess here would overwrite what they actually typed to us last time.
        if topics:
            await save_call_memory(
                tool_session, caller_wa_id,
                summary=", ".join(topics[:3])[:180],
                locale=call_locale(transcript.utterances) if transcript.utterances else "",
            )

    logger.info("Voice pipeline finished")
