# Design: Investor portal

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: atmospheric
- Shape of the first page: app screen (every signed-in page, the wizards and the signing page are app screens)
- Theme: Refract (by request) · redesign: restyle · copy: verbatim
- Axes: light/grotesk-sans/cool · posture: restrained
- The theme's moving light is left out at the owner's request. The sign-in page alone carries an engraved plate beside the form (lathe-work lines, as on a share certificate), drawn in code in the firm's colors; a firm's own uploaded image takes its place.

## Tokens
`assets/css/tokens.css` is the source of truth, under this project's own names. The roles:
```css
:root {
  --bg: oklch(98.2% 0.006 95);  --surface: oklch(99.7% 0.004 95);  --surface-2: oklch(96.4% 0.006 95);  --surface-3: oklch(93.6% 0.008 95);
  --fg: oklch(23% 0.035 245);  --fg-2: oklch(36% 0.035 245);  --fg-3: oklch(50% 0.025 240);  --line: oklch(89.5% 0.008 230);
  --brand: oklch(50% 0.12 234);  --brand-ink: oklch(99% 0.003 95);  --focus: oklch(56% 0.14 234);
  --accent: oklch(74% 0.07 220);  --accent-soft: oklch(86% 0.05 212);
  --font-display: "Funnel Display", ui-sans-serif, system-ui, sans-serif;  --font-body: "Funnel Sans", ui-sans-serif, system-ui, sans-serif;
  --r-card: 22px;  --r-inner: 12px;  --r-pill: 999px;  --rule-hair: 1px;
  --shadow-card: 18px 28px 48px -26px oklch(52% 0.09 220 / 0.38), 2px 3px 6px -2px oklch(40% 0.05 230 / 0.12);
}
```
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`.

## White label
- `--brand*` is the theme's accent role and `--accent*` its shade role. `assets/js/brand.js` writes both per firm: a firm's primary color is the accent, its second color the shade and the tint of every shadow. A firm on the standard colors gets the theme's exact values.
- A firm's typeface, corner and header choices still apply; the Funnel faces and the theme's radii are the standard.
- The sponsor console is the product's own chrome: the same system in the standard palette, never a firm's colors (sponsor staff in the managed edition excepted).

## Type
- Display: `--font-display` at `--display-weight` (400; 300 for one figure at statement size), `--tracking-display`, sentence case, one color. Page titles, panel headings, headline figures.
- Body: `--font-body` 400. Labels, table heads and times are the body face at 500, a step smaller, sentence case, never tracked, never capitals. `tabular-nums` only where amounts align in a column (a firm's own typeface may set tabular figures much wider).
- Only weights 400 and 500 of the body face and 300, 400 and 500 of the display face are loaded. Nothing is set heavier.

## Surfaces
- Panels are clear: `--surface` with `--edge-light` and `--shadow-card`, radius `--r-card`, no border. One lead object a page may take `--shadow-cast`.
- Inside a panel there are no further boxes: hairline rules (`--line`), horizontal only, in tables and lists; radius `--r-inner` on wells.
- Dark: shadows off, each surface a step lighter than the one under it, edged by the inset hairline in `--edge-light`.

## Controls
- Primary: `--brand` under `--brand-ink` · pill · 40px (32px small), with a 44px hit target
- Secondary: `--surface` with `--edge-light` and a hairline · same radius and height
- Inputs: wells in `--surface`, edge `--line-strong`, radius `--r-inner`, the same height as the button beside them; the focus ring is an outline in `--focus`.
- Status is a pill at the right edge of its row. The accent marks the main action, the current tab and focus, nothing else.

## Motion
- Character: calm. State changes only, `--dur-micro` and `--dur-short` on `transform`, `opacity` and color; nothing on load; under reduced motion everything ends at once.

## Exports
`assets/css/tokens.css` in this project. Tailwind, DTCG or shadcn blocks are added here on request.
