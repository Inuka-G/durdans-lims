package com.uom.lims.simulator;

import com.uom.lims.simulator.analyzer.AnalyzerProfile;
import com.uom.lims.simulator.analyzer.SimulatedSample;
import com.uom.lims.simulator.analyzer.WorkloadGenerator;
import com.uom.lims.simulator.transport.AnalyzerClient;
import com.uom.lims.simulator.transport.HostServer;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

/**
 * Command-line entry point for the Durdans LIMS analyzer simulator.
 *
 * <p>Two roles:
 * <pre>
 *   host     - listen as the LIS host and print a decoded transcript (for testing)
 *   analyzer - act as an analyzer and upload dummy results to a host
 * </pre>
 *
 * Examples:
 * <pre>
 *   java com.uom.lims.simulator.SimulatorMain host --port 12000
 *   java com.uom.lims.simulator.SimulatorMain analyzer --host 127.0.0.1 --port 12000 \
 *        --profile hematology --count 5
 *   java com.uom.lims.simulator.SimulatorMain analyzer --profile chemistry \
 *        --count 3 --interval 30 --abnormal 0.3
 * </pre>
 */
public final class SimulatorMain {

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            printUsage();
            return;
        }
        String mode = args[0].toLowerCase();
        Map<String, String> opts = parseOptions(args);

        switch (mode) {
            case "host" -> runHost(opts);
            case "analyzer" -> runAnalyzer(opts);
            default -> {
                System.err.println("Unknown mode: " + mode);
                printUsage();
            }
        }
    }

    private static void runHost(Map<String, String> opts) throws Exception {
        int port = intOpt(opts, "port", 12000);
        new HostServer(port).listen();
    }

    private static void runAnalyzer(Map<String, String> opts) throws Exception {
        String host = opts.getOrDefault("host", "127.0.0.1");
        int port = intOpt(opts, "port", 12000);
        AnalyzerProfile profile = AnalyzerProfile.fromArg(opts.get("profile"));
        int count = intOpt(opts, "count", 5);
        int interval = intOpt(opts, "interval", 0);
        double abnormal = doubleOpt(opts, "abnormal", 0.15);
        long seed = opts.containsKey("seed")
                ? Long.parseLong(opts.get("seed"))
                : System.currentTimeMillis();

        // --sample-id takes precedence: those barcodes are assumed to exist in
        // LIMS. --barcode-prefix generates LIMS-shaped ids instead. With neither,
        // the simulator's own S… layout is used and LIMS will drop every result
        // as "no sample for barcode" — fine for `host` transcript testing, not
        // for an end-to-end demo.
        List<String> sampleIds = opts.containsKey("sample-id")
                ? Arrays.stream(opts.get("sample-id").split(","))
                        .map(String::trim).filter(s -> !s.isEmpty()).toList()
                : List.of();
        String barcodePrefix = opts.get("barcode-prefix");

        WorkloadGenerator generator = new WorkloadGenerator(seed, abnormal, sampleIds, barcodePrefix);
        AnalyzerClient client = new AnalyzerClient(host, port, profile);

        System.out.printf("[sim] profile=%s panel=%s analytes=%d abnormalBias=%.2f%n",
                profile.name(), profile.panelName(), profile.analytes().size(), abnormal);
        if (!sampleIds.isEmpty()) {
            System.out.printf("[sim] using %d supplied barcode(s), cycled: %s%n",
                    sampleIds.size(), String.join(", ", sampleIds));
        } else if (barcodePrefix != null) {
            System.out.printf("[sim] generating LIMS-shaped barcodes: %s-<today>-00000001…%n", barcodePrefix);
        } else {
            System.out.println("[sim] WARNING: generating S… ids that will NOT match any LIMS barcode; "
                    + "pass --sample-id or --barcode-prefix DH for an end-to-end run");
        }

        int batch = 0;
        do {
            batch++;
            List<SimulatedSample> samples = AnalyzerClient.collect(generator, profile, count);
            try {
                client.transmit(samples);
            } catch (Exception e) {
                System.err.println("[sim] transmission failed: " + e.getMessage()
                        + " (is a host listening on " + host + ":" + port + "?)");
                if (interval <= 0) {
                    throw e;
                }
            }
            if (interval > 0) {
                System.out.printf("[sim] batch %d done; next in %ds%n", batch, interval);
                Thread.sleep(interval * 1000L);
            }
        } while (interval > 0);
    }

    private static Map<String, String> parseOptions(String[] args) {
        Map<String, String> opts = new HashMap<>();
        for (int i = 1; i < args.length; i++) {
            if (args[i].startsWith("--")) {
                String key = args[i].substring(2);
                String value = (i + 1 < args.length && !args[i + 1].startsWith("--")) ? args[++i] : "true";
                opts.put(key, value);
            }
        }
        return opts;
    }

    private static int intOpt(Map<String, String> opts, String key, int def) {
        return opts.containsKey(key) ? Integer.parseInt(opts.get(key)) : def;
    }

    private static double doubleOpt(Map<String, String> opts, String key, double def) {
        return opts.containsKey(key) ? Double.parseDouble(opts.get(key)) : def;
    }

    private static void printUsage() {
        System.out.println("""
                Durdans LIMS Analyzer Simulator (ASTM E1394 / LIS2-A2)

                Usage:
                  SimulatorMain host     [--port 12000]
                  SimulatorMain analyzer [--host 127.0.0.1] [--port 12000]
                                         [--profile hematology|chemistry]
                                         [--count 5] [--interval 0]
                                         [--abnormal 0.15] [--seed <long>]
                                         [--sample-id <barcode>[,<barcode>...]]
                                         [--barcode-prefix DH]

                Modes:
                  host     Listen as the LIS host and print a decoded transcript.
                  analyzer Upload dummy results to a host (broadcast mode).

                Options:
                  --profile         hematology (FBC) or chemistry (Urea & Electrolytes)
                  --count           samples per batch
                  --interval        seconds between batches (0 = single batch, then exit)
                  --abnormal        0.0-1.0 bias toward abnormal/critical values
                  --seed            fixed seed for reproducible data (default: time-based)
                  --sample-id       barcodes to send results for, comma separated and
                                    cycled. Copy them from the LIMS accessioning screen.
                  --barcode-prefix  generate LIMS-shaped barcodes (DH-yyyyMMdd-00000001)
                                    instead of the simulator's own S… layout

                Sample ids: LIMS looks a specimen up by barcode and silently skips
                results it cannot match. The default S… ids never match, so for an
                end-to-end run pass real barcodes with --sample-id, or --barcode-prefix DH
                against a freshly seeded database where the sequence starts at 1.

                Quick start (two terminals):
                  1)  SimulatorMain host --port 12000
                  2)  SimulatorMain analyzer --port 12000 --profile hematology --count 5

                End-to-end into a running LIMS:
                      SimulatorMain analyzer --port 12000 --profile hematology \\
                        --sample-id DH-20260801-00000001,DH-20260801-00000002
                """);
    }
}
