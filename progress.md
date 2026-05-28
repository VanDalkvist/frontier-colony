Original prompt: Сделать отдельный проект colony sim lite на основе процедурной карты и довести его до first playable.

2026-04-17
- Started runtime bug investigation for report: "карта не работает".
- Debug plan: reproduce symptom from live localhost page, capture runtime evidence, isolate root cause before patching.

- Root cause identified: Phaser viewport was the wrong runtime layer for this slice and likely the unstable dependency behind the non-working map in the in-app browser.
- Replaced Phaser renderer with a plain Canvas 2D controller while preserving the same mount/update API for React.

- Added smooth wheel zoom, drag pan, and 90-degree camera rotation with toolbar controls for the map canvas.

- Reworked UX into a compact Russian-first layout with clearer build flow, SVG building icons, and denser single-screen HUD.
