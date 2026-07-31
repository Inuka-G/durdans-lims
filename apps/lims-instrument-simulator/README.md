# Durdans LIMS — Analyzer Simulator (ASTM E1394 / LIS2-A2)

A standalone program that emulates a laboratory analyzer and streams **realistic
dummy results** to the LIMS over the same protocol real machines use
(**ASTM E1381 link layer + ASTM E1394 / CLSI LIS2-A2 records**). It exists so the
team can build and demonstrate the full analytical workflow — instrument →
middleware → autoverification → worklist — **before any physical analyzer is
connected**, and swap the simulator for a real machine later by changing only
the transport.

> Built for the Durdans Hospital LIMS. Zero external dependencies — pure JDK, so
> it runs offline. Matches the team's current live scope: **FBC (blood)** and
> **Urea & Electrolytes**.

---

## Why ASTM (and not just a REST stub)

Real analyzers (Sysmex, Mindray, Roche Cobas, Beckman, …) do **not** speak REST.
They speak ASTM (or HL7 v2) over serial/TCP. Simulating the genuine protocol
means the middleware you build against this simulator is the *same code* you run
against real hardware. A REST stub would teach you nothing about framing,
checksums, ACK/NAK handshakes, frame sequencing, or host-query — the things that
actually break on go-live day.

What the simulator implements:

- **Link layer (E1381):** `ENQ → ACK/NAK → frames → EOT`, frame format
  `<STX> FN text <ETB|ETX> C1C2 <CR><LF>`, modulo-256 checksum, frame numbers
  0–7 with wrap, per-frame acknowledgement and retry.
- **Record layer (E1394 / LIS2-A2):** `H` header, `P` patient, `O` order,
  `R` result (with units, reference range and abnormal flag), `C` comment,
  `L` terminator. `Q` query records are built for the planned host-query mode.
- **Clinical realism:** typical adult reference and **critical (panic)** ranges,
  **LOINC codes** per analyte (for the middleware to map to the LIS catalogue),
  and a configurable bias toward abnormal/critical values so you can exercise the
  **critical-value workflow** and **delta checks**.

---

## Run it (no Gradle needed)

Requires a JDK 17+ on `PATH` (the project targets 21; 17 also compiles it).

```bash
# 1. compile
javac -d out $(find src -name "*.java")          # Windows PowerShell: see note below

# 2. terminal A — start the LIS host receiver (prints a decoded transcript)
java -cp out com.uom.lims.simulator.SimulatorMain host --port 12000

# 3. terminal B — emulate a hematology analyzer uploading 5 FBC samples
java -cp out com.uom.lims.simulator.SimulatorMain analyzer --port 12000 \
     --profile hematology --count 5
```

PowerShell compile (no `find`):

```powershell
javac -d out (Get-ChildItem -Recurse -Filter *.java src | ForEach-Object FullName)
```

### Or with Gradle

```bash
./gradlew runHost          # start the host on 12000
./gradlew runAnalyzer      # upload one FBC batch
# or pass your own args:
./gradlew run --args="analyzer --profile chemistry --count 3 --abnormal 0.3"
```

---

## Options

| Option | Default | Meaning |
|--------|---------|---------|
| `--host` | `127.0.0.1` | host (middleware) address — analyzer mode |
| `--port` | `12000` | TCP port |
| `--profile` | `hematology` | `hematology` (FBC) or `chemistry` (Urea & Electrolytes) |
| `--count` | `5` | samples per batch |
| `--interval` | `0` | seconds between batches; `0` = one batch then exit, `>0` = run continuously |
| `--abnormal` | `0.15` | 0.0–1.0 bias toward abnormal/critical values |
| `--seed` | time-based | fixed seed for reproducible demo data |

Continuous feed for a live demo:

```bash
java -cp out com.uom.lims.simulator.SimulatorMain analyzer \
     --profile chemistry --count 4 --interval 30 --abnormal 0.25
```

---

## Example transcript (host side)

```
[host]     analyzer connected from /127.0.0.1:63400
           HEADER   analyzer=Sysmex XN-550 (simulated)^1.0
           PATIENT  id=PAT46755 name=Jayawardena Saman dob=19900202 sex=F
           ORDER    sample=S20260530-00001 panel=FBC Full Blood Count priority=R
           RESULT   test=WBC White Cell Count value=8.4 10*9/L ref=[4.0 to 11.0] flag=normal
           RESULT   test=PLT Platelet Count value=1035 10*9/L ref=[150 to 400] flag=CRITICAL-HIGH
           COMMENT  Critical value(s) present - LIS critical-value workflow expected
           TERMINATOR
[host]     end of transmission
```

Every checksum validated (no NAKs); flags derived from each analyte's reference
and critical ranges.

---

## How this slots into the real system

```
  Analyzer Simulator  ──ASTM/TCP──▶  Instrument-Integration Service (middleware)
  (this program)                       • driver-per-analyzer (parse/build)
                                       • device code ──LOINC──▶ LIS test
                                       • persist raw message (traceability)
                                       • publish INSTRUMENT_RESULT_RECEIVED
                                         via transactional outbox
                                                     │
                                                     ▼  Kafka
                                       Results & QC context
                                       • autoverification / delta / reflex
                                       • critical-value workflow
                                       • lands on MLT/verification worklist
```

The bundled `host` mode is a stand-in for that middleware so you can demo the
simulator alone. To integrate for real, point the analyzer at the middleware's
ASTM listener instead of `host` mode. See
`../docs/instrument-integration-design.md`.

---

## Source layout

```
src/main/java/com/uom/lims/simulator/
  SimulatorMain.java              CLI entry (host | analyzer)
  astm/AstmControl.java           control chars + checksum
  astm/AstmFrame.java             frame encode / decode (+ chunking)
  astm/Lis2Records.java           H/P/O/R/Q/C/L builders + decoder
  analyzer/Analyte.java           analyte def + value/flag generation
  analyzer/AnalyzerProfile.java   HEMATOLOGY (FBC), CHEMISTRY (U&E)
  analyzer/SimulatedSample.java   one dummy patient+specimen+results
  analyzer/WorkloadGenerator.java dummy patient/sample generator
  transport/AnalyzerClient.java   ASTM sender session (analyzer role)
  transport/HostServer.java       ASTM receiver session (host/test role)
```

## Roadmap (documented, not yet built)

- **Host-query mode** — analyzer scans the tube, sends a `Q` record, the host
  replies with the order(s); the `Q` builder is already in `Lis2Records`.
- **HL7 v2 MLLP transport** (`ORU^R01` / `OUL^R22`) as a second profile, for
  analyzers/middleware that prefer HL7 over ASTM.
- **Bidirectional worklist download** (broadcast orders to the analyzer).
- Additional analyzer profiles (coagulation, immunoassay) as the LIS catalogue grows.
