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
