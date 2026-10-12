# /lab legacy responsive pass — report (2026-10-11)

Scope: apps/web/public/legacy/** only. Not committed or deployed.

## Files
- NEW css/legacy-15.css (added last in manifest "css"). Covers containers, breakpoints, zoom, scroll fades, TOC, lab/proc/prop layouts, landscape, tap targets and text minimums.
- NEW js/28-rwd.js (added last in manifest "scripts", after 09-tool.js). Adds scroll-edge fades, the 左右滑动查看 hint, a first-visit nudge, the wide-output lab layout, ←/→/Space shortcuts, and 放大查看 fullscreen with pinch-zoom.
- 08-lab.js: panel split into .x-lab__main (opts + stage) and .x-lab__side (ctrl + out + note). The note is now a <details>, collapsed on phones. A step counter enables keyboard "back" (reset + replay). Adds window.X_LAB_ACT(a).
- 11-proc-core.js: adds .x-proc__side (ctrl/card/kv/steps). fitSplit() turns on .is-split with --x-side only when the diagram's min-width fits. Space toggles play. Adds window.X_PROC_ACT(a).
- 04-hero.js / 10-graph.js: DPR capped at 1.5 on phones. Shadows off on low-end devices (≤4 cores or ≤4 GB). ResizeObserver and orientationchange trigger a resize. The hero pauses when document.hidden.
