package com.uom.lims.simulator.astm;

import java.nio.charset.StandardCharsets;

/**
 * Low-level ASTM E1381 control characters, checksum and framing helpers.
 *
 * <p>This is the transport ("link") layer used by the vast majority of clinical
 * analyzers (Sysmex, Mindray, Roche Cobas, Beckman, etc.) when they speak
 * ASTM E1394 / CLSI LIS2-A2. A frame on the wire looks like:
 *
 * <pre>
 *   &lt;STX&gt; FN text &lt;ETB|ETX&gt; C1 C2 &lt;CR&gt;&lt;LF&gt;
 * </pre>
 *
 * where {@code FN} is a single ASCII frame-number digit (0-7, wrapping), the
 * text is one ASTM record (or a chunk of one), {@code ETB} marks an
 * intermediate frame and {@code ETX} the final frame, and {@code C1 C2} is the
 * two-hex-digit checksum.
 */
public final class AstmControl {

    private AstmControl() {
    }

    /** Enquiry — sender requests the line. */
    public static final byte ENQ = 0x05;
    /** Acknowledge — receiver accepted the last frame / is ready. */
    public static final byte ACK = 0x06;
    /** Negative acknowledge — receiver rejected the frame (resend). */
    public static final byte NAK = 0x15;
    /** End of transmission — sender releases the line. */
    public static final byte EOT = 0x04;
    /** Start of text — begins a frame. */
    public static final byte STX = 0x02;
    /** End of transmission block — intermediate (non-final) frame terminator. */
    public static final byte ETB = 0x17;
    /** End of text — final frame terminator. */
    public static final byte ETX = 0x03;
    public static final byte CR = 0x0D;
    public static final byte LF = 0x0A;

    /** Maximum payload characters per frame per the standard (excludes control + checksum). */
    public static final int MAX_FRAME_TEXT = 240;

    /**
     * ASTM checksum: the modulo-256 sum of the byte values of the frame number,
     * the record text and the terminating ETB/ETX, expressed as two uppercase
     * hex characters. STX, the checksum itself and the trailing CR/LF are
     * excluded.
     *
     * @param frameNumber single digit 0-7
     * @param text        the record text carried by this frame
     * @param terminator  {@link #ETB} or {@link #ETX}
     * @return two-character uppercase hex checksum, e.g. {@code "3D"}
     */
    public static String checksum(char frameNumber, String text, byte terminator) {
        int sum = frameNumber;
        for (byte b : text.getBytes(StandardCharsets.US_ASCII)) {
            sum += (b & 0xFF);
        }
        sum += (terminator & 0xFF);
        sum &= 0xFF;
        String hex = Integer.toHexString(sum).toUpperCase();
        return hex.length() == 1 ? "0" + hex : hex;
    }

    public static String name(byte control) {
        return switch (control) {
            case ENQ -> "<ENQ>";
            case ACK -> "<ACK>";
            case NAK -> "<NAK>";
            case EOT -> "<EOT>";
            case STX -> "<STX>";
            case ETB -> "<ETB>";
            case ETX -> "<ETX>";
            case CR -> "<CR>";
            case LF -> "<LF>";
            default -> String.format("<0x%02X>", control);
        };
    }
}
