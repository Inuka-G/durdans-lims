# Instrument Integration — Design

Status: proposed · Owner: Lab Platform · Related: `lims-instrument-simulator/`, Roadmap Phase 3

## Problem

Analyzers are not connected, and the current "instruments" + "QC" screens are
backed by static JSON (`lims-core-service-app/.../reference-data/instruments.json`,
`qc-runs.json`) served by `LabOperationsService` — there is no real device layer.
Real analyzers speak **ASTM E1394 / LIS2-A2** or **HL7 v2** over serial/TCP, not
REST. We need a device layer that is identical whether the source is the
simulator or real hardware.

## Principles

1. **Isolate the device layer.** A hung or chatty analyzer must never hold a core
   DB transaction or connection. Integration runs as its own bounded context
   (its own threads, its own inbound buffer, its own DB tables for raw messages).
2. **The protocol is the same for sim and real.** Build against the simulator
   using genuine ASTM; swap transport (TCP↔serial) and analyzer profile for real
   devices. No "demo mode" branch in core logic.
3. **At-least-once into the core, idempotent on ingest.** Device results enter
   the core via the **transactional outbox**, keyed by `(instrumentId, sampleId,
   testCode, runTimestamp)` so replays are safe.
4. **Map at the edge.** Device test codes → LIS catalogue tests via **LOINC**
   (the simulator already emits LOINC per analyte). The core never sees device
   codes.

## Components

```
┌────────────────────┐   ASTM/TCP (or serial)   ┌──────────────────────────────┐
│ Analyzer / Simulator│◀────────────────────────▶│ Instrument-Integration Service│
└────────────────────┘                           │  ┌────────────────────────┐  │
                                                  │  │ Driver registry        │  │
                                                  │  │  (one per analyzer model)│ │
                                                  │  │  parse R/O/Q · build O/Q │ │
                                                  │  └─────────┬──────────────┘  │
                                                  │  ┌─────────▼──────────────┐  │
                                                  │  │ Code map: device→LOINC→ │  │
                                                  │  │          LIS test        │  │
                                                  │  └─────────┬──────────────┘  │
                                                  │  ┌─────────▼──────────────┐  │
                                                  │  │ raw_message log (audit) │  │
                                                  │  │ instrument_result table │  │
                                                  │  │ + OUTBOX row            │  │
                                                  │  └─────────┬──────────────┘  │
                                                  └────────────┼─────────────────┘
                                                               │ Kafka (relayed outbox)
                                                  ┌────────────▼─────────────────┐
                                                  │ Results & QC context          │
                                                  │ autoverify · delta · reflex · │
                                                  │ critical-value · QC (Westgard)│
                                                  └───────────────────────────────┘
```

### Driver (per analyzer model)
- `parseInbound(records) -> List<InstrumentResult>` and `buildOrder(order) -> records`.
- Owns model-specific quirks (field positions, code conventions, units).
- Hot-pluggable (registry keyed by model id) so adding an analyzer is a new
  driver, not a core change. (OpenELIS uses the same plugin-per-analyzer idea.)

### Connection modes
- **Broadcast** (implemented by the simulator): analyzer pushes results; host ACKs.
- **Host-query** (roadmap): analyzer scans the tube, sends a `Q` record; the
  middleware looks up the order and replies with `O` records, then receives `R`.
  Preferred for production (positive sample ID, no pre-download race).

## Data model (integration-owned tables)

| Table | Purpose |
|-------|---------|
| `instrument` | registered analyzers (id, model, transport, status, last_seen) |
| `instrument_channel` | device test code → LOINC → LIS `test_parameter` mapping |
| `instrument_raw_message` | every inbound/outbound message verbatim (traceability/accreditation) |
| `instrument_result` | parsed result staged before core ingest (idempotency key) |
| `qc_result` | QC runs from the analyzer (feeds the QC/Westgard module) |
| `outbox` | `INSTRUMENT_RESULT_RECEIVED`, `QC_RESULT_RECEIVED` events |

## Ingest flow (broadcast)

1. Listener accepts the ASTM session, validates checksums, ACKs frames, persists
   the **raw message** (one DB txn, integration DB).
2. Driver parses records → `instrument_result` rows; QC records → `qc_result`.
3. In the **same txn**, write an `outbox` row per result with the idempotency key.
4. Outbox relay publishes to Kafka; Results & QC consumes idempotently:
   - match to the open `Sample`/`OrderItem` by sample id;
   - convert units (UCUM), compute flags from the **reference-range engine** (not
     the analyzer's ranges), run **delta check** vs prior result, evaluate
     **autoverification** rules (CLSI AUTO10/15) and **reflex** rules;
   - auto-release or route to the MLT/verification worklist; raise the
     **critical-value** workflow when panic limits are breached.

## Testing

- Contract test: simulator → integration listener → assert `instrument_result`
  + outbox rows for a known seed.
- Resilience: kill the analyzer mid-message → no partial result ingested
  (raw message marked incomplete, no outbox row).
- Idempotency: replay the same batch → no duplicate core results.

## Migration to real hardware

Replace the simulator endpoint with the analyzer's IP/port (TCP) or a serial
bridge; add/confirm the model driver and the device→LOINC channel map. Core,
events and downstream logic are unchanged.
