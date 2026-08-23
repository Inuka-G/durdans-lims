"""Environment-backed configuration.

Every value is externalized and the service fails closed without the ones that
matter: no Meta token means calls are never accepted, no internal token means the
webhook endpoint answers 403 to everything — the same posture the Java services
take with a blank app secret.
"""

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(name: str, default: bool) -> bool:
    raw = _env(name).lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _int_or_none(name: str) -> int | None:
    raw = _env(name)
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


@dataclass(frozen=True)
class Settings:
    whatsapp_token: str = field(default_factory=lambda: _env("WHATSAPP_TOKEN"))
    phone_number_id: str = field(default_factory=lambda: _env("WHATSAPP_PHONE_NUMBER_ID"))
    whatsapp_secret: str = field(default_factory=lambda: _env("WHATSAPP_APP_SECRET"))
    gemini_api_key: str = field(default_factory=lambda: _env("GEMINI_API_KEY"))
    # Empty means "use Pipecat's default Gemini Live model", which tracks the
    # current native-audio release better than a name pinned here would.
    gemini_live_model: str = field(default_factory=lambda: _env("GEMINI_LIVE_MODEL"))
    # Aoede, by the user's ear after hearing both on real calls; what was flat was
    # the prompt's register, not the voice. Tunable without a rebuild.
    gemini_voice: str = field(default_factory=lambda: _env("GEMINI_VOICE", "Aoede"))

    # The name the caller hears. A voice with a name is a person; "the assistant"
    # is a system. Kept in config so the lab can rename her without a rebuild.
    agent_name_si: str = field(default_factory=lambda: _env("AGENT_NAME_SI", "සමාලි"))
    agent_name_en: str = field(default_factory=lambda: _env("AGENT_NAME_EN", "Samali"))

    # Native-audio-only capabilities, both off by default in Pipecat. Affective
    # dialog is the one that makes the voice answer a worried caller differently
    # from a cheerful one; proactive audio lets the model decline to answer noise
    # it was never addressed with, instead of talking over a hallway.
    affective_dialog: bool = field(default_factory=lambda: _flag("GEMINI_AFFECTIVE_DIALOG", True))
    proactive_audio: bool = field(default_factory=lambda: _flag("GEMINI_PROACTIVE_AUDIO", True))

    # Gemini's own server-side VAD. Left unset these are Google's defaults, which
    # are tuned for a headset in a quiet room; a phone call in Sri Lanka is neither.
    # Empty env value = "leave Google's default alone".
    vad_start_sensitivity: str = field(default_factory=lambda: _env("VAD_START_SENSITIVITY"))
    vad_end_sensitivity: str = field(default_factory=lambda: _env("VAD_END_SENSITIVITY"))
    vad_prefix_padding_ms: int | None = field(default_factory=lambda: _int_or_none("VAD_PREFIX_PADDING_MS"))
    # How long a pause the caller gets before the model decides they are done.
    # 800 ms suits Sinhala phone speech, which pauses mid-sentence more than the
    # American English these defaults were set against. Explicit None-check, not
    # `or`: a configured 0 is a value, even if a strange one.
    vad_silence_duration_ms: int | None = field(
        default_factory=lambda: _int_or_none("VAD_SILENCE_DURATION_MS")
        if _env("VAD_SILENCE_DURATION_MS") else 800
    )

    # Tools run NON_BLOCKING so the model keeps talking while a lookup is in
    # flight instead of leaving the line silent. The trade is real: the model
    # speaks before the result lands, so it is filling rather than answering,
    # and only the prompt's never-invent rule keeps that filler honest. Turn
    # this off if a live call ever shows a price spoken ahead of the tool — and
    # note Gemini 3.x Flash Live does not support NON_BLOCKING at all, so pin
    # this to false alongside any GEMINI_LIVE_MODEL on that line.
    async_tools: bool = field(default_factory=lambda: _flag("VOICE_ASYNC_TOOLS", True))

    # The whatsapp-service tool layer, reached over loopback: this container runs
    # with host networking and the compose override publishes 11010 on 127.0.0.1.
    tools_base_url: str = field(default_factory=lambda: _env("TOOLS_BASE_URL", "http://127.0.0.1:11010"))
    internal_token: str = field(default_factory=lambda: _env("VOICE_INTERNAL_TOKEN"))
    # How long to let the Gemini Live handshake settle before the opening turn.
    # A run frame that lands mid-setup is an opener nobody hears.
    greeting_delay_secs: float = field(default_factory=lambda: float(_env("GREETING_DELAY_SECS", "1.2")))

    def calls_configured(self) -> bool:
        return bool(self.whatsapp_token and self.phone_number_id and self.gemini_api_key)


settings = Settings()
