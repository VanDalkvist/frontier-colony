# Frontier Colony Design

## Product frame

`Frontier Colony` is a separate game project built on top of the terrain-generation logic explored in `terrain-noise-lab`. The earlier app is a world-generation sandbox; this one is a settlement game. That split matters because the user journey is different. In the sandbox, the player asks, "What kind of map can I make?" In the colony sim, the player asks, "Given this land, how do I survive and grow?" The map therefore stops being output and becomes pressure. The procedural world must create different openings, bottlenecks, and recovery patterns.

The intended MVP is `pauseable real-time light`, not a full colony simulator. The player should feel pressure from time and scarcity, but the project should avoid fake depth created by over-modeling workers, moods, and logistics too early. The strongest first fantasy is: land on an unknown island, anchor a camp, stabilize food and timber, unlock stone and ore, then build toward a harbor or town-hall level milestone. That is enough to produce a real loop without pretending to be RimWorld. Session target for the MVP should be 10-20 minutes, not a multi-hour save.

The product test is straightforward: if two generated worlds force materially different opening decisions, the game is using procedural generation correctly. If every seed leads to the same first five actions, the map is only decoration.

## Core loop

The recommended loop is: `survey -> settle -> stabilize -> expand -> hit shortage -> solve shortage -> unlock tier -> win or collapse`. The player starts with a camp and a small worker pool. Time runs continuously but can be paused or sped up. The player does not click trees or rocks manually. Their role is placement, prioritization, and crisis handling. The colony should produce resources automatically through buildings, while the player chooses where to invest limited labor and materials.

Early game should revolve around `wood`, `food`, and safe expansion. Midgame should introduce `stone` and `ore` as the first hard gates for new buildings and progression. The economy must be spatial: forests should matter for lumber camps, coasts for fishing docks, and highlands or mountains for quarries and mines. If any building works anywhere, the procedural map loses product value.

The MVP should keep explicit loss and win states. Loss can be driven by food collapse and stability falling to zero. Win can be building a `Harbor` or upgraded `Town Hall`. That matters because endless sandbox growth is a weak first product: it removes pacing and makes the early design harder to evaluate. A bounded loop makes balance problems and boredom visible much faster.

## Architecture

Architecture should follow a strict separation rule. Simulation owns saveable truth. Rendering owns the world view. UI owns input surfaces and status presentation. That means colony state, stockpiles, time, buildings, and progression live in pure TypeScript objects under `src/game/simulation`. World generation and terrain-derived resource yields live under `src/game/world`. Phaser lives under `src/game/render` and reads state to draw the current playfield. React hosts the HUD, buttons, drawers, and text-heavy panels.

This split is not ceremony. Browser games become fragile when scene callbacks quietly mutate gameplay rules, or when UI components become the source of truth for simulation. The current scaffold therefore uses a tick-driven simulation function and a separate Phaser mount layer. Save files later should serialize only simulation state and seed, never renderer objects.

For the implementation track, Phaser is the right default because this is a 2D browser game with a tile-based playfield and a need for predictable scene control. React remains useful for DOM HUD and build panels. The project should resist the temptation to push all UI into Phaser, because the colony sim needs text-heavy, inspectable information more than it needs diegetic in-world menus.

## MVP systems

MVP systems should stay narrow. Resources: `wood`, `stone`, `food`, `ore`. Buildings: `Camp`, `Lumber Camp`, `Forager Hut`, `Quarry`, `Mine`, `Storage`, `Workshop`. Population can remain an abstract worker pool instead of individual colonists. That is a deliberate cut: individual agents with pathfinding look attractive, but they add implementation cost before the game has proved its loop. For the first version, assigned labor is enough.

Time should run on discrete ticks layered over real time. A tick every `250ms` or `500ms` is enough. Each tick should: process production, process food upkeep, advance build progress, update day count, and evaluate win or lose conditions. That model is easier to test and easier to save than continuous freeform simulation.

The first vertical slice should include only these proofs:

- generate a world
- find a valid starting camp location
- render the map in isometric view
- run the simulation clock
- show stockpile changes
- pause and change speed
- expose the intended building roadmap

If that slice already feels inert, the design should change before adding more content. The right next step after the scaffold is building placement with terrain validation, because that is where the procedural world begins to matter to player decision-making.
