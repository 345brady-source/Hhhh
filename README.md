# Carrow & Vale Investor Portal

A white-label investor portal for Carrow & Vale Shareholder Advisors. One build serves any number of client firms. Each client's investors see only that firm: its logo, colors, typeface, domain, support team and disclosures. They never see the Carrow & Vale name unless the client turns on "Powered by".

It is a static app with no build step. Open `index.html` through any static file server.

```sh
python3 -m http.server 8000
# http://localhost:8000/?tenant=kestrel-bay
```

## What investors get

| Page | What it covers |
|---|---|
| Overview | Capital account balance, commitment, contributed, distributions, unfunded, TVPI/DPI, a capital account chart, the quarter's rollforward, new documents, upcoming dates and the firm's latest letter |
| Investments | Allocation by capital account and per-position commitments, cash flows, TVPI, DPI and net IRR |
| Calls & distributions | The open capital call with a wire-fraud warning, call history, distributions by quarter and payment history |
| Documents | Searchable vault of reports, statements, tax documents, notices and legal documents. Previews render on the client's letterhead |
| Tax center | K-1 status by year and tax-season support |
| Messages | Secure messages with the firm's investor relations team. Replies are signed by the firm |
| Opportunities | New offerings for existing investors, with a call request to a Series 7 and Series 63 registered representative |
| Profile | Investor details, accreditation, distribution account, security, notifications, authorized users, appearance |
| Sign-in | Branded sign-in with a 2-step verification step |

## How white-labeling works

Everything client-specific lives in one config object per client in `assets/js/tenants.js`. `assets/js/brand.js` turns it into a complete set of CSS custom properties for light and dark mode.

- **Two colors in, full palette out.** From the primary and accent colors the engine derives neutrals tinted toward the brand hue, hover and tint states, navigation colors, chart colors and a separate dark palette.
- **Contrast is guaranteed, not hoped for.** When a brand color is too light or too dark to read as text, the engine uses a deeper or brighter step of the same hue (OKLCH lightness) until it meets WCAG AA. Buttons and fills keep the exact brand color. Brand Studio shows each check.
- **Logo.** Upload a PNG/SVG/JPG/WebP, or use a generated mark (monogram, wing, ridge, wave, arch) drawn in the client's colors. The favicon is generated to match.
- **Type and shape.** Four type pairs (Manrope; Source Serif with Source Sans; IBM Plex Sans; Libre Franklin) and three corner styles.
- **Features.** Capital calls, tax center, messaging and opportunities can be turned off per client.
- **Which client loads.** `?tenant=<id>`, then the request hostname matched against each client's `domain`, then the last client opened in Brand Studio.

### Brand Studio

The floating "Brand Studio" button opens the Carrow & Vale operator panel. It always wears Carrow & Vale's own branding so it can't be mistaken for part of a client portal. Use it to switch between clients, create a new one, and edit identity, logo, colors, type, layout, features, support details and disclosures. Changes apply live and are saved in the browser. "Copy JSON" exports the finished config for engineering to add to `tenants.js`.

Brand Studio is a demo and onboarding tool. In production, gate it behind staff authentication or remove `studio.js` from client deployments.

### Client config

```js
{
  id: 'kestrel-bay',
  name: 'Kestrel Bay Capital',            // full firm name
  shortName: 'Kestrel Bay',               // logo wordmark and running copy
  tagline: 'Capital',                     // small line under the wordmark
  legalName: 'Kestrel Bay Capital Management, LLC',
  portalName: 'LP Portal',
  domain: 'investors.kestrelbaycap.com',
  logo: { type: 'wing', letters: 'KB', image: '', plate: false },
  colors: { primary: '#14304F', accent: '#B4873F' },
  font: 'serif',                          // manrope | serif | plex | franklin
  radius: 'soft',                         // sharp | soft | round
  nav: 'brand',                           // brand | light
  appearance: 'system',                   // system | light | dark
  modules: { capitalCalls: true, tax: true, messages: true, opportunities: true },
  showPoweredBy: false,
  support: { team, email, phone, hours, response },
  disclaimer: '…',
  signin: { headline, sub },
  funds: [{ name, short, vintage, strategy }, …],
  letter: { title, excerpt },
  offering: { name, short, target, minimum, firstClose, strategy, highlights: [] }
}
```

Missing fields fall back to `TENANT_TEMPLATE`, which uses Carrow & Vale's default navy and teal.

## Sample data

Kestrel Bay Capital, Ashwell Ridge Real Estate and Greywater Infrastructure Partners are fictional firms. The investor, Jordan Davis of the Davis Family Trust, is a sample. All figures come from `assets/js/data.js` and reconcile: each quarter's rollforward, the chart series, the tables and the statements are computed from the same cash flows. In production, replace `NS.buildData` with calls to the fund administrator's data feed.

Placeholders such as "[Regulatory disclosures to be provided by counsel.]" are intentional and match the Carrow & Vale site.

## Files

```
index.html               entry point
assets/css/portal.css    portal styles and default tokens
assets/css/studio.css    Brand Studio styles (Carrow & Vale identity)
assets/js/brand.js       white-label engine: color math, token derivation, logos
assets/js/tenants.js     client configs
assets/js/data.js        sample investor data
assets/js/charts.js      SVG line and column charts
assets/js/documents.js   letterhead document previews
assets/js/studio.js      Brand Studio
assets/js/app.js         shell, routing and pages
```
