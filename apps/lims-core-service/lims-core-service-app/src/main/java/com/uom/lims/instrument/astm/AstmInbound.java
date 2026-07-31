package com.uom.lims.instrument.astm;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Receiver side of the ASTM E1381 link protocol: runs the ENQ/ACK handshake,
 * validates each frame's checksum, reassembles records and returns them on EOT.
 *
 * <p>This is the same wire protocol the bundled analyzer simulator
 * (lims-instrument-simulator) and real analyzers speak, so the same ingestion
 * path serves both.
 */
public final class AstmInbound {

    public static final byte ENQ = 0x05;
    public static final byte ACK = 0x06;
    public static final byte NAK = 0x15;
    public static final byte EOT = 0x04;
    public static final byte STX = 0x02;
    public static final byte ETB = 0x17;
    public static final byte ETX = 0x03;
    public static final byte CR = 0x0D;
    public static final byte LF = 0x0A;

    private AstmInbound() {
    }

    /** Modulo-256 checksum over frame-number + text + terminator, two uppercase hex chars. */
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

    /**
     * Run one ASTM session and return the reassembled records (H/P/O/R/C/L lines).
     * Blocks until EOT or end-of-stream.
     */
    /** Abort the session after this many consecutive NAKs to avoid an unbounded NAK/retransmit loop. */
    public static final int MAX_CONSECUTIVE_NAKS = 6;

    public static List<String> receive(InputStream in, OutputStream out) throws IOException {
        List<String> records = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int consecutiveNaks = 0;

        int b;
        while ((b = in.read()) != -1) {
            if (b == ENQ) {
                out.write(ACK);
                out.flush();
            } else if (b == EOT) {
                break;
            } else if (b == STX) {
                Frame frame = readFrame(in);
                if (frame == null) {
                    break; // end of stream mid-frame
                }
                if (!frame.checksumValid) {
                    out.write(NAK);
                    out.flush();
                    if (++consecutiveNaks >= MAX_CONSECUTIVE_NAKS) {
                        break; // peer keeps sending corrupt frames — give up
                    }
                    continue;
                }
                consecutiveNaks = 0;
                current.append(frame.text);
                if (frame.last) {
                    records.add(current.toString());
                    current.setLength(0);
                }
                out.write(ACK);
                out.flush();
            }
            // other control bytes: ignore (link idle)
        }
        return records;
    }

    private record Frame(String text, boolean last, boolean checksumValid) {
    }

    /** Reads a frame body after STX has already been consumed. */
    private static Frame readFrame(InputStream in) throws IOException {
        int fnByte = in.read();
        if (fnByte == -1) {
            return null;
        }
        char fn = (char) fnByte;
        ByteArrayOutputStream text = new ByteArrayOutputStream();
        byte terminator = 0;
        while (true) {
            int c = in.read();
            if (c == -1) {
                return null;
            }
            if (c == ETB || c == ETX) {
                terminator = (byte) c;
                break;
            }
            text.write(c);
        }
        int c1 = in.read();
        int c2 = in.read();
        int cr = in.read();
        int lf = in.read();
        if (c1 == -1 || c2 == -1 || cr == -1 || lf == -1) {
            return null; // truncated tail — treat as end of stream
        }
        String received = "" + (char) c1 + (char) c2;
        String body = text.toString(StandardCharsets.US_ASCII);
        String expected = checksum(fn, body, terminator);
        boolean valid = expected.equalsIgnoreCase(received) && cr == CR && lf == LF;
        return new Frame(body, terminator == ETX, valid);
    }
}
