# 2048 3D — repo guide

## Stack

- Vanilla JS (ES modules, no bundler, no `package.json`)
- Three.js loaded via CDN importmap (`index.html:32-38`)
- Deployed to Cloudflare Pages via direct upload (`https://2048-3d.pages.dev/`)

## Quick start

```bash
# No install needed. Serve the directory:
npx serve .          # or any static server
# Tests (Node.js):
node game.test.js
```

## Architecture

```
game.js          → Model (grid, move logic, scoring, win/game-over detection)
game-view.js     → Three.js view (scene, camera, tiles, animations, particles)
game-control.js  → Controller (input, game loop, save/load orchestration)
game.test.js     → Unit tests for game.js (no Three.js dependency)
index.html       → Entry point (importmap, DOM, bootstraps GameController)
style.css        → UI overlay styles
```

## Key conventions

- **No build step.** Every edit is live after a browser refresh.
- **Tests mock `localStorage`** at the top of `game.test.js` for Node.js (`globalThis.localStorage`).
- **Game state persists** in `localStorage` keys: `game2048` (board), `best2048` (high score), `game2048_cam` (camera pose).
- **UI language is Japanese** — score display, buttons, modals all use Japanese text.
- **Import map uses pinned CDN version** (`three@0.168.0`). Bump version in `index.html` only.
- **`idSeq` is manual** (not auto-increment). Tests reset it to 100 to avoid collision with spawned tiles (ids 0,1).
