# Integration server

A small Node server that does the provider work for automated investor verification in the portal: identity (KYC), sanctions and PEP screening (AML) and accredited investor verification. The portal runs in the browser and must never hold provider API keys, so it asks this server to start checks, and this server calls the providers, receives their webhooks and keeps the results.

No verification vendor is built in or recommended. You plug in the services you already use, in whichever of three ways suits each one, and you can connect more than one per check (for example one identity service for individuals and another for entities, or two screening services). The portal shows every provider plugged in here and lets you choose per check.

Built in, with no accounts needed:

| Id | What it is |
| --- | --- |
| `sandbox` | Simulated identity and accreditation checks for trying the flow. The investor picks the outcome on a test page. Not a real verification. |
| `link` | Sends the investor to a provider's hosted page using a link you paste into the portal. Results come back through the results API (below) or your own review. |
| `ofac` | Free screening against the U.S. Treasury's OFAC SDN and Consolidated sanctions lists, run on this server. Government data, not a vendor. U.S. sanctions only: no PEP or adverse media. |

The portal also offers options that need no server at all: upload for team review, team screening, and self-certification (Rule 506(b) offerings only).

Node 18 or later. No dependencies.

## Quick start

```sh
cd server
npm start                  # http://localhost:8787
npm test                   # node --test, no network needed
```

Then, in the portal, open Integrations and enter this server's URL.

| Variable | Meaning |
| --- | --- |
| `PORT` | Port to listen on (default 8787). |
| `PUBLIC_URL` | This server's public https URL, used to build webhook and return URLs (default `http://localhost:PORT`). |
| `PORTAL_ORIGIN` | Comma-separated origins allowed to call the API from the browser, for example `https://portal.example`. Empty allows any origin (development only). This server's own pages (`/sandbox/…`, `/hosted/…`) are not limited by it, so their forms can post back (see the API table). |
| `API_TOKEN` | When set, every `/v1/` call except `/v1/results` and the investor's invitation calls needs `Authorization: Bearer <API_TOKEN>`. Required for invitations. |
| `RESULTS_TOKEN` | Turns on `POST /v1/results` and is the bearer token it requires. Unset, that endpoint answers 404. |
| `STORE_FILE` | Where records are kept (default `server/data/store.json`). |
| `RATE_LIMIT_PER_MIN` | Calls per minute per client for calls that create or change records (POST, PUT, DELETE) and for invitation links that fail to authenticate (default 60; 0 turns it off). |
| `DATA_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts invitations, submissions, documents and the outbox at rest. Required for invitations. |
| `DATA_KEY_PREVIOUS` | The key `DATA_KEY` replaced, while you rotate: records sealed with it can still be read. |
| `ALLOW_PLAINTEXT_STORE` | `1` lets invitations work without `DATA_KEY` (stored unencrypted). For local testing only; `NODE_ENV=test` does the same. |
| `INVITE_DAYS` | How long an invitation link works (default 30). |
| `SUBMISSION_DAYS` | Days after completion that a submission the console has not imported is deleted, and after an invitation ends that the whole invitation is deleted (default 30). |
| `SMTP_HOST`, `SMTP_PORT` | Your mail server. Port 465 uses implicit TLS; any other port (587 by default) requires STARTTLS. Unset, messages go to the outbox instead. |
| `SMTP_USER`, `SMTP_PASS` | SMTP credentials (AUTH PLAIN or LOGIN, whichever the server offers). Never sent over an unencrypted connection. |
| `SMTP_ALLOW_PLAIN` | `1` allows a plain connection (for example port 25 to a relay on your own network). STARTTLS is still used when offered. |
| `SMTP_SECURE` | `1` or `0` to force implicit TLS on or off regardless of the port. |
| `SMTP_HELO` | The name sent in EHLO (default: the domain of `MAIL_FROM`). |
| `SMTP_TIMEOUT_MS` | How long to wait for the mail server at each step (default 20000). |
| `MAIL_FROM` | The address messages are sent from, for example `notices@yourfirm.com`. The display name is always the firm's name. |
| `MAIL_REPLY_TO` | Reply-To used when the firm has no support email in its brand settings. |
| `OUTBOX_DAYS` | How long outbox messages are kept, 1 to 365 days (default 30; any other value uses 30). |
| `TRUST_PROXY` | `1` to take the client address from `X-Forwarded-For` (only behind your own proxy). |
| `CONNECTORS_FILE` | Declarative connectors file (default `server/connectors.json`). |
| `PLUGINS_DIR` | Code plug-ins folder (default `server/plugins`). |
| `ALLOW_HTTP_CONNECTORS` | `1` allows `http://localhost` and `http://127.0.0.1` in connector URLs and links. For local tests only. |
| `OFAC_THRESHOLD` | Name-match score from 0 to 1 that counts as a potential match (default 0.9). |
| `OFAC_CONSOLIDATED` | `0` screens the SDN list only (default: SDN and Consolidated). |
| `OFAC_USER_AGENT` | User-Agent sent to the Sanctions List Service. |
| `OFAC_BASE_URL` | Alternative location for the OFAC list files (a mirror). |

Provider keys and webhook secrets are environment variables too: each connector or plug-in lists the ones it needs, and `GET /v1/connectors` reports which are missing (by name, never by value). Keep them in a `.env` file or your host's secret store, never in `connectors.json` or the portal.

## API

| Call | What it does |
| --- | --- |
| `GET /health` | `{ ok, providers }`: the ids of providers whose environment variables are all set. |
| `GET /v1/connectors` | The providers plugged in, for the portal (below). |
| `POST /v1/verifications` | Start an identity or accreditation check: `{ kind, provider, settings?, investor: { id, name, email?, ... }, returnUrl? }` → `{ id, status, url }`. Send the investor to `url`. |
| `GET /v1/verifications/:id` | `{ id, kind, provider, status, method, detail, expiresAt, screening, evidence, url, providerStatus, updatedAt }`, refreshed from the provider while pending. |
| `GET /v1/verifications/:id/evidence/:n` | A verification letter or certificate, fetched with the server's credentials. |
| `POST /v1/screenings` | Screen names: `{ provider, names: [...], settings?, investor? }` → `{ id, status, hits }`. |
| `GET /v1/screenings/:id` | `{ id, provider, status, hits, monitoring, providerStatus, updatedAt }`. |
| `POST /v1/results` | A provider or your own automation reports a result (below). |
| `POST /webhooks/:provider` | Provider callbacks, signature-checked. |
| `GET /return/:provider[/:id]` | Where providers send the investor back. |
| `GET` / `POST /hosted/:id`, `GET` / `POST /sandbox/:ref` | Pages this server hosts (a provider's flow, the sandbox stand-in) and the forms on them. Browsers post those forms with this server's own origin, or `null` (the pages are served with `Referrer-Policy: no-referrer`), so these routes skip the `PORTAL_ORIGIN` check. They take no token and are reached only through the check's unguessable id; every other route, the API included, still answers `PORTAL_ORIGIN` only. |
| `POST /v1/invitations` | Invite an investor; the link is emailed from the firm (below). |
| `GET /v1/invitations?workspace=` | Every invitation's status and current step. |
| `GET` / `DELETE /v1/invitations/:id/submission` | The finished paperwork; delete it once the console has imported it. |
| `POST /v1/invitations/:id/resend` / `cancel` | A new link (the old one stops working) / cancel the invitation. |
| `GET /v1/outbox` | Messages kept here when no SMTP server is set. |
| `GET /v1/invite`, `PUT /v1/invite/progress`, `POST /v1/invite/complete` | The investor's browser, with the link's token in `X-Invite-Token`. |

`GET /v1/connectors` answers:

```json
{
  "connectors": [
    { "id": "sandbox", "name": "Sandbox", "description": "...", "checks": ["identity", "accreditation"], "start": "simulated", "builtin": true, "configured": true, "missing": [] },
    { "id": "acmeid", "name": "Acme Verify", "description": "...", "checks": ["identity", "aml"], "start": "api", "builtin": false, "configured": false, "missing": ["ACME_WEBHOOK_SECRET"] }
  ]
}
```

`start` says how a check begins: `api` (the server creates a session and returns its link), `link` (the server fills in a link without calling the provider), `hosted` (a page on this server), `portal-link` (the built-in `link` provider: the sponsor pastes the link into the portal), `simulated` (sandbox) or `none` (screening only). No URLs, headers or secrets are included.

### Normalized statuses

| Check | Statuses |
| --- | --- |
| Identity | `pending`, `passed`, `review`, `failed` |
| Accreditation | `pending`, `verified`, `review`, `rejected` (with `expiresAt` as `YYYY-MM-DD` when verified) |
| Screening | `pending`, `clear`, `potential_match` (with `hits: [{ name, listed, list, score, detail }]`) |

When a provider reports a status that its mapping does not cover, the record keeps its current status, an `unmapped_status` event is logged and the provider's raw value is returned as `providerStatus` so an admin can see it and fix the mapping. `providerStatus` is empty whenever the latest value mapped cleanly.

An identity check that also screened sanctions and PEP lists returns that screening as `screening: { status: 'clear' | 'potential_match', hits }` on the verification.

## Plugging in a provider

Pick per provider; mix freely. Every id is 2 to 32 lower-case letters or digits and must be unique (the built-ins `sandbox`, `link` and `ofac` are taken). An invalid definition or a duplicate id stops the server at startup with a message naming the connector and every problem.

### 1. Declarative connector (most REST APIs)

Describe the provider's API in `server/connectors.json` (or the file `CONNECTORS_FILE` names). No code. `connectors.example.json` has three complete examples to copy; never commit your real `connectors.json` (it is git-ignored).

```json
{
  "connectors": [
    {
      "id": "acmeid",
      "name": "Acme Verify",
      "description": "Government ID and selfie check.",
      "checks": ["identity", "aml"],
      "env": ["ACME_API_KEY", "ACME_WEBHOOK_SECRET"],
      "auth": { "type": "bearer", "token": "${env.ACME_API_KEY}" },
      "start": {
        "request": {
          "method": "POST",
          "url": "https://api.acme.example/v1/sessions",
          "body": { "reference": "{reference}", "name": "{investor.name}", "email": "{investor.email}", "redirect_url": "{returnUrl}", "callback_url": "{webhookUrl}" }
        },
        "response": { "ref": "data.id", "url": "data.url", "status": "data.status" }
      },
      "result": {
        "request": { "method": "GET", "url": "https://api.acme.example/v1/sessions/{ref}" },
        "response": { "status": "data.status", "detail": "data.reason", "method": "data.method", "expiresAt": "data.expires_at", "screeningStatus": "data.watchlist.status", "screeningHits": "data.watchlist.matches" }
      },
      "screen": {
        "request": { "method": "POST", "url": "https://api.acme.example/v1/screenings", "body": { "names": "{names}", "reference": "{reference}" } },
        "response": { "ref": "id", "status": "status", "hits": "matches", "hit": { "name": "query", "listed": "matched_name", "list": "list", "score": "score", "detail": "notes" } },
        "monitoring": true
      },
      "screenResult": {
        "request": { "method": "GET", "url": "https://api.acme.example/v1/screenings/{ref}" },
        "response": { "status": "status", "hits": "matches" }
      },
      "webhook": {
        "verify": { "type": "hmac", "header": "X-Acme-Signature", "algorithm": "sha256", "encoding": "hex", "prefix": "sha256=", "secret": "${env.ACME_WEBHOOK_SECRET}" },
        "id": "id", "event": "type", "ref": "data.session_id", "status": "data.status", "detail": "data.reason", "hits": "data.matches"
      },
      "statuses": {
        "identity": { "approved": "passed", "declined": "failed", "needs_review": "review", "*": "pending" },
        "aml": { "no_match": "clear", "match": "potential_match", "processing": "pending" }
      }
    }
  ]
}
```

Fields:

- `checks`: any of `identity`, `accreditation`, `aml`.
- `env`: the environment variables it needs. Every `${env.NAME}` used anywhere must be listed.
- `auth` (optional): `bearer` `{ token }`, `basic` `{ username, password }`, `header` `{ name, value }`, `query` `{ name, value }` or `oauth2` `{ tokenUrl, clientId, clientSecret, scope?, audience?, style }` (client credentials; `style` is `form`, `json` or `basic`; the token is cached until shortly before `expires_in` and renewed once on a 401). The secret part must come from `${env.NAME}`.
- `start` (identity and accreditation): either `link`, a URL template filled in without any API call (it is handed to the portal, so it cannot use `${env.NAME}`), or `request` plus `response` (`url` required; `ref` is the provider's id, defaulting to our reference; `status` optional).
- `result` (optional): how to read the current result while a check is pending, and when a webhook asks for a re-read. Response paths: `status`, `detail`, `method`, `expiresAt`, `screeningStatus`, `screeningHits`.
- `screen` (aml): `request` plus `response` paths `ref`, `status`, `hits` and `hit` (paths inside each hit: `name`, `listed`, `list`, `score`, `detail`). `"monitoring": true` when the provider keeps re-screening and sends alerts.
- `screenResult` (optional): like `result`, for screenings that finish later.
- `webhook` (optional): `verify` (below) plus paths `ref` (required), `id`, `event`, `status`, `detail`, `method`, `expiresAt`, `hits`, `screeningStatus`, `screeningHits`, and `refetch: true` to re-read the result through `result`/`screenResult` instead of trusting the payload.
- `statuses`: per check, provider value → normalized status. Matching ignores case; `"*"` is the default; a value that is already a normalized status passes through; anything else is reported as `providerStatus`.
- Keys starting with `_` (and `$comment`) are ignored, for notes.

Templates:

- Placeholders: `{reference}` (our id, `ver_…` or `scr_…`), `{kind}`, `{ref}` (the provider's id), `{returnUrl}`, `{returnBase}`, `{webhookUrl}`, `{hostedUrl}`, `{investor.id|name|firstName|lastName|email|account|type|address|phone|workspace|offering}`, `{settings.<key>}` (non-secret values entered in the portal, such as a level or workflow id), `{names}` (screening) and `${env.NAME}`.
- A JSON body is a template: a string that is exactly one placeholder takes the raw value (so `"{names}"` becomes an array); other strings are filled in as text. `request.form` sends a form-encoded body instead.
- Response and webhook paths are dot paths with numeric indexes: `data.attributes.status`, `items.0.id`; `$` is the whole reply.
- Values placed in URLs are URL-encoded. `{settings.*}` and `{investor.*}` values used in a URL must look like ids (letters, digits and `_ . : @ + -`, up to 200 characters) or the call is refused. A value of `.` or `..` is refused in any URL, so it cannot move a call to another path on the provider's API.
- URL templates cannot contain line breaks or other control characters, and must name a host.

### 2. Hosted link plus the results API (no API integration)

For a provider that gives you a hosted page or invitation link, or a service you run yourself:

1. In the portal, choose **Provider link** for the check and paste the link, for example `https://verify.acme.example/start?ref={reference}&email={investor.email}&return={returnUrl}`. Allowed placeholders: `{reference}`, `{kind}`, `{returnUrl}` and `{investor.id|name|firstName|lastName|email|account|type|phone|workspace|offering}`; values are URL-encoded. The link must be https and spell out its host. The server never fetches it and server environment values are never available to it.
2. The investor completes the provider's flow and returns to `{returnUrl}`, which links back to the portal.
3. The provider (through its own webhook-to-HTTP feature), a small script of yours, or an automation tool reports the outcome:

```sh
curl -X POST https://verify.yourfirm.example/v1/results \
  -H "Authorization: Bearer $RESULTS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "reference": "ver_8yQ2...", "status": "passed", "method": "Passport", "detail": "Document and selfie match" }'
```

Body: `reference` (`ver_…` or `scr_…`), `status` (one of the record's normalized statuses, otherwise 400), and optionally `method`, `detail`, `expiresAt` (`YYYY-MM-DD`), `evidence` (`[{ type, label, url? }]`, https links only), `screening` (`{ status: 'clear' | 'potential_match', hits }`) for verifications, or `hits` for screenings. Answers `{ ok: true, id, status }`. The results API works for records of any provider, so you can also use it to report outcomes your team decided elsewhere. Without `RESULTS_TOKEN` it is switched off (404).

If nothing reports back, the check stays pending and the sponsor can approve or decline it by hand in the portal.

### 3. Code plug-in (anything the declarative form cannot express)

Request signing, webhooks signed as JWTs or with public keys, OAuth authorization-code flows, a provider's JS SDK on a page this server hosts, multi-step sessions: write a module. Copy `plugins/_template.mjs` to `plugins/<id>.mjs` and restart. Files starting with `_` or `.` are skipped. The adapter interface (`createSession`, `fetchResult`, `handleReturn`, `returnRecordId`, `page`, `hostedPost`, `fetchEvidence`, `screen`, `fetchScreening`, `verifyWebhook`, `parseWebhook`, `webhookResult`) is documented at the top of `providers/index.mjs`.

```js
// plugins/acmesign.mjs
import { createHmac } from 'node:crypto';
import { requestJson } from '../lib/request.mjs';
import { safeEqual } from '../lib/crypto.mjs';
import { header } from '../lib/http.mjs';

export const name = 'Acme Sign';
export const kinds = ['accreditation'];
export const env = ['ACME_KEY', 'ACME_SECRET'];

const call = (ctx, method, path, body) => {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', ctx.env.ACME_SECRET).update(ts + method + path + (body ? JSON.stringify(body) : '')).digest('hex');
  return requestJson(ctx, 'https://api.acme.example' + path, { method, body, label: name, redirect: 'manual', headers: { 'X-Key': ctx.env.ACME_KEY, 'X-Ts': ts, 'X-Sig': sig } });
};

export async function createSession(ctx) {
  const r = await call(ctx, 'POST', '/requests', { reference: ctx.reference, email: ctx.investor.email, return_url: ctx.returnUrl });
  return { ref: r.id, url: r.url, status: 'pending' };
}
export async function fetchResult(ctx) {
  const r = await call(ctx, 'GET', `/requests/${encodeURIComponent(ctx.ref)}`);
  return { status: { accredited: 'verified', declined: 'rejected' }[r.state] || 'pending', expiresAt: r.expires_on };
}
export const verifyWebhook = ({ rawBody, headers, env }) =>
  safeEqual(String(header(headers, 'x-sig') || ''), createHmac('sha256', env.ACME_SECRET).update(rawBody).digest('hex'));
export const parseWebhook = ({ body }) => ({ id: body.event_id, ref: body.request_id, event: body.type, refetch: true });
```

Testing a plug-in without the network: `loadProviders({ env, pluginsDir })` loads a folder into a registry, and `createServer({ providers, fetch, store })` takes that registry and an injected `fetch`. `test/connectors.test.mjs` ("code plug-ins load from a folder") does exactly this.

## Webhooks

Point the provider at `PUBLIC_URL/webhooks/<id>`. Deliveries are checked over the exact bytes received, compared in constant time, refused when their timestamp is outside `tolerance` seconds (default 300), and de-duplicated by delivery id (`idHeader`, or the `id` path). Declarative `verify` covers the common schemes:

| Scheme | `verify` |
| --- | --- |
| HMAC of the body in a header, hex or base64, optional prefix | `{ "type": "hmac", "header": "X-Signature", "algorithm": "sha256", "encoding": "hex", "prefix": "sha256=", "secret": "${env.SECRET}" }` |
| Timestamped header `t=<ts>,v1=<sig>` (several `v1` values accepted during secret rotation) | `{ "type": "hmac", "header": "Acme-Signature", "pattern": "v1=([0-9a-f]+)", "timestampPattern": "t=(\\d+)", "signed": "{timestamp}.{body}", "secret": "${env.SECRET}" }` |
| Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64> ...`) | `{ "type": "hmac", "header": "webhook-signature", "pattern": "v1,([A-Za-z0-9+/=]+)", "encoding": "base64", "secret": "${env.SECRET}", "secretEncoding": "base64", "idHeader": "webhook-id", "timestampHeader": "webhook-timestamp", "signed": "{id}.{timestamp}.{body}" }` (a `whsec_` prefix on the secret is stripped) |
| Algorithm named in another header | `{ "type": "hmac", "header": "X-Signature", "algorithmHeader": "X-Signature-Algorithm", "secret": "${env.SECRET}" }` (sha1, sha256 or sha512) |
| Provider cannot sign: secret token in the webhook URL | `{ "type": "token", "param": "token", "secret": "${env.TOKEN}" }`, with the webhook URL `PUBLIC_URL/webhooks/<id>?token=...`. The payload is never trusted: the result is always re-read through `result`/`screenResult`, which are then required. |

Other options: `algorithm` sha1, sha256 or sha512; `encoding` hex, base64 or base64url; `secretEncoding` utf8, base64 or hex; `signed` is the signed message built from `{body}`, `{timestamp}` and `{id}`. `"type": "none"` is refused. Schemes beyond these (public-key or JWT signatures) need a code plug-in.

Rules that keep these checks meaningful:

- A timestamp only protects against replays when it is signed, so `timestampHeader` or `timestampPattern` requires `{timestamp}` in `signed`.
- Duplicates are dropped by a delivery id the signature covers: the `idHeader` value when `signed` includes `{id}`, otherwise the `id` path in the body. When `idHeader` is set but not signed and the body has no `id`, a hash of the exact body is used instead, so a replay with a changed header is still a duplicate.
- `pattern` and `timestampPattern` run on headers anyone can send, before the signature is checked. They must be simple: a capture group around the value, no repeated groups such as `(a+)+`, no back-references or look-arounds, at most four quantifiers. They run with a 50 ms limit on signature headers of up to 2 KB.
- Deliveries for a provider whose environment variables are not all set (an empty webhook secret, say) are refused.

## Investor invitations

The sponsor enters a few details in the console; this server emails the investor one link; the link walks the investor through every onboarding step on any device (login, investor information, identity and accredited investor verification, tax certification, distribution payments, subscription and the e-signed subscription agreement); the sponsor is emailed when it is finished; and the console imports everything into the investor's record. Everything the investor sees carries the firm's brand only.

How it fits together:

1. The console sends `POST /v1/invitations` with a snapshot of what the investor's onboarding needs (the firm's brand, the investor's basics, the offering with its documents, the subscription agreement template and PDF, and the non-secret verification settings).
2. This server creates a token (32 random bytes, returned once; only its SHA-256 is stored), builds the link `<portalUrl>?server=<this server's PUBLIC_URL>#invite-<token>` and emails it from the firm.
3. The investor's browser calls `GET /v1/invite` with `X-Invite-Token: <token>`, reports each step with `PUT /v1/invite/progress`, starts its own identity and accreditation checks and screening on `/v1/verifications` and `/v1/screenings` with the same header, and finishes with `POST /v1/invite/complete`. The sponsor is emailed.
4. While the console is open it polls `GET /v1/invitations`, fetches each finished submission, merges it into the workspace and deletes it here.

**Publishing the portal for invitations.** An investor's link opens the firm's portal page with `?server=<this server>`. The page loads invitations only from servers it trusts, so a link cannot make the firm's page collect an investor's details for someone else's server. List this server on the page where the portal is published, before its scripts:

```html
<script>window.CVPortalConfig = { integrationServers: ['https://verify.yourfirm.example'] };</script>
```

A server on the same origin as the portal page needs no listing. Until the server is listed, links open only in the sponsor's own browser (the console's invite panel shows the exact line to add).

**Investors already on file.** When the console invites an active investor to another offering, the snapshot says so (`investor.existing`, `invitation.existing`): the email invites them to subscribe without asking for ID or bank details, the link covers only the subscription (plus accredited investor verification when that offering needs it and theirs is not current), and the console keeps the investor's record on file, taking only what the link collected.

**Portal links.** For an investor the firm added from paper documents, the console can send a link that only opens their portal (`invitation.existing` with `invitation.access`, and no offering): the email says their account is already set up ("<firm>: your investor portal"), the link asks for nothing but a login, the firm is told when they open it, and no deletion reminder is sent.

### Sponsor calls (API_TOKEN)

`POST /v1/invitations` (body up to 32 MB):

```json
{
  "workspace": "tenant-id",
  "sendEmail": true,
  "portalUrl": "https://portal.example/portal.html?tenant=tenant-id",
  "consoleUrl": "https://portal.example/portal.html?tenant=tenant-id#console-investors",
  "notifyEmail": "ops@yourfirm.example",
  "firm": { "name": "", "shortName": "", "legalName": "", "supportTeam": "", "supportEmail": "", "supportPhone": "", "colors": { "primary": "#0F2742", "accent": "#1F7A8C" }, "logo": "data:image/png;base64,...", "portalName": "", "disclaimer": "", "onboarding": {} },
  "investor": { "id": "INV-0007", "contact": "Ann Lee", "title": "Ann Lee", "type": "individual", "email": "ann@example.com", "existing": { "accredited": true, "accreditedUntil": "2027-03-01", "holds": false } },
  "offering": { "id": "", "name": "", "shortName": "", "type": "", "summary": "", "minimum": 0, "closeDate": "", "terms": [], "exemption": "Rule 506(c)", "classes": [], "currency": "USD", "documents": [{ "id": "", "title": "", "fileName": "ppm.pdf", "base64": "..." }] },
  "invitation": { "cents": 25000000, "cls": "A", "note": "", "senderName": "", "existing": true, "expiresAt": "2026-12-10T00:00:00Z" },
  "verification": { "connections": [], "use": {}, "rules": {} },
  "esign": { "template": { "title": "", "roles": [], "fields": [], "pages": 1, "pageSizes": [], "sha256": "" }, "pdf": "base64..." }
}
```

`investor.existing` and `invitation.existing` are only for an investor already on the firm's books (leave them out otherwise): the server keeps the two flags and the date, nothing else. → `{ id, token, link, emailStatus, emailError?, expiresAt }`. `emailStatus` is `sent`, `outbox` (no SMTP server set), `failed` (with `emailError`; the link still works and can be sent another way) or `not_sent` (`sendEmail: false`). Limits: logo 600 KB, offering documents 10 MB together (at most 20), agreement PDF 10 MB. `portalUrl` and `consoleUrl` must be valid http(s) addresses (otherwise 400, and nothing is stored), on `PORTAL_ORIGIN` when it is set. The link lives `INVITE_DAYS` (or until `invitation.expiresAt`, if sooner). `consoleUrl` defaults to the portal page with `#console-investors`; it is the link in the sponsor's notification.

`GET /v1/invitations?workspace=…` → `[{ id, workspace, investorId, contact, email, offeringId, status, stepKey, stepLabel, stepIndex, stepCount, sentAt, openedAt, completedAt, cancelledAt, expiresAt, emailStatus, emailError, notifyStatus, hasSubmission, importedAt, events }]`, newest first. `status` is `sent`, `opened`, `in_progress`, `completed`, `cancelled` or `expired`. `events` lists the last 50 changes as `{ at, kind }` with `kind` `invite_opened`, `invite_progress` (with the step), `onboarding_completed`, `invite_resent`, `invite_cancelled` or `invite_expired`. `GET /v1/invitations/:id` is one entry.

`GET /v1/invitations/:id/submission` → `{ invitationId, investorId, completedAt, investor, request, envelope, files: { <docId>: base64 PDF, PNG or JPEG }, docs, audit, notifications, checks }`. `DELETE` it once imported (`{ ok, deleted }`). What this server corrects before storing it is under "What the server vouches for" below; `checks` is `{ identity, accreditation, aml: { status, confirmed, unconfirmed? }, decision }`, where `confirmed` means one of this server's own checks stands behind the status.

`POST /v1/invitations/:id/resend` (`{ sendEmail?, portalUrl? }`) issues a new token and link, restarts the `INVITE_DAYS` clock, keeps the investor's progress and emails the investor again; the earlier link stops working. Refused (409) once completed or cancelled. `POST /v1/invitations/:id/cancel` ends it; the link then answers 410.

### Investor calls (X-Invite-Token)

The token in the link authorizes only these calls, for that invitation's investor:

| Call | What it does |
| --- | --- |
| `GET /v1/invite` | The snapshot (firm, investor, offering with documents as base64, invitation terms, verification settings, agreement template and PDF, current step) without the sponsor's notification address. The first call marks the invitation opened. |
| `PUT /v1/invite/progress` | `{ stepKey, stepLabel, stepIndex, stepCount }`. |
| `POST /v1/invite/complete` | `{ investor, request, envelope, files: { <docId>: base64 PDF, PNG or JPEG }, docs, audit, notifications }`. `files` holds only what this submission produced (see "What the server vouches for"): the envelope's copies, which must be PDFs, and the investor's own uploads for the firm to review (PDF, PNG or JPEG), checked by their first bytes; 25 MB together, body 40 MB. Any other file is dropped without failing the submission. `investor.id` must be the invited investor; `request.offeringId` must be the invited offering and, when the sponsor set a commitment, `request.cents` must be that commitment (otherwise 400). Answers `{ ok: true }` (`already: true` on a repeat) and emails the sponsor once. A cancel or resend that lands while the body uploads wins (410 or 401). |
| `POST /v1/verifications`, `GET /v1/verifications/:id` | As for the console, but only for the invited investor in the invitation's workspace (another investor's id or check, or the same id in another workspace, is refused with 403). |
| `POST /v1/screenings`, `GET /v1/screenings/:id` | The same. |

An unknown token answers 401; an expired or cancelled invitation answers 410 with a message naming the firm. The invitation token is refused (401) on every other route, including the sponsor's, even when sent together with `API_TOKEN`.

### What the server vouches for

From an investor's link (`X-Invite-Token`) the server runs only the checks the firm's own settings use for each check: the providers behind the connections in the snapshot's `verification.use` (a server connector, a hosted link, the OFAC lists). The test sandbox runs in the investor's browser and is never run here for an investor unless the firm set it up as a server connector. Every screening started from the link includes the investor's names as the sponsor entered them, whatever names the page sends. Checks started from the link are linked to their invitation; a check started by the console counts for an invitation only when it was created after the invitation (with ten minutes' allowance for clock differences), with a provider the firm uses for that check.


Everything in a submission comes from the investor's browser, so before it is stored and summarized for the sponsor:

- **Verification results** are taken from this server's own checks for this invitation: the same investor id and workspace, created at or after the invitation was created. This server keeps every check it ran, so an older one, even the investor's own, confirms nothing. An identity or accreditation result whose `ref` names one of them takes that check's status, method and expiry, and its dates: `completedAt` (when the result arrived) and, for a verified accreditation, `verifiedAt` (that day). The console limits a verified accreditation to the firm's validity period counted from `verifiedAt`, a date the browser did not choose. An expiry the browser sent is never kept. A result whose `ref` names a check that does not count loses that `ref` (and `remote`), so the console never looks the other check up later. A better result than the investor could report about themselves (anything but not started, pending, review, failed, rejected or submitted) with no such check is changed to `review`, with `reportedStatus` and a note. The sponsor's email says "Needs your review" for a provider's result, and "To be confirmed" for self-certified accreditation and sandbox results, which never have a server record: the console applies the firm's rules to those when it imports the submission. A sanctions result takes its screening's status, hits and date (`screenedAt`); one that does not name a screening of this invitation (including a pending one that names another screening) is set back to `pending` with no reference, so the console screens the investor again. An `approved` decision or a cleared KYC status that the confirmed results do not support is held for review; one they do support is rewritten as this server's own (time now, by automatic), never the browser's. A match the browser reports with no screening here behind it is held as a potential match for the firm to review, never folded into clear. A confirmed check carries the record's facts only (status, method, dates); the browser's notes on it are dropped. `investor.verify` is always present.
- **Check dates.** Verification and screening records carry `createdAt` and, once a result arrives, `completedAt`. `completedAt` is set when the status changes, so a repeated webhook or results call cannot make an old result look new. Records stored before `completedAt` was kept are dated from `createdAt`, the earliest the result can be.
- **The agreement.** Only the firm countersigns: a countersigner marked signed is reset to waiting, and an envelope marked completed goes back to `sent` unless the snapshot's template has investor roles only. The sponsor's email never says countersigned.
- **Files** are kept only when the submission produced them: the envelope's work copy `<envelope id>-work` and, for a completed envelope, its signed copy `<envelope id>-signed` (both PDFs, the names the portal's e-signature gives them), and the investor's own uploads that their verification record names (`kyc-<investor id>-…`; accreditation only for an investor already on file). Anything else, such as the firm's agreement template that earlier versions of the portal also sent, another envelope's copies or a document of the browser's own, is dropped without failing the submission.
- **Document listings.** `docs` keeps at most one entry: the listing of the signed copy of a completed agreement, when that copy came with the submission. It is rebuilt from its title, file name and date, for this investor alone (`audience: 'investors'`, `investors: [<investor id>]`), so a listing from the browser can never reach other investors or pass as an offering document.
- **The commitment and offering** the sponsor set on the invitation are enforced (see `POST /v1/invite/complete`); an investor with no offering on the invitation cannot submit a subscription. When the sponsor set no commitment, the investor's amount must be a positive whole number of cents and at least the offering's minimum (400 otherwise); the console checks the share class minimum again when it imports.
- **The sponsor's email** uses the investor's name and email from the invitation; other values from the browser (account name, investing as) are kept to one short line.

## Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` to send through your own mail service (any provider that offers SMTP submission). The client is built in (no dependencies): implicit TLS on 465, STARTTLS required on other ports (a server that does not offer it is refused unless `SMTP_ALLOW_PLAIN=1`), certificate checks on, credentials only over TLS, AUTH PLAIN or LOGIN, timeouts at every step, and replies sent before a STARTTLS upgrade are discarded.

Every message is the firm's: `From: "<firm name>" <MAIL_FROM>`, `Reply-To:` the firm's support email (or `MAIL_REPLY_TO`), a plain-text and an HTML part (`multipart/alternative`, with the firm's logo inline when it is a PNG, JPEG or GIF), the firm's colors, legal name and disclaimer, and nothing naming this software. Headers carry `Date`, `Message-ID` and `MIME-Version`; non-ASCII names and subjects are sent as UTF-8 encoded-words; bodies are quoted-printable with lines under 76 characters; lines starting with a dot are dot-stuffed. Use a `MAIL_FROM` on a domain whose SPF and DKIM records cover your mail service.

Four messages are sent: the invitation (who invited them, the offering and commitment, the personal note, what they will need, the link and its expiry), the resent invitation, and the sponsor's notification when an investor finishes (who, the offering, the commitment, identity, screening and accreditation status, the agreement status, what to do next and a link to the console; never bank details or tax ids). The fourth is a reminder to the sponsor, sent once a week before a finished onboarding the console never imported is deleted ("Waiting in your console: <name>'s onboarding", with the date it will be deleted). For an investor already on file, the invitation and the resent invitation invite them to subscribe ("<offering>: your subscription") without asking for ID or bank details. The sponsor's notification shows the accreditation and agreement only, and says that the subscription, signed agreement and any new accreditation result are added while the details the console already holds stay as they are. The reminder speaks of their subscription too ("Waiting in your console: <name>'s subscription"): without the console, the investor would have to submit their subscription again.

Without `SMTP_HOST`, messages are kept, encrypted, in an outbox: `GET /v1/outbox?workspace=…&invitation=…` (API_TOKEN) → `{ messages: [{ id, at, kind, invitationId, workspace, from, to, toName, replyTo, subject, text, html }] }`. Outbox messages carry live links, so they are deleted after `OUTBOX_DAYS`.

## Data protection

Invitations hold investors' personal details, bank details and signed documents, so:

- **Encryption at rest.** Snapshots, submissions, outbox messages and the investor's details on verification and screening records (name, email, address, phone, the names screened) are sealed with AES-256-GCM using `DATA_KEY`, each with a fresh IV and the record id and field bound in as additional data (a sealed value cannot be moved to another record). Offering documents, the agreement PDF and signed PDFs are kept as sealed files in `<STORE_FILE>.blobs/`. The store file keeps only what the console's list needs in plain form: ids, statuses, steps and times. Email addresses quoted in a mail server's refusal are replaced with `[address]` before the error is stored. Without `DATA_KEY` the invitation routes answer 400 (`Set DATA_KEY on the integration server`) unless `NODE_ENV=test` or `ALLOW_PLAINTEXT_STORE=1`. To rotate, set the new key as `DATA_KEY` and the old one as `DATA_KEY_PREVIOUS`.
- **Tokens.** 32 random bytes, returned once to the console (in the link) and never stored; the server keeps their SHA-256 and compares every stored hash in constant time on each lookup. Resend replaces the token. Links expire after `INVITE_DAYS`.
- **What is deleted, and when.** A submission is deleted when the console deletes it after importing (it does so straight away), or automatically `SUBMISSION_DAYS` (30) after completion if it was never imported; the sponsor is emailed a reminder a week before that (half-way when `SUBMISSION_DAYS` is 7 or less). The whole invitation (snapshot, documents and record) is deleted `SUBMISSION_DAYS` after it ends: completed, cancelled or expired. Outbox messages are deleted after `OUTBOX_DAYS`. Deletion runs every hour and on requests.
- **Scope.** The invitation token reaches only its own investor's onboarding, verifications and screenings (the same investor id in the same workspace). Sponsor routes need `API_TOKEN`, which invitations require to be set.
- **Limits.** Request bodies are capped per route (32 MB to create, 40 MB to complete, 16 KB for small calls) and oversized bodies answer 413. Writes and failed tokens are rate limited.

## Security notes

- Secrets live only in environment variables. Definitions refer to them as `${env.NAME}`; their values are sent only to the provider and are scrubbed from error messages, never returned to the portal and never logged. `settings` from the portal are treated as non-secret plain values.
- SSRF guard: every connector URL must be https and name its scheme, host and port literally (no placeholders before the path, no credentials); after filling in, the host is checked again; redirects are not followed. `http://localhost` is accepted only with `ALLOW_HTTP_CONNECTORS=1`, for tests. The `link` provider's links are only filled in and handed to the investor's browser, never fetched.
- Templates are filled by name lookup only: no `eval`, no `Function`, no template literals over untrusted input.
- Adapter-private data (provider ids, tokens) stays on the server; the portal sees only normalized fields.
- Webhooks are verified over the raw bytes, timestamp-checked and de-duplicated; unsigned webhooks are refused.
- `GET /hosted/:id` never redirects to a link the portal supplied (the `link` provider), so this server's domain cannot be used as an open redirect.
- Error messages are scrubbed of every secret, raw, URL-encoded or inside base64 (for example a basic-auth `user:password` echoed back by a provider).
- Invitations: personal data encrypted at rest with `DATA_KEY`, tokens stored only as hashes, links scoped to one investor, submissions deleted after import (see Data protection). SMTP credentials are never sent unencrypted or included in error messages.

Before production:

- Replace `API_TOKEN` with authenticated portal sessions (for example a signed session token checked in `authorize()` in `index.mjs`), so only signed-in sponsors and investors can start checks and only for their own records.
- Replace the JSON-file store (`lib/store.mjs`) with a real database, keeping the same methods (blobs can go to object storage; keep them sealed). With a database, look invitations up by an index on the token hash.
- Set `DATA_KEY` from your secret store and back it up: sealed records cannot be read without it.
- Serve over HTTPS (`PUBLIC_URL` must be https for providers to call back), set `PORTAL_ORIGIN`, keep `RATE_LIMIT_PER_MIN` on, and set `TRUST_PROXY=1` only behind your own proxy.
- Keep `RESULTS_TOKEN` long and random, and rotate it if it leaks.
