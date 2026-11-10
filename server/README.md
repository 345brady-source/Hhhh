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
| `PORTAL_ORIGIN` | Comma-separated origins allowed to call the API from the browser, for example `https://portal.example`. Empty allows any origin (development only). |
| `API_TOKEN` | When set, every `/v1/` call except `/v1/results` needs `Authorization: Bearer <API_TOKEN>`. |
| `RESULTS_TOKEN` | Turns on `POST /v1/results` and is the bearer token it requires. Unset, that endpoint answers 404. |
| `STORE_FILE` | Where records are kept (default `server/data/store.json`). |
| `RATE_LIMIT_PER_MIN` | Calls per minute per client for calls that create or change records (default 60; 0 turns it off). |
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
- `start` (identity and accreditation): either `link`, a URL template filled in without any API call, or `request` plus `response` (`url` required; `ref` is the provider's id, defaulting to our reference; `status` optional).
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
- Values placed in URLs are URL-encoded. `{settings.*}` and `{investor.*}` values used in a URL must look like ids (letters, digits and `_ . : @ + -`, up to 200 characters) or the call is refused.

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

## Security notes

- Secrets live only in environment variables. Definitions refer to them as `${env.NAME}`; their values are sent only to the provider and are scrubbed from error messages, never returned to the portal and never logged. `settings` from the portal are treated as non-secret plain values.
- SSRF guard: every connector URL must be https and name its scheme, host and port literally (no placeholders before the path, no credentials); after filling in, the host is checked again; redirects are not followed. `http://localhost` is accepted only with `ALLOW_HTTP_CONNECTORS=1`, for tests. The `link` provider's links are only filled in and handed to the investor's browser, never fetched.
- Templates are filled by name lookup only: no `eval`, no `Function`, no template literals over untrusted input.
- Adapter-private data (provider ids, tokens) stays on the server; the portal sees only normalized fields.
- Webhooks are verified over the raw bytes, timestamp-checked and de-duplicated; unsigned webhooks are refused.

Before production:

- Replace `API_TOKEN` with authenticated portal sessions (for example a signed session token checked in `authorize()` in `index.mjs`), so only signed-in sponsors and investors can start checks and only for their own records.
- Replace the JSON-file store (`lib/store.mjs`) with a real database, keeping the same methods.
- Serve over HTTPS (`PUBLIC_URL` must be https for providers to call back), set `PORTAL_ORIGIN`, keep `RATE_LIMIT_PER_MIN` on, and set `TRUST_PROXY=1` only behind your own proxy.
- Keep `RESULTS_TOKEN` long and random, and rotate it if it leaks.
