# Frontier Colony

New standalone project for a `pauseable real-time light` colony sim built on top of the same procedural terrain ideas used in `terrain-noise-lab`.

## Stack

- React 19 for HUD and shell UI
- Phaser for the 2D playfield renderer
- TypeScript for simulation, world generation, and game state

## Architecture

- `src/game/world` owns map generation and terrain-derived yields
- `src/game/simulation` owns serializable colony state and ticking
- `src/game/render` owns Phaser scene setup and drawing only
- `src/App.tsx` hosts the DOM HUD and orchestrates the preview loop

## Start

```bash
npm install
npm run dev
```

## Current state

This is a design-first scaffold, not a content-complete game. It already includes:

- world generation
- isometric preview rendering
- simulation ticks for stockpile and food upkeep
- initial building roadmap and HUD framing

The next implementation milestone is building placement + terrain validation + explicit win/lose conditions.
