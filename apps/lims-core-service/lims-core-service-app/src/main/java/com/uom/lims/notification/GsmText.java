package com.uom.lims.notification;

/**
 * Keeps an outbound SMS inside the GSM-7 alphabet wherever a simple stand-in exists.
 *
 * <p>One character outside GSM-7 flips the whole message to UCS-2, which drops the
 * per-segment budget from 160 characters to 70 - so a single em dash in a heading can
 * silently cut a report message to a third of its length. The characters mapped here are
 * exactly the ones that reach us by accident: dashes and quotes pasted from a document,
 * a bullet in a test name, a non-breaking space from a copied phone number.
 *
 * <p>Anything not listed is left alone. This normalizes typography, it does not strip
 * content - a name that genuinely needs UCS-2 still gets sent as UCS-2.
 */
final class GsmText {

    private GsmText() {
    }

    static String sanitize(String message) {
        if (message == null || message.isEmpty()) {
            return message;
        }
        return message
                // Line endings: one form, so a CR never reaches the gateway as a stray character.
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                // Dashes.
                .replace('—', '-')   // em dash
                .replace('–', '-')   // en dash
                .replace('−', '-')   // minus sign
                // Quotes and apostrophes.
                .replace('‘', '\'')  // left single quote
                .replace('’', '\'')  // right single quote
                .replace('“', '"')   // left double quote
                .replace('”', '"')   // right double quote
                // Spaces and separators.
                .replace(' ', ' ')   // non-breaking space
                .replace('•', '-')   // bullet
                .replace('·', '-')   // middle dot
                // Ellipsis is three characters in GSM-7, but three that exist.
                .replace("…", "...");
    }
}
