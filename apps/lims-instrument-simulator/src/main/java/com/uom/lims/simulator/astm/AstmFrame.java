package com.uom.lims.simulator.astm;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Encodes ASTM records into wire frames and decodes frames back into text.
 *
 * <p>One record is normally one frame. Records longer than
 * {@link AstmControl#MAX_FRAME_TEXT} are split across several intermediate
 * (ETB) frames followed by a final (ETX) frame, all sharing the rolling frame
 * number sequence.
 */
public final class AstmFrame {

    private AstmFrame() {
    }

    /**
     * Build the on-wire bytes for one frame.
     *
     * @param frameNumber 0-7
     * @param text        record text (already &lt;= MAX_FRAME_TEXT)
     * @param last        true to terminate with ETX (final), false for ETB
     */
    public static byte[] encode(int frameNumber, String text, boolean last) {
        char fn = (char) ('0' + (frameNumber % 8));
        byte terminator = last ? AstmControl.ETX : AstmControl.ETB;
        String checksum = AstmControl.checksum(fn, text, terminator);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(AstmControl.STX);
        out.write((byte) fn);
        byte[] textBytes = text.getBytes(StandardCharsets.US_ASCII);
        out.write(textBytes, 0, textBytes.length);
        out.write(terminator);
        byte[] csBytes = checksum.getBytes(StandardCharsets.US_ASCII);
        out.write(csBytes, 0, csBytes.length);
        out.write(AstmControl.CR);
        out.write(AstmControl.LF);
        return out.toByteArray();
    }

    /**
     * Split a single record into the frame payloads it must be sent as.
     * Most records fit in one frame; this keeps long records standards-compliant.
     */
    public static List<String> chunk(String record) {
        List<String> chunks = new ArrayList<>();
        if (record.length() <= AstmControl.MAX_FRAME_TEXT) {
            chunks.add(record);
            return chunks;
        }
        for (int i = 0; i < record.length(); i += AstmControl.MAX_FRAME_TEXT) {
            chunks.add(record.substring(i, Math.min(record.length(), i + AstmControl.MAX_FRAME_TEXT)));
        }
        return chunks;
    }

    /** Result of reading one frame off the wire. */
    public record Decoded(int frameNumber, String text, boolean last, boolean checksumValid) {
    }

    /**
     * Read a single frame starting at STX from the stream and validate its
     * checksum. Assumes the caller has already consumed any control byte (ENQ,
     * EOT) and that the next byte is STX.
     *
     * @return the decoded frame, or {@code null} on end-of-stream
     */
    public static Decoded readFrame(InputStream in) throws IOException {
        int b = in.read();
        if (b == -1) {
            return null;
        }
        if (b != AstmControl.STX) {
            // Not a frame start; surface it so the session loop can react.
            throw new IOException("Expected STX, got " + AstmControl.name((byte) b));
        }
        int fnByte = in.read();
        char fn = (char) fnByte;

        ByteArrayOutputStream text = new ByteArrayOutputStream();
        byte terminator = 0;
        while (true) {
            int c = in.read();
            if (c == -1) {
                throw new IOException("Stream ended mid-frame");
            }
            if (c == AstmControl.ETB || c == AstmControl.ETX) {
                terminator = (byte) c;
                break;
            }
            text.write(c);
        }
        // Two checksum hex chars, then CR LF.
        int c1 = in.read();
        int c2 = in.read();
        int cr = in.read();
        int lf = in.read();
        String received = "" + (char) c1 + (char) c2;

        String body = text.toString(StandardCharsets.US_ASCII);
        String expected = AstmControl.checksum(fn, body, terminator);
        boolean valid = expected.equalsIgnoreCase(received)
                && cr == AstmControl.CR && lf == AstmControl.LF;

        return new Decoded(fn - '0', body, terminator == AstmControl.ETX, valid);
    }
}
