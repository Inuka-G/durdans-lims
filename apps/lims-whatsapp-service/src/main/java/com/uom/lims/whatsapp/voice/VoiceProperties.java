package com.uom.lims.whatsapp.voice;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Wiring between this service and the voice gateway. Both directions fail closed on a
 * blank token: call events are not forwarded, and the internal tool endpoints answer
 * 403 to everything — a half-configured voice deployment silently degrades to
 * text-only rather than exposing an unauthenticated surface.
 */
@ConfigurationProperties(prefix = "app.voice")
public record VoiceProperties(String gatewayUrl, String internalToken) {

    public VoiceProperties {
        gatewayUrl = (gatewayUrl == null || gatewayUrl.isBlank())
                ? "http://host-gateway:8085" : gatewayUrl.trim();
    }

    public boolean isConfigured() {
        return internalToken != null && !internalToken.isBlank();
    }
}
