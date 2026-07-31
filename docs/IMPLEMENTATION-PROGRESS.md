# Implementation Progress

> Work delivered against `ENTERPRISE-REVIEW-AND-ROADMAP.md`. All on
> `enterprise-hardening` branches of the three repos (nothing on `develop`/`main`).
> Backend compiles; `./gradlew test` passes. Build JDK: corretto-21
> (`JAVA_HOME=C:/Users/Kalana/.jdks/corretto-21.0.8`).

Legend: ✅ complete · ◑ core + key depth delivered, minor depth remains.

| Phase | State | Delivered | Remaining |
|------|:----:|-----------|-----------|
| **0 — Blockers** | ✅ | All 9 P0 items + quick wins (secrets, tenant isolation, outbox+DLQ, async notifications, bulkVerify, critical values, actuator/CI/docker, …) | Human: rotate leaked creds + purge git history |
| **1 — Foundation** | ◑ | RestTemplate timeouts, discount audit trail, bounded async executor | Module split; remove self-HTTP call; **dispatch I/O out of txn (see below)**; writes-in-GET |
| **2 — Data model** | ◑ | LOINC + UCUM coding, numeric result column, **age/sex-banded reference ranges** (matcher + resolver, tested) | Result amendment versioning; thread sex/age into live MLT flagging |
| **3 — Instrument middleware** | ✅ | ASTM codec → device→LOINC → idempotent ingestion → outbox; feature-flagged TCP listener; **consumes the simulator**; tested | Host-query mode; raw-message persistence |
| **4 — QC + autoverification** | ✅ | Autoverification + **per-patient delta check** + **QC persistence (Westgard-evaluated dashboard)**; all tested | Levey-Jennings chart UI; QC lot management UI |
| **5 — Admin** | ◑ | Keycloak Admin API user mgmt (branch-scoped) + **frontend users screen wired to it** | Branch CRUD; role matrix; remaining mock admin screens |
| **6 — Interoperability** | ◑ | HL7 v2.5.1 ORU^R01 + **FHIR R4 DiagnosticReport bundle** + **inbound HL7 ADT/ORM parser**; tested | Accreditation-grade PDF; MLLP listener wiring |
| **7 — Compliance** | ✅ | PDPA consent + access export + right-to-erasure; **e-signature manifestation**; **retention scheduler**; tested | DPIA record-keeping; consent at registration UI |

### The one deliberately-deferred item: dispatch I/O out of its transaction (C1)
`DispatchService.dispatchReport/retryAttempt` send email/SMS synchronously inside
the DB transaction. The correct fix converts dispatch to **asynchronous**: persist
attempts as PENDING in the transaction, send AFTER_COMMIT on the notification
executor (or via the outbox), and update attempt/overall status in a separate
transaction. This changes the API contract (the response no longer reflects the
send outcome) and therefore needs a coordinated **frontend change to poll delivery
status**, plus a running SMTP/SMS gateway to verify. It was **not shipped blind**
to avoid breaking a working clinical flow — implement it with the running stack and
the outbox pattern already in the codebase (`com.uom.lims.outbox`).

## The end-to-end machine loop (demoable)

```
lims-instrument-simulator (analyzer mode, ASTM/TCP)
   └─▶ InstrumentTcpListener (app.instrument.listener.enabled=true, :12000)
        └─▶ AstmInbound decode + checksum  ──▶ AstmMessage parse
             └─▶ DeviceCodeMap (device → LOINC) ──▶ find sample by barcode + parameter by LOINC
                  └─▶ ingest result (idempotent) ──▶ AutoverificationService
                       ├─ normal numeric  → TECHNICALLY_VERIFIED (auto) ─▶ sample VERIFIED
                       └─ abnormal/critical → ENTERED ─▶ supervisor queue
                  └─▶ OutboxService → Kafka (lab.instrument.results)
```

## How to run / verify

```bash
# backend tests
cd apps/lims-core-service && JAVA_HOME=C:/Users/Kalana/.jdks/corretto-21.0.8 ./gradlew test

# full local stack (now complete)
cd infra && docker compose up -d   # keycloak, 2x postgres, kafka, localstack, prometheus, grafana

# demo the instrument loop
#  1) start the app with app.instrument.listener.enabled=true
#  2) cd lims-instrument-simulator && javac -d out $(find src -name "*.java")
#     java -cp out com.uom.lims.simulator.SimulatorMain analyzer --port 12000 --profile hematology
#     (point the simulator's O-record sampleId at a real sample barcode, or add host-query)
```

## Tests added
`AstmInboundTest` (ASTM decode/parse/mapping + checksum), `WestgardEvaluatorTest`
(QC rules), `Hl7OruBuilderTest` (HL7 message), `DataSubjectRequestServiceTest`
(PDPA erasure redaction) — plus the pre-existing validator/dispatch tests.
