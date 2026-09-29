# study-site-core

Shared CSS/JS engine and content renderer for the MatSciEng module study sites
([eg182](https://github.com/ayquresh23/eg182), [ega110](https://github.com/ayquresh23/ega110),
[eg184](https://github.com/ayquresh23/eg184), [eg2004](https://github.com/ayquresh23/eg2004)).

Previously each module site carried its own full copy of the nav/mode/glossary/
flashcard/progress engine and stylesheet, hand-edited per site. That let copies
drift out of sync (older sites were missing features newer ones had) and made a
shared bug fix, feature, or style change a 4-way manual edit. This repo is the
single source of truth those sites now load over CDN instead.

## What's here

- **`css/base.css`** — the shared stylesheet. `--accent` is a CSS custom
  property each site overrides with a small inline `<style>` block in its own
  `index.html`, so every site keeps its own accent color on a shared base.
- **`js/engine.js`** — the nav/mode/glossary/flashcard/progress engine. Reads
  all previously-hardcoded per-site values (topic IDs, colors, labels,
  localStorage keys) from a `window.SITE_CONFIG` object each site defines
  inline before loading this script.
- **`js/render.js`** — a generic content renderer. Turns a `window.SITE_CONTENT`
  JSON object into the same markup the sites used to hand-write directly in
  their `index.html`. Content block schema is documented in the file header.

## How a site uses this

Each module site's `index.html` is now a thin shell: nav markup, an empty
`#app` div, and inline `<script>` blocks defining that site's `SITE_CONFIG`
and `SITE_CONTENT` (and `glossaryData`, if it has a glossary), followed by
`<script src=".../render.js">` and `<script src=".../engine.js">` loaded from
this repo via jsdelivr's GitHub CDN — `render.js` first, since it must render
the DOM before `engine.js`'s `DOMContentLoaded` init logic runs.

## Migration

All existing hand-written content across all four sites was converted from
static HTML into the JSON content schema, verified with an automated
content-loss check (`tools/verify.js` in this migration's working set — not
committed here) that renders both the original and the new JSON-driven page
in jsdom and diffs their visible text token-for-token, so nothing was lost
silently in the conversion.

## Subpages

Every topic is automatically split into one page per `h2` heading. A dot pager (in the site's accent colour) sits at the bottom of the screen, with previous/next arrows, a "3 / 9" counter and the page title. Anything before the first `h2` becomes an "Overview" page. Revise mode shows every page at once and hides the pager. Arrow keys step through pages, then on to the next section. URLs look like `#t2/3`, and links to any element id inside a topic (contents lists, cross references) open the right page. The pager has a "One page" button that switches to the original single long page (remembered per site in localStorage); a "Split into pages" button brings the pager back. Set `subpages: false` in `SITE_CONFIG` to turn it off for a site.
