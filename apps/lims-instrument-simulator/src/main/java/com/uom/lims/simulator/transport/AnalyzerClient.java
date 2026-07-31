package com.uom.lims.simulator.transport;

import com.uom.lims.simulator.analyzer.AnalyzerProfile;
import com.uom.lims.simulator.analyzer.SimulatedSample;
import com.uom.lims.simulator.astm.AstmControl;
import com.uom.lims.simulator.astm.AstmFrame;
import com.uom.lims.simulator.astm.Lis2Records;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;

/**
 * Simulated analyzer acting as the ASTM <em>sender</em>: it connects to a host
 * (the LIS integration middleware, or the bundled {@link HostServer}) and
 * uploads patient results in broadcast mode using the full
 * ENQ → frames → EOT link protocol with per-frame ACK handling.
 */
public final class AnalyzerClient {

    private static final int ACK_TIMEOUT_MS = 15_000;
    private static final int MAX_RETRIES = 6;

    private final String host;
    private final int port;
    private final AnalyzerProfile profile;

    public AnalyzerClient(String host, int port, AnalyzerProfile profile) {
        this.host = host;
        this.port = port;
        this.profile = profile;
    }

    /** Transmit one batch of samples as a single ASTM message (H … L). */
    public void transmit(List<SimulatedSample> samples) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 10_000);
            socket.setSoTimeout(ACK_TIMEOUT_MS);
            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();

            log("connecting to host %s:%d as %s", host, port, profile.model());
            establishLink(in, out);

            int frame = 1;
            frame = sendRecord(in, out, frame, Lis2Records.header(profile.model(), "1.0"));

            int patientSeq = 1;
            for (SimulatedSample sample : samples) {
                frame = sendRecord(in, out, frame,
                        Lis2Records.patient(patientSeq, sample.patientId(),
                                sample.lastName(), sample.firstName(), sample.dob(), sample.sex()));
                frame = sendRecord(in, out, frame,
                        Lis2Records.order(1, sample.sampleId(), profile.panelCode(), profile.panelName(),
                                sample.priority(), profile.specimenType()));

                int resultSeq = 1;
                for (SimulatedSample.Measurement m : sample.measurements()) {
                    frame = sendRecord(in, out, frame,
                            Lis2Records.result(resultSeq++, m.analyte().deviceCode(), m.analyte().name(),
                                    m.analyte().format(m.value()), m.analyte().unit(),
                                    m.analyte().referenceRange(), m.flag(),
                                    profile.instrumentId(), profile.instrumentId()));
                }
                if (sample.hasCritical()) {
                    frame = sendRecord(in, out, frame, Lis2Records.comment(1,
                            "Critical value(s) present - LIS critical-value workflow expected"));
                }
                log("uploaded sample %s (%d results%s)", sample.sampleId(),
                        sample.measurements().size(), sample.hasCritical() ? ", CRITICAL" : "");
                patientSeq++;
            }

            sendRecord(in, out, frame, Lis2Records.terminator());
            releaseLink(out);
            log("transmission complete: %d sample(s)", samples.size());
        }
    }

    private void establishLink(InputStream in, OutputStream out) throws IOException {
        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            out.write(AstmControl.ENQ);
            out.flush();
            int reply = in.read();
            if (reply == AstmControl.ACK) {
                return;
            }
            if (reply == AstmControl.NAK || reply == -1) {
                sleep(500);
                continue;
            }
            // Contention (host also sent ENQ): back off and retry.
            sleep(1000);
        }
        throw new IOException("Host did not ACK link establishment");
    }

    /** Send one record (chunked into frames) and require an ACK for each frame. */
    private int sendRecord(InputStream in, OutputStream out, int frame, String record) throws IOException {
        List<String> chunks = AstmFrame.chunk(record);
        for (int i = 0; i < chunks.size(); i++) {
            boolean last = (i == chunks.size() - 1);
            byte[] bytes = AstmFrame.encode(frame, chunks.get(i), last);

            int retries = 0;
            while (true) {
                out.write(bytes);
                out.flush();
                int reply = in.read();
                if (reply == AstmControl.ACK) {
                    break;
                }
                if (reply == AstmControl.NAK && retries++ < MAX_RETRIES) {
                    sleep(300);
                    continue;
                }
                throw new IOException("Frame " + frame + " not acknowledged (reply="
                        + AstmControl.name((byte) reply) + ")");
            }
            frame = (frame + 1) % 8;
        }
        return frame;
    }

    private void releaseLink(OutputStream out) throws IOException {
        out.write(AstmControl.EOT);
        out.flush();
    }

    /** Convenience: generate {@code count} samples and transmit them as one batch. */
    public static List<SimulatedSample> collect(
            com.uom.lims.simulator.analyzer.WorkloadGenerator generator,
            AnalyzerProfile profile, int count) {
        List<SimulatedSample> samples = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            samples.add(generator.next(profile));
        }
        return samples;
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void log(String fmt, Object... args) {
        System.out.printf("[analyzer] " + fmt + "%n", args);
    }
}
