# Setup Discord budget notifications

## Create an incoming webhook

1. Open the Discord server where notifications should appear.
2. Open **Server Settings > Integrations > Webhooks > New Webhook**. You need permission to manage webhooks on that server.
3. Choose a standard text channel, for example `production-budget`, and a name such as `KU Budget Alerts`.
4. Save and copy the webhook URL.
5. Put it in the private project-root `.env` file:

```dotenv
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

Use the actual copied URL, not the placeholder above. Do not put it in `.env.example`, commit it, or post it in chat. No bot token or additional npm package is needed. A forum/media channel requires a thread configuration; a standard text channel is the simplest setup.

Official references: [Discord webhook setup](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks), [Execute Webhook API](https://docs.discord.com/developers/resources/webhook#execute-webhook).

## Check configuration without sending

```powershell
npm.cmd run alerts:check
```

Expected: `Tujuan: Discord`. The command does not print the URL or send a request. If it says `mock lokal`, the URL is empty or missing. A malformed Discord URL is rejected with a configuration message that does not reveal the credential.

## Send one test notification

The following command sends exactly one synthetic connection-test message to the configured Discord channel. It does not send project financial data or change budget-alert delivery history:

```powershell
npm.cmd run alerts:test
```

Expected: a message from the webhook reading `KU Creatives | Tes koneksi notifikasi anggaran berhasil...` and a terminal success after Discord confirms creation.

## Activate real project alerts

Restart the app after editing `.env`: stop its existing terminal process using Ctrl+C, then run `npm.cmd run dev` again. Environment variables are loaded at process startup.

Evaluate current budgets and deliver eligible alerts without reimporting files:

```powershell
npm.cmd run alerts:send
```

This command sends real project spend, budget, and percentages to the configured channel. The supplied dataset has three projects over 80%: GBX-01, INT-00, KMD-02. Unresolved transactions are excluded, as on the dashboard. Future imports and confirmed project assignments also evaluate alerts.

Alert deliveries are now tracked per project **and destination**. Previous local mock successes do not suppress the first Discord notification. Once confirmed on Discord, repeating `alerts:send` or importing the same data does not send it again to that URL. Changing to another webhook/rotating its token changes the destination identity and can send eligible project alerts again. Returning to a previous destination preserves its delivery history. Destination identifiers are hashes; webhook credentials are not stored in the database.

An existing pre-Discord database is migrated with its prior delivery history labeled as `mock`, matching this project's original local setup. Existing project/transaction data and received mock messages are preserved.

## Delivery details and troubleshooting

- Discord receives only `content` and `allowed_mentions: { parse: [] }`; project names cannot accidentally ping a user, role, or everyone.
- The request uses `wait=true`. Delivery is marked sent only after Discord returns a created message ID.
- HTTP 429/5xx and connection failures remain pending. The command or retry action can be run again; there is no background retry scheduler.
- `401`/`404` commonly indicate an invalid/deleted webhook; create/copy the correct URL and update `.env`.
- The URL and response body are not printed in error logs.
- Discord does not provide the custom Idempotency-Key guarantee used by the local mock. A message accepted by Discord followed by a lost response can be duplicated on retry. Application-side tracking prevents normal reimport duplicates, not every network-failure/crash window.
- Do not run multiple CLI/import workers concurrently.
- Leaving `ALERT_WEBHOOK_URL` empty restores the local mock mode. The app must be running to receive mock notifications.
