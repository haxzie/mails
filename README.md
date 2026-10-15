# Mails

A self-hosted Loops / Mailchimp alternative that runs entirely on Cloudflare and
sends through **your own Amazon SES account**.

- **Projects** — one per SaaS product you run, each with its own SES identity,
  contacts, templates and API keys.
- **Campaigns** — write HTML, pick an audience, send now or schedule.
- **Transactional** — templates triggered by events your backend posts
  (`user.signup` → welcome email).
- **Contacts & lists** — CSV import, API upsert, unsubscribes, suppression list.
- **Dashboard** — sends, deliveries, opens, clicks, bounces and complaints.
- **Deliverability built in** — DKIM/SPF/DMARC checklist, one-click unsubscribe
  (RFC 8058), plain-text alternative, hard-bounce and complaint suppression.

## Stack

| Piece | What |
|---|---|
| `apps/web` | Next.js 16 dashboard, deployed to Workers with OpenNext |
| `apps/api` | Hono Worker: public API, tracking, unsubscribe, SES webhook, send queue consumer, cron |
| `packages/db` | Drizzle schema + D1 migrations |
| `packages/core` | Sending pipeline, SES client, auth, templating, stats |

Both Workers share one D1 database and one Cloudflare Queue.

```
your app ──POST /v1/events──▶ apps/api ──▶ Queue ──▶ consumer ──▶ Amazon SES
                                 ▲                                    │
dashboard (apps/web) ────────────┘            SNS event destination ───┘
                                              POST /webhooks/ses
```

## Local development

```bash
pnpm install
cp .dev.vars.example apps/api/.dev.vars
cp .dev.vars.example apps/web/.dev.vars   # same values in both
pnpm db:generate                          # only after changing the schema
pnpm db:migrate:local
pnpm dev                                  # dashboard on :3000
pnpm dev:api                              # API worker on :8787
```

Both processes share `.wrangler/state`, so they see the same local D1.

Sign-in is restricted to `ALLOWED_EMAILS` in `wrangler.jsonc` (your address by
default). With no `SYSTEM_SES_*` credentials configured, the sign-in email is
printed to the console and the one-time code is shown in the UI, so you can log
in locally without a mail provider.

Local caveat: the queue producer in `next dev` and the consumer in
`wrangler dev` are separate processes, so campaigns started from the local
dashboard are not consumed locally. Trigger sends against the local API worker
instead (`POST /v1/emails`), or test campaign sending on a deployed preview.

```bash
pnpm typecheck   # every package
pnpm test        # core unit tests
pnpm --filter @mails/web lint
```

## Deploy to Cloudflare

```bash
# 1. Database and queues (once)
pnpm --filter @mails/db exec wrangler d1 create mails-db
pnpm --filter @mails/api exec wrangler queues create mails-send
pnpm --filter @mails/api exec wrangler queues create mails-send-dlq
```

Put the printed `database_id` into **both** `apps/api/wrangler.jsonc` and
`apps/web/wrangler.jsonc`, and set the real URLs in each `vars` block:

```jsonc
"vars": {
  "APP_URL": "https://mails-web.<account>.workers.dev",
  "API_URL": "https://mails-api.<account>.workers.dev",
  "ALLOWED_EMAILS": "you@example.com"   // or "@yourdomain.com"
}
```

```bash
# 2. Schema
pnpm db:migrate:remote

# 3. Secrets — same values for both Workers
for app in api web; do
  pnpm --filter @mails/$app exec wrangler secret put ENCRYPTION_KEY
  pnpm --filter @mails/$app exec wrangler secret put AUTH_SECRET
  pnpm --filter @mails/$app exec wrangler secret put SNS_WEBHOOK_SECRET
  pnpm --filter @mails/$app exec wrangler secret put SYSTEM_SES_ACCESS_KEY_ID
  pnpm --filter @mails/$app exec wrangler secret put SYSTEM_SES_SECRET_ACCESS_KEY
  pnpm --filter @mails/$app exec wrangler secret put SYSTEM_FROM_EMAIL
done

# 4. Ship
pnpm deploy
```

`ENCRYPTION_KEY` encrypts each project's SES secret key at rest (AES-GCM).
`AUTH_SECRET` signs sessions, unsubscribe links and tracking links — rotating it
invalidates every session and every unsubscribe link already in an inbox.

## Amazon SES setup

1. Create an IAM user with `ses:SendEmail`, `ses:GetAccount`,
   `ses:GetEmailIdentity` and `ses:CreateEmailIdentity`. Paste its keys into
   **Project → Settings**.
2. Set your sending domain and press **Verify domain** — that registers the
   domain with SES and turns on Easy DKIM.
3. Publish every record from the **DNS records** table: three DKIM `CNAME`s,
   the custom MAIL FROM `MX` + SPF `TXT`, and a DMARC `TXT`. Export them as a
   BIND zone file if your provider takes one, and use **What is published
   right now** on the same screen to check what DNS actually serves.
4. Create an SES **configuration set** (name it in Settings) with an SNS event
   destination for *Send, Delivery, Bounce, Complaint, Open, Click, Reject*,
   and subscribe the topic to:

   ```
   https://<your-api>/webhooks/ses?secret=<SNS_WEBHOOK_SECRET>
   ```

   The endpoint confirms the SNS subscription automatically and rejects
   anything without the secret.
5. Ask AWS to move the account out of the SES sandbox before sending to real
   contacts, and keep the send rate in Settings at or below your SES quota.

## API

Authenticate with a project API key: `Authorization: Bearer mls_…`
(**Project → API & keys**).

| Endpoint | Purpose |
|---|---|
| `POST /v1/events` | Upsert the contact and send the template wired to that event |
| `POST /v1/contacts` | Create or overwrite a contact (`lists` to subscribe) |
| `PATCH /v1/contacts/:email` | Partial update — merges `properties`, so `{"properties":{"plan":"pro"}}` marks a customer as paid without dropping the rest |
| `GET /v1/contacts/:email` | Read one contact |
| `DELETE /v1/contacts/:email` | Delete a contact |
| `POST /v1/contacts/:email/unsubscribe` | Unsubscribe from your own UI |
| `POST /v1/contacts/:email/resubscribe` | Reverse an unsubscribe (bounces and complaints stay suppressed) |
| `POST /v1/emails` | One-off transactional send (inline HTML or `transactionalId`) |
| `GET /v1/emails/:id` | Delivery status, opens and clicks |
| `GET /v1/lists`, `POST /v1/lists` | Manage lists |
| `GET /v1/stats?days=30` | Aggregate counters |

Hook it into your signup flow:

```ts
await fetch("https://<your-api>/v1/events", {
  method: "POST",
  headers: {
    authorization: `Bearer ${process.env.MAILS_API_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    event: "user.signup",
    email: user.email,
    contact: { firstName: user.firstName },
    data: { plan: "pro" },
  }),
});
```

Public, unauthenticated endpoints: `GET|POST /u/:token` (unsubscribe),
`GET /t/o/:token` (open pixel), `GET /t/c/:token` (click redirect). All three
take HMAC-signed tokens — the click redirect target is part of the signature,
so the links can't be repointed.

## Templating

Bodies are rendered per recipient:

- `{{firstName}}`, `{{lastName}}`, `{{name}}`, `{{email}}`
- `{{properties.plan}}` (anything you stored on the contact, also available as
  `{{plan}}`)
- `{{project.name}}`, `{{unsubscribe_url}}`
- `{{firstName | there}}` — fallback when the value is missing

Values are HTML-escaped in the HTML part. Every campaign is sent as
`multipart/alternative`; the plain-text part is generated from the HTML unless
you write your own. An unsubscribe footer with your postal address is appended
automatically unless the body already links `{{unsubscribe_url}}`.

## Deliverability

Enforced by the app, not left to you:

- `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- `Precedence: bulk` and `List-Id` on campaigns only, never on transactional mail
- hard bounces and complaints go straight onto the project suppression list and
  are never mailed again
- unsubscribed contacts are skipped at send time, after queueing
- campaigns refuse to send without a From address and SES credentials, and warn
  about a missing postal address, DKIM domain, configuration set or preview text
- transactional templates can opt out of consent checks (`Send even to
  unsubscribed contacts`) for receipts and password resets only
- a live DNS check reads the domain over DNS-over-HTTPS and flags the things
  that silently break authentication: a missing DMARC record, *two* DMARC
  records (which RFC 7489 treats as none at all), SPF without
  `include:amazonses.com`, duplicate SPF records and unpublished DKIM tokens

### Inbox logo (BIMI)

Set a logo URL under **Settings → Domain & DNS** and the `default._bimi` TXT
record joins the table and the zone file, with the recommended DMARC policy
raised to `p=quarantine` — BIMI is ignored below enforcement. The logo must be
SVG Tiny Portable/Secure, and Gmail, Yahoo and Apple Mail only render it when
the record's `a=` tag points at a VMC (needs a registered trademark) or CMC
certificate from DigiCert or Entrust; other providers show it without one.

## Data model

`users`, `sessions`, `login_tokens` · `projects`, `api_keys` · `contacts`,
`lists`, `list_members`, `suppressions` · `campaigns`, `transactionals` ·
`emails`, `email_events`.

Campaign sending is a two-stage queue: `campaign.start` pages through recipients
200 at a time writing `emails` rows, then each row is queued as `email.send`.
Retries are safe — a row that already has a provider message id is never sent
twice. A cron trigger starts scheduled campaigns every minute and prunes expired
sessions and login tokens.
