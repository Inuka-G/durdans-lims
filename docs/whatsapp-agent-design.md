# WhatsApp Agent — Design

Status: in progress (phase 0 landed) · Owner: Lab Platform · Related: `apps/lims-whatsapp-service/`, `apps/lims-voice-gateway/` (phase 5)

## Problem

Patients ask the reception desk and the switchboard the same handful of questions all
day: what does this test cost, is my report ready, where is my sample, what do I have to
do before the test. Every one of those answers already exists in the LIMS, and every one
of them currently costs a staff member a phone call. Most of those patients are on
WhatsApp, and a large share of them would rather speak than type — in Sinhala.

## Principles

1. **The bot never sends a clinical value.** Not a figure, not a positive/negative, not
   a reference range. It says the report is ready and issues a one-time, OTP-gated link.
   This is what keeps us inside WhatsApp's policy on health information and inside the
   PDPA's treatment of health data as a special category — and it means a patient never
   reads a critical value off a phone with nobody to explain it.
2. **The clinical core is a dependency, not a host.** The agent runs as its own service
   with its own database and reaches patient data only through `lims-core-service`'s HTTP
   API, under a Keycloak service account with read-only scopes. A defect in the agent
   cannot reach a specimen record.
3. **Rules live next to the data, not in the prompt.** A system prompt is a suggestion.
   Identity binding, scope checks, rate limits and the audit write happen server-side in
   the tool layer, so they hold identically whether the caller is the text agent, the
   voice model, or something we have not built yet.
4. **Fail closed.** No app secret means every webhook is rejected. Window expired means
   the free-form send is refused and converted to a template. This matches the posture
   `ReportDispatchChannelService` already takes for an unconfigured channel.
5. **Acknowledge only what is stored.** Meta redelivers anything not answered with a
   200, so persistence happens before the ack. Reasoning and replying happen after, where
   failure is recoverable.

## Components

```
Meta Cloud API ──webhook──▶ lims-whatsapp-service ──HTTP──▶ lims-core-service
                            (Spring Boot, Java 21)          (catalogue, orders,
Meta Calling API ─audio──▶  lims-voice-gateway              bills, dispatch, audit)
                            (Python, Pipecat)  ──▶ Gemini Live ──tools──┘
```

- **`lims-whatsapp-service`** — webhook ingress and signature verification, conversation
  and consent state, the 24-hour window, the text agent, and the tool + policy layer that
  both channels call.
- **`lims-voice-gateway`** (phase 5) — answers WhatsApp calls, transcodes Opus, and
  bridges the audio into a Gemini Live session. Carries no business logic.

## Key decisions

| Decision | Why |
|---|---|
| Separate service, not a package in the core | Public internet ingress plus an LLM client does not belong inside the clinical core |
| Separate database `durdans_wa_db` | Makes the isolation something Postgres enforces rather than something we intend |
| `wamid` UNIQUE as the idempotency mechanism | Meta redelivers; application-level dedup leaves a race between concurrent deliveries, a unique index does not |
| Gemini for both channels | Text via Spring AI's Google GenAI client, voice via Gemini Live native audio. One vendor, no transcription or synthesis hop on the call path, and Vertex data-residency controls we can show a regulator |
| Tools return pre-rendered spoken strings | On a native-audio path there is no draft to inspect, so price grounding has to be structural: the model relays a string it did not compose |

## Platform constraints we design around

- **A business cannot open a conversation.** Outbound contact is by pre-approved template
  only. Roughly eight are needed, in Sinhala, Tamil and English.
- **The 24-hour window closes.** Outside it, only templates. Every template carries a
  quick-reply button, because the tap is an inbound message and reopens the window.
- **From 1 October 2026 replies are billable.** Service messages inside the window stop
  being free. This is why the design leans on interactive lists, buttons and WhatsApp
  Flows rather than conversational back-and-forth.
- **Outbound calls need permission**, requested inside an open window, granted for seven
  days or permanently, with tight attempt limits. Treat a call as a scarce resource.

## Gaps in the LIMS this depends on

| Needed | State |
|---|---|
| Test packages with bundle pricing | Does not exist — `TestCatalogEntity` has one price per test |
| Sinhala / Tamil test names | No i18n table anywhere |
| Patient prep instructions | Not modelled beyond sample and tube type |
| Collection slots and home visits | No booking code in the backend |
| Read path for a service account | `LabTestController` is role-locked; needs a `lims-agent` Keycloak client |
| `DeliveryMethod.WHATSAPP` | Enum exists; `ReportDispatchChannelService` deliberately fails closed |

The first three are content problems as much as code problems — several hundred test
names and fasting rules need clinical and linguistic sign-off. That work is the schedule
critical path, not the code.

## Deploying to the EC2 host

Caddy terminates TLS for a fourth hostname, `wa.<domain>`, and proxies it to the
service on the compose network. The service publishes no host port: the webhook is the
only thing it exposes and it should reach the internet through TLS, not through a
published container port.

**Order matters, and getting it wrong bricks the boot.** `bootstrap.sh` runs
`docker compose up` for the whole stack, so if the WhatsApp image is not in ECR yet the
pull fails and takes the rest of the stack with it. Push an image first:

1. Merge to `main` so `whatsapp-service-release.yml` builds and pushes `:latest`, or
   push one by hand from a machine with AWS credentials.
2. Fill in the `durdans-lims/meta` secret — it is created empty on purpose and the
   service rejects every webhook while the app secret is blank.
3. `terraform apply`.
4. Point Meta's callback URL at `https://wa.<domain>/webhook/whatsapp`.

**`terraform apply` replaces the EC2 instance** whenever `bootstrap.sh` changes, because
`user_data_replace_on_change = true`. What that costs:

| | |
|---|---|
| LIMS / patient data | Safe — RDS is a separate resource |
| WhatsApp conversation data | Safe — also RDS, in `durdans_wa_db` |
| Elastic IP, so the URL | Safe |
| Keycloak's database | **Lost** — it is a container volume, and the realm re-imports to its seed state |

The agent gets its own Postgres role and database on the same RDS instance, created
idempotently by `bootstrap.sh`. Nothing is granted to that role on `durdans_lims_db`,
which is what makes the isolation something Postgres enforces rather than something the
design intends.

A caveat on `nip.io`: the hostname contains the IP address, so changing the Elastic IP
changes the webhook URL. Meta's callback URL is awkward to change — re-verification has
a window where deliveries fail — so a real domain is worth having before launch.

## Phase 1 — landed

- `test_package`, `test_package_item`, `test_catalog_i18n`, `test_package_i18n`; fasting
  and prep columns on `test_catalog`
- Bundle price stored, saving / fasting / turnaround derived — strictest rule wins
- A package cannot be activated without a price or without tests; sample packages ship
  inactive at zero
- Translations are drafts until a clinical role reviews them; unreviewed rows are never
  served and callers fall back to English with `translated=false`
- Translation coverage endpoint returning the outstanding test codes, not just a percentage
- `/api/v1/agent/**` under a dedicated `AGENT_READONLY` role, catalogue data only
- `lims-agent` Keycloak client with a service account and no secret in the realm import

## Phase 0 — landed

- Gradle build, Liquibase, observability and Docker conventions matched to the core service
- `wa_contact`, `wa_conversation`, `wa_message`
- `X-Hub-Signature-256` verification: HMAC over raw bytes, constant-time compare, rejects
  everything when unconfigured
- Webhook subscription handshake with a constant-time verify-token check
- Idempotent inbound ingest; the 24-hour window opens from the inbound timestamp
- 18 tests, including Testcontainers integration tests against real Postgres

Run it locally:

```bash
cd apps/lims-whatsapp-service && ./gradlew test
```
