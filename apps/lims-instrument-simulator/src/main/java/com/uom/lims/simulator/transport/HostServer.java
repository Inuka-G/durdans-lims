package com.uom.lims.simulator.transport;

import com.uom.lims.simulator.astm.AstmControl;
import com.uom.lims.simulator.astm.AstmFrame;
import com.uom.lims.simulator.astm.Lis2Records;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Minimal ASTM <em>receiver</em> ("host"). Accepts analyzer connections, runs
 * the ENQ/ACK link protocol, validates each frame's checksum, reassembles the
 * records and prints a decoded transcript.
 *
 * <p>This is a stand-in for the LIS Instrument-Integration middleware so the
 * simulator can be demonstrated end-to-end with no other component running. In
 * production this role is played by the middleware, which instead of printing
 * would map device codes to LIS tests (via the analyte LOINC), persist the raw
 * message for traceability, and publish an {@code INSTRUMENT_RESULT_RECEIVED}
 * event through the transactional outbox into the Results &amp; QC context.
 */
public final class HostServer {

    private final int port;

    public HostServer(int port) {
        this.port = port;
    }

    public void listen() throws IOException {
        try (ServerSocket server = new ServerSocket(port)) {
            log("listening on port %d (Ctrl+C to stop)", port);
            while (true) {
                Socket socket = server.accept();
                // One analyzer at a time is realistic for a serial-style link;
                // handle sequentially for a clear transcript.
                try (socket) {
                    handle(socket);
                } catch (IOException e) {
                    log("session error: %s", e.getMessage());
                }
            }
        }
    }

    private void handle(Socket socket) throws IOException {
        InputStream in = socket.getInputStream();
        OutputStream out = socket.getOutputStream();
        log("analyzer connected from %s", socket.getRemoteSocketAddress());

        StringBuilder record = new StringBuilder();
        int messages = 0;

        while (true) {
            int control = in.read();
            if (control == -1) {
                break;
            }
            if (control == AstmControl.ENQ) {
                out.write(AstmControl.ACK);
                out.flush();
                continue;
            }
            if (control == AstmControl.EOT) {
                log("end of transmission");
                messages++;
                continue;
            }
            if (control == AstmControl.STX) {
                AstmFrame.Decoded frame = readFrameFrom(control, in);
                if (frame == null) {
                    break;
                }
                if (!frame.checksumValid()) {
                    log("checksum error on frame %d -> NAK", frame.frameNumber());
                    out.write(AstmControl.NAK);
                    out.flush();
                    continue;
                }
                record.append(frame.text());
                if (frame.last()) {
                    System.out.println("           " + Lis2Records.describe(record.toString()));
                    record.setLength(0);
                }
                out.write(AstmControl.ACK);
                out.flush();
            }
            // Any other control byte is ignored (link idle).
        }
        log("analyzer disconnected (%d message(s) received)", messages);
    }

    /**
     * The shared {@link AstmFrame#readFrame} expects to consume STX itself, but
     * we have already read it to dispatch on control bytes, so re-feed it via a
     * tiny pushback wrapper.
     */
    private AstmFrame.Decoded readFrameFrom(int firstByte, InputStream in) throws IOException {
        InputStream pushback = new InputStream() {
            private boolean consumed = false;

            @Override
            public int read() throws IOException {
                if (!consumed) {
                    consumed = true;
                    return firstByte;
                }
                return in.read();
            }
        };
        return AstmFrame.readFrame(pushback);
    }

    private static void log(String fmt, Object... args) {
        System.out.printf("[host]     " + fmt + "%n", args);
    }
}
