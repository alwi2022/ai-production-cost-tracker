# KU Creatives Production Finance

Internal AI production cost tracker for the supplied take-home assignment. Imports Vendor A and B CSVs, the Vendor C HTTP API, and the manual operations workbook into SQLite. The Indonesian dashboard shows project budgets, vendor costs, weekly spend, reconciliation results, and notifications. The revised interface uses x.ai as the primary composition reference, the user-requested KU Creatives logo, self-hosted Geist, and locally bundled Lucide SVG icons.

## Run locally

Requires **Node.js 22.15+** and npm. The app uses the built-in `node:sqlite` module, which emits an experimental warning on Node 22.15. The provided Vendor C mock itself still supports Node 18+.

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Edit `.env`: set `VENDOR_C_API_KEY` to the **supplied mock key documented in `docs/vendor_c_api.md`**. Do not commit `.env`. Leave `ALERT_WEBHOOK_URL` empty to use the local mock receiver. A local `.env` has already been prepared in this workspace; do not overwrite it unless you want to reset configuration.

Terminal 1:

```powershell
npm.cmd run vendor
```

Terminal 2:

```powershell
npm.cmd run dev
```

Open **http://127.0.0.1:3000**. Click **Import data**. The first import also evaluates budgets and sends eligible alerts. Importing again with unchanged inputs preserves totals and does not resend successful alerts.

Optional CLI (keep the app running to receive mock webhooks):

```powershell
npm.cmd run import
```

`npm` can be used instead of `npm.cmd` on macOS/Linux or in shells without PowerShell's script execution restriction.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Dashboard server, bound to `127.0.0.1` |
| `DATABASE_PATH` | `storage/tracker.sqlite` | Persistent SQLite file, relative to the project root |
| `VENDOR_C_URL` | `http://127.0.0.1:4010` | Vendor C base URL |
| `VENDOR_C_API_KEY` | none | Server-side Bearer credential |
| `ALERT_WEBHOOK_URL` | local `/api/mock-webhook` | Notification destination |

The Vendor C process separately supports `PORT` and `VC_FAIL_RATE`. To disable its random failures for a deterministic demonstration, set `VC_FAIL_RATE=0` in that terminal before starting it. The application handles its normal 429 and 500 responses without requiring this setting.

## Operations workflow

- **Overview:** total assigned spend, budgets, warnings, weekly net spend, and vendor breakdown. The project selector updates these views. Refunds reduce spend. Unassigned costs remain visible in a separate warning.
- **Proyek:** project spend, budget, percentage, and status. Click a project name to inspect its transactions.
- **Transaksi:** search, filter by project/status, and paginate in one toolbar. Click a transaction ID to open details. For an unresolved record, choose its confirmed project and click **Simpan proyek**. Assignments persist across imports and trigger budget evaluation.
- **Sumber & import:** source locations, row counts, last import counts, and fixed conversion rates. Update the supplied files on disk and rerun import. This version does not have file upload controls.
- **Notifikasi:** delivery status in one table. A retry action appears only when pending messages exist. The local mock webhook inbox is available in an expandable section.
- **Export CSV:** available only on Transaksi; respects its visible project, search, and status filters. Includes `status` and `duplicate_of`, so duplicate rows must not be summed. Dates include `+07:00`; amounts are unformatted numeric IDR. Spreadsheet formula prefixes in text values are neutralized.
- Light/dark theme persists in the browser. One top-bar toggle serves desktop and mobile.
- Import exists only on Sumber & import. Source paths, conversion details, and diagnostics are in an expandable section instead of repeated notes.

The UX research and final action placement are documented in [docs/ux-decisions.md](docs/ux-decisions.md). Review of the original 13 unassigned transactions is in [docs/unassigned-review.md](docs/unassigned-review.md). At review time, an existing user assignment had already linked one to BRK-05; the other 12 lack enough source evidence for automatic allocation.

## Architecture

```text
CSV A + CSV B + XLSX + Vendor C HTTP
               |
    parsing, normalization, validation
               |
    project aliases + reconciliation
               |
   SQLite transaction (all-or-nothing)
               |
        dashboard queries
               |
      persisted alert outbox -> webhook
```

- `src/normalize.js`: exact money parsing, explicit source date formats, project alias mapping, WIB day and Monday-based week helpers.
- `src/vendor.js`: HTTP pagination, timeouts, bounded retries, and `Retry-After` handling. Authentication/configuration errors fail immediately. The application imports via HTTP, never directly from the mock JSON.
- `src/importer.js`: reads all sources before committing; validates records; upserts projects/transactions; reconciles overlaps. A failed API request, parse, or validation leaves the last successful import untouched.
- `src/db.js`: schema, foreign keys, persistent storage, source ID uniqueness, assignments, import summaries, alert delivery state, and mock notifications.
- `src/dashboard.js`: read model. Project/vendor/weekly totals include only `included` records. `unresolved` and `duplicate` records remain inspectable.
- `src/alerts.js`: durable pending/sent notifications, delivery timeout, retries on demand, and a stable idempotency header.
- `src/server.js`: Express API, static frontend, local write protection, and one active mutation at a time per server process.
- `public/`: buildless HTML/CSS/JavaScript; no runtime CDN or frontend framework. Geist fonts and selected Lucide icons are served locally. Charts are generated from imported records using SVG, with expandable data tables.
- `scripts/prepare-assets.mjs`: postinstall step prepares the local font, selected icon data, and license files. Generated assets are also committed so the checkout is reviewable immediately.

SQLite fits a small, single-machine internal tool and avoids a separate database service. The browser never receives the Vendor C credential. Source payloads and original labels are retained for auditability. Amounts are integer **hundredths of IDR** internally; JSON/API values named `amount`, `spend`, and `budget` use this unit. Webhook fields ending in `_idr` and CSV exports use actual IDR.

## Normalization and reconciliation decisions

1. `projects.csv` defines six canonical projects and their lifetime budgets. Explicit aliases normalize case and punctuation, including names such as `Kopi Malam` and `kmd02`. Unknown labels are not guessed or mapped automatically to Internal.
2. Fixed rates from `rates.json` apply to every date: 160 IDR per credit and 16,250 IDR per USD. USD cents are divided by 100 conceptually; integer minor-unit arithmetic avoids floating-point currency accumulation.
3. Vendor A dates use `MM/DD/YYYY HH:mm`; B uses `DD-MM-YYYY HH:mm`; C uses UTC ISO timestamps. Store UTC instants, display and aggregate in WIB. Manual dates are local WIB at midnight, not UTC. Excel typed dates, ISO, day/month/year, `Sep`, and `Okt` are supported.
4. Weeks begin Monday in WIB, with missing intervening weeks shown as zero. All-time project budgets are not limited by the weekly chart.
5. Vendor records are unique by `(source, source_id)`. Repeated identical IDs within an input are skipped and counted; conflicting payloads for one ID abort import. Refunds are separate negative entries linked to the original transaction, not deletions of the original expense.
6. Manual records have a normalized content fingerprint plus occurrence number. A Vendor A reference and matching amount/project identifies an overlap. Without a reference, only one candidate with the same canonical project, WIB date, amount, and job type is accepted. Ambiguous/no-match entries stay included rather than being silently discarded.
7. Within the manual sheet, normalized day, project, vendor, description, amount, and reference identify duplicate entries. Invoice text in descriptions helps distinguish different purchases. Duplicates remain in the database with a canonical reference but are excluded from totals.
8. Header, title, blank rows, and the precomputed Excel TOTAL are not usage records. That TOTAL includes duplicates and overlaps, so it is not used as the reconciled result.
9. Import is an upsert, not an authoritative delete/replace. Records removed from later input files remain stored. A changed manual record may have a new fingerprint and requires review; this is documented rather than risking deletion of financial history.

## Budget alerts

Discord is supported directly via incoming webhook. Follow [docs/discord-setup.md](docs/discord-setup.md) for creating a webhook, storing it privately in `.env`, checking configuration, sending a synthetic test, and activating project alerts. `npm.cmd run alerts:check` sends nothing; `alerts:test` sends one synthetic message; `alerts:send` evaluates and sends real budget alerts.

The threshold is interpreted as **strictly greater than 80%**, based on the brief's word "crosses". First importing a project already above the threshold sends a notification. Refunds reduce the current total before evaluation.

One successful alert is sent per project per destination. Falling below and subsequently exceeding the threshold does not create another alert to the same destination. Raising a budget does not reset delivery history. Pending deliveries are persisted and retried after import, using `alerts:send`, or with the retry button; there is no background scheduler. Pending messages already queued may still be delivered if spend later falls below the threshold. Switching from the original local mock to Discord creates independent delivery state; credentials are represented by a URL hash, not stored in the database.

Payload example (field values illustrative):

```json
{
  "project": "KMD-02",
  "project_name": "Kopi Malam Mini Drama S1",
  "current_spend_idr": 45360000,
  "budget_idr": 56000000,
  "percentage_used": 81,
  "content": "Project, current spend, budget, percentage and threshold message"
}
```

The default receiver is `POST /api/mock-webhook`, visible in the Notifikasi inbox. A custom receiver should accept the JSON payload above. Discord budget alerts use an embed card with project, status, expense, budget, percentage, and remaining budget or overspend, with Indonesian currency formatting and disabled mentions. Requests use `wait=true` for server confirmation. Other vendor-specific formats may require an adapter. The `Idempotency-Key` header is `budget-80-<project_code>`; the local receiver deduplicates by project. Discord does not guarantee deduplication using that header.

Successful responses mark messages as sent; failed responses remain pending with attempt count/error. An external receiver that processes a message but loses its response can receive a retry. Exactly-once external delivery requires receiver-side idempotency. Run one application/import worker at a time; the local HTTP lock does not coordinate separate CLI/server processes.

## Expected result from the supplied files

Verified against the real running Vendor C mock as well as isolated fixture tests:

| Check | Result |
| --- | ---: |
| Input records | 387 |
| Unique stored records | 383 |
| Repeated Vendor B rows skipped | 4 |
| Stored manual overlaps/duplicates | 19 |
| Included records | 351 |
| Unresolved records | 13 |
| Assigned project spend | Rp159,994,487.50 |
| Unresolved spend | Rp5,836,232.50 |
| Combined reconciled spend | Rp165,830,720.00 |

| Project | Spend IDR | Budget IDR | Used |
| --- | ---: | ---: | ---: |
| BRK-05 | 15,125,510.00 | 48,750,000 | 31.03% |
| GBX-01 | 18,971,522.50 | 17,000,000 | 111.60% |
| GLW-03 | 24,928,220.00 | 32,500,000 | 76.70% |
| INT-00 | 17,158,777.50 | 18,750,000 | 91.51% |
| KMD-02 | 48,151,612.50 | 56,000,000 | 85.99% |
| SNJ-04 | 35,658,845.00 | 64,750,000 | 55.07% |

Three initial mock messages: GBX-01, INT-00, KMD-02. A second import yields 0 inserted, 0 updated, 383 unchanged, unchanged financial totals, and no additional alerts.

## Tests and verification

```powershell
npm.cmd test
npm.cmd audit
```

Thirteen test groups cover locale money parsing, refunds, date formats/WIB boundaries, aliases, API pagination/retries, full supplied-data reconciliation, reimport idempotency, persistent assignments, failed-source rollback, alert thresholds/retries, HTTP import/dashboard/webhook behavior, Discord card formatting/confirmation/errors, destination changes, and legacy delivery migration. Tests use isolated databases, fake outbound Discord requests, and a random-port local HTTP server; they do not alter workspace financial data or send external messages.

The real mock API was also imported twice successfully. Dependency audit reports zero known vulnerabilities at implementation time. The UUID transitive dependency of ExcelJS is overridden to a patched CommonJS-compatible version, exercised by workbook import tests.

**Visual verification is incomplete:** browser access to the local app was denied by a saved permission preference, including a retry after the user reported changing it to Allow. No alternate browser path was used. Desktop/mobile layouts, actual keyboard flow, CSV download behavior, and theme rendering have not been clicked through. The current source/integration review and remaining verification boundary are documented in `anti-slop/audit-003-2026-10-19.md`; audit 002 includes the revised color contrast calculations. Earlier audits are retained as history.

## Limitations and next steps

- Local, single-user deployment; no authentication/roles or shared-hosting configuration. The server binds loopback and rejects cross-origin POSTs. Add authenticated sessions before exposing it over a network.
- Fixed supplied file names and manual sheet layout; no drag/drop upload, configurable source mappings, or generic spreadsheet detection.
- No schedule/background worker; operations trigger imports and pending alert retries. Source reads happen in memory, appropriate to this dataset rather than large production exports.
- Explicit alias list and per-record resolution; no UI to change canonical budgets, undo an assignment, or approve ambiguous duplicate matches.
- Immutable source deletions and manual corrections require an explicit adjustment workflow. Store source snapshots/revisions and add reversal support next.
- Reconciliation heuristics can flag two legitimate identical manual purchases as duplicates; future tooling should expose approval/override and field-level evidence.
- The external webhook delivery guarantee is at-least-once around timeout/crash windows. Add a transactional worker lease and receiver idempotency for multi-worker deployment.
- Dashboard reads all transactions before filtering/pagination in the browser. Move filtering and aggregation into paged SQL queries when the dataset grows.
- Source mock test credentials are supplied by the assignment in its documentation/server. New application credentials are kept out of tracked files.
- GitHub repository creation/push is not configured by this application. The local history is ready for a private remote selected by the user.
