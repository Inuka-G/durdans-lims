package com.uom.lims.whatsapp.reply;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * The first-touch acknowledgement. It exists so a patient who messages the lab tonight
 * gets an answer tonight, before the agent proper (phase 2) exists. The default text is
 * deliberately non-clinical and makes no promise beyond "received" — principle 1: the
 * bot never sends a clinical value, and this bot barely sends anything.
 */
@ConfigurationProperties(prefix = "app.auto-reply")
public record AutoReplyProperties(boolean enabled, Duration cooldown, String greeting) {

    static final String DEFAULT_GREETING = """
            ආයුබෝවන්! මෙය Durdans රසායනාගාරයේ ස්වයංක්‍රීය සේවාවයි. ඔබේ පණිවිඩය අපට ලැබුණා.

            Hello! This is the Durdans Laboratory automated assistant. Your message has been received.""";

    public AutoReplyProperties {
        cooldown = cooldown == null ? Duration.ofHours(1) : cooldown;
        greeting = (greeting == null || greeting.isBlank()) ? DEFAULT_GREETING : greeting;
    }
}
