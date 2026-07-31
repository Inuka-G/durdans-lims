package com.uom.lims.instrument;

import com.uom.lims.instrument.astm.AstmInbound;
import com.uom.lims.instrument.astm.AstmMessage;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Listens for analyzer connections over TCP and drives ASTM result ingestion.
 *
 * <p>Disabled by default ({@code app.instrument.listener.enabled=false}) so it
 * does not bind a port during tests or in environments without an analyzer/
 * simulator. Enable it (and point the bundled simulator's {@code analyzer} mode
 * at this port) to demonstrate the full machine → middleware → LIMS loop.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.instrument.listener.enabled", havingValue = "true")
public class InstrumentTcpListener {

    @Value("${app.instrument.listener.port:12000}")
    private int port;

    @Value("${app.instrument.listener.instrument-id:ASTM-IN-01}")
    private String instrumentId;

    private final InstrumentResultIngestionService ingestionService;

    private static final int SESSION_READ_TIMEOUT_MS = 30_000;

    private volatile boolean running = false;
    private ServerSocket serverSocket;
    private final ExecutorService acceptor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "instrument-acceptor");
        t.setDaemon(true);
        return t;
    });
    // Sessions run on a bounded pool so one slow/hung analyzer can't block accepting others.
    private final ExecutorService workers = Executors.newFixedThreadPool(8, r -> {
        Thread t = new Thread(r, "instrument-worker");
        t.setDaemon(true);
        return t;
    });

    public InstrumentTcpListener(InstrumentResultIngestionService ingestionService) {
        this.ingestionService = ingestionService;
    }

    @PostConstruct
    public void start() {
        running = true;
        acceptor.submit(this::acceptLoop);
        log.info("Instrument ASTM listener starting on port {} (instrument {})", port, instrumentId);
    }

    private void acceptLoop() {
        try (ServerSocket server = new ServerSocket(port)) {
            this.serverSocket = server;
            while (running) {
                Socket socket = server.accept();
                socket.setSoTimeout(SESSION_READ_TIMEOUT_MS);
                workers.submit(() -> {
                    try (socket) {
                        handle(socket);
                    } catch (Exception e) {
                        log.warn("Instrument session error", e);
                    }
                });
            }
        } catch (Exception e) {
            if (running) {
                log.error("Instrument listener failed on port {}", port, e);
            }
        }
    }

    private void handle(Socket socket) throws Exception {
        log.info("Analyzer connected from {}", socket.getRemoteSocketAddress());
        InputStream in = socket.getInputStream();
        OutputStream out = socket.getOutputStream();
        List<String> records = AstmInbound.receive(in, out);
        for (AstmMessage.SpecimenResults specimen : AstmMessage.parse(records)) {
            InstrumentResultIngestionService.IngestOutcome outcome =
                    ingestionService.ingest(specimen, instrumentId);
            log.info("Ingested sample {}: {} result(s), {} unmatched",
                    outcome.sampleId(), outcome.ingested(), outcome.unmatched());
        }
    }

    @PreDestroy
    public void stop() {
        running = false;
        try {
            if (serverSocket != null) {
                serverSocket.close();
            }
        } catch (Exception ignored) {
            // closing on shutdown
        }
        acceptor.shutdownNow();
        workers.shutdownNow();
    }
}
