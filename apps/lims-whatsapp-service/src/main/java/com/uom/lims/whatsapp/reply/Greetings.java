package com.uom.lims.whatsapp.reply;

import java.util.Locale;
import java.util.Set;

/**
 * Recognizes a bare greeting — the messages that mean "I'm here, what can you do" and
 * deserve the menu, not a model call. Deliberately a closed list plus trivial
 * normalization rather than anything clever: a false negative costs one Gemini call,
 * a false positive swallows a real question, so this errs heavily toward negative.
 */
final class Greetings {

    private static final Set<String> BARE_GREETINGS = Set.of(
            "hi", "hii", "hiii", "hey", "heyy", "hello", "helo", "hallo", "halo",
            "good morning", "good evening", "good afternoon", "good night",
            "ayubowan", "ayubuwan", "ආයුබෝවන්", "හායි", "හලෝ",
            "vanakkam", "வணக்கம்",
            "menu", "start", "help");

    private Greetings() {
    }

    static boolean isBareGreeting(String body) {
        if (body == null) {
            return false;
        }
        String normalized = body.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[!.,?\\s]+$", "")
                .replaceAll("\\s+", " ");
        return BARE_GREETINGS.contains(normalized);
    }
}
