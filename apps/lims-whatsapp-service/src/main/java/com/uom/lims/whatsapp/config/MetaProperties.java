package com.uom.lims.whatsapp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Meta / WhatsApp Cloud API credentials and endpoints.
 *
 * <p>Every value is externalized. Defaults are empty rather than placeholder strings
 * on purpose: an empty {@code appSecret} makes {@link com.uom.lims.whatsapp.webhook.MetaSignatureVerifier}
 * reject every webhook, so a misconfigured deployment refuses traffic instead of
 * accepting unverified traffic. Fail closed, the same way the report dispatcher does
 * for an unconfigured channel.
 */
@ConfigurationProperties(prefix = "app.meta")
public record MetaProperties(
        String appId,
        String appSecret,
        String verifyToken,
        String phoneNumberId,
        String businessAccountId,
        String accessToken,
        String graphBaseUrl,
        String graphVersion) {

    public MetaProperties {
        graphBaseUrl = (graphBaseUrl == null || graphBaseUrl.isBlank())
                ? "https://graph.facebook.com" : graphBaseUrl.trim();
        graphVersion = (graphVersion == null || graphVersion.isBlank())
                ? "v26.0" : graphVersion.trim();
    }

    /** Base for phone-number-scoped calls: {@code /{version}/{phone-number-id}}. */
    public String phoneNumberEndpoint() {
        return graphBaseUrl + "/" + graphVersion + "/" + phoneNumberId;
    }

    public boolean isSignatureVerificationConfigured() {
        return appSecret != null && !appSecret.isBlank();
    }

    public boolean isSubscriptionConfigured() {
        return verifyToken != null && !verifyToken.isBlank();
    }

    /**
     * Whether outbound sends can be attempted at all. Same fail-closed posture as the
     * webhook: with no access token or phone number id, the send path refuses locally
     * instead of letting the Graph API reject a half-configured call.
     */
    public boolean isSendConfigured() {
        return accessToken != null && !accessToken.isBlank()
                && phoneNumberId != null && !phoneNumberId.isBlank();
    }
}
