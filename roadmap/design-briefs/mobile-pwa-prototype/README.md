# Mobile PWA — interactive prototype (design source of truth)

Vendored from the P24 design package so the **Phase 24B** build has a durable, openable reference
instead of a file in someone's Downloads. This is the visual acceptance bar: a page is "done" when it
matches this prototype (and the [`mobile-pwa-design-spec.md`](../../mobile-pwa-design-spec.md) derived
from it).

## What's here
| File | What it is |
| --- | --- |
| `Mobile PWA.html` | **Interactive** prototype — full app inside an iOS bezel, with a **Tweaks panel** to flip states: online/offline, full/empty contact list, and the PWA install prompt (off/Android/iOS). |
| `Mobile PWA Overview.html` | **Static canvas** — every frame laid out as artboards (list, swipe-revealed, offline, empty, detail, new-contact sheet, keyboard-aware edit, import preview, export, install prompts, Activity/Sync/Settings). |
| `mob-kit.jsx` | Mobile primitives: headers, bottom nav, group headers, toast, offline banner, tokens (`MOB`, `MI` icons). |
| `mob-list.jsx` | Contact list + swipe-to-reveal rows + empty state. |
| `mob-detail.jsx` | Contact detail: centred header, action pills, Details/Sharing/History tabs, field cards, edit FAB. |
| `mob-sheet.jsx` | Create/edit **bottom sheet**: collapsible sections + keyboard accessory bar. |
| `mob-extra.jsx` | Import/export screen + PWA install prompt. |
| `mob-tabs.jsx` | Activity / Sync / Settings tab screens (`PlainHeader`, `GroupCard`, `NavRow`). |
| `mob-app.jsx` / `mob-canvas.jsx` | App wiring (interactive) / canvas layout (overview). |
| `cx-kit.jsx` | Shared tokens, `Avatar`/`Star`/`Badge`, sample `CONTACTS` data. |
| `ios-frame.jsx` | iOS bezel + simulated keyboard. |
| `tweaks-panel.jsx` | The state-toggle panel (interactive only). |
| `design-canvas.jsx` | Artboard layout chrome (overview only). |

## How to open
The HTML loads React + Babel from a CDN, so just open it in a browser (internet required):

```bash
open "roadmap/design-briefs/mobile-pwa-prototype/Mobile PWA.html"
# or serve the folder if file:// blocks the jsx fetches:
python3 -m http.server -d roadmap/design-briefs/mobile-pwa-prototype 8088
# then visit http://localhost:8088/Mobile%20PWA.html
```

## How to use it during the build
- Build each P24B ticket to match the corresponding frame here, pixel-faithfully (tokens, spacing,
  motion). Flip the Tweaks panel to confirm the **offline / empty / install** states too.
- This prototype only covers the **core PWA flows** (contacts, detail, create/edit, activity, sync,
  settings, import/export, install). For everything else — settings sub-pages, family/teams, merge,
  pricing, auth, and all the **plan/role/lifecycle variants** — follow the spec, which extends this
  language to the full route set.
