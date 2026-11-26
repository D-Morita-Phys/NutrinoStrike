# Neutrino Strike

A Monster Strike-style neutrino gacha that runs in the browser. You grab a
glowing neutrino ball, drag it DOWN, and release to launch it UP into a
detector (Super-Kamiokande or KamLAND). How far you pulled sets the neutrino
energy, and a weighted lottery for that energy band decides which species you
actually observe. Reactor and geoneutrinos dominate the low band, the diffuse
supernova background dominates the mid band, and atmospheric and accelerator
neutrinos dominate the high band. A supernova burst neutrino is the rare drop
that can turn up in any band.

## Tech stack

- Vite (dev server, bundler)
- TypeScript
- Canvas 2D for rendering (no game engine; physics is a small self-written
  position/velocity integrator with wall bounce)
- Vitest for unit tests of the pure lottery/energy logic

## Prerequisites

- Node.js 18 or newer (developed and tested on Node 22)
- npm (bundled with Node)

## Setup and run

Install dependencies, then use any of the scripts below. The commands match the
`scripts` block in `package.json`.

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server (serves the game at the printed localhost URL)
npm run build    # type-check (tsc) and produce a production bundle in dist/
npm run preview  # serve the built bundle from dist/ locally
npm test         # run the Vitest unit tests once
```

`npm run test:watch` is also available for re-running tests on change during
development.

## Controls

- Press (mouse) or touch the glowing ball at the bottom of the play field.
- Drag **DOWN** to pull. An on-screen energy readout and an aim guide appear
  while you drag, showing the launch energy the current pull would produce.
- Release to launch the ball **UP**. The farther you pulled, the faster the
  launch and the higher the neutrino energy.
- Both mouse and touch input are supported. On touch screens the page does not
  scroll while you drag.

When the ball strikes a detector, the launch energy is converted to an energy
band, the lottery draws a species using that band's weights, and the result is
shown in the "Latest observation" panel. The last 8 observations (species,
detector, and energy) are listed in the "History" panel. Brief on-screen
instructions live in the "How to play" panel next to the play field.

## Game design

Pull strength maps to a neutrino energy between `MIN_ENERGY_MEV` (1 MeV) and
`MAX_ENERGY_MEV` (1000 MeV). That energy falls into one of three bands, and each
band has its own weight table that favors different species:

| Energy band | Range | Dominant species |
| --- | --- | --- |
| Low | ~0-10 MeV | Reactor neutrino, Geoneutrino |
| Mid | ~10-100 MeV | Supernova diffuse background neutrino (DSNB) |
| High | >=100 MeV | Atmospheric neutrino, Accelerator neutrino |

The six observable species:

- **Reactor neutrino** (原子炉ニュートリノ) - low energy, from nuclear reactor
  fission.
- **Geoneutrino** (地球ニュートリノ) - low energy, from radioactive decay
  inside the Earth.
- **Supernova diffuse background neutrino / DSNB** (超新星背景ニュートリノ) -
  mid energy, the faint background from all past supernovae.
- **Atmospheric neutrino** (大気ニュートリノ) - high energy, from cosmic-ray
  air showers.
- **Accelerator neutrino** (加速器ニュートリノ) - high energy, from particle
  accelerator beams.
- **Supernova burst neutrino** (超新星爆発ニュートリノ) - the RARE drop. It
  carries a small but nonzero weight in every band, so a lucky hit can produce
  it regardless of pull strength.

The two detectors (KamLAND themed to the low-energy regime, Super-Kamiokande to
the high-energy regime) are cosmetic targets. The observed species is always
decided by the lottery from the launch energy, not by which detector you hit.

## Tuning the balance

All gameplay balance lives in one place: the weight tables in
`src/game/neutrinos.ts`. This module is pure data with no dependency on
rendering, physics, or the DOM, so you can retune ratios without touching any
other file.

- `ENERGY_BANDS` is an array of bands. Each band has an `id` (`low` / `mid` /
  `high`), a MeV range (`minMeV` / `maxMeV`), and a `weights` record with one
  nonnegative number per species.
- To change how likely a species is in a given band, edit that band's
  `weights`. The numbers are relative selection weights, not probabilities, so
  the lottery normalizes them for you. Raising one species' weight makes it
  more common in that band; setting it to 0 removes it from that band.
- `MIN_ENERGY_MEV` and `MAX_ENERGY_MEV` set the energy range that pull strength
  maps onto, and each band's `minMeV` / `maxMeV` set where the band boundaries
  fall.
- Keep `supernovaBurst` small but nonzero in every band to preserve its "rare
  drop in any band" behavior.

The lottery itself (`src/game/lottery.ts`: `pullToEnergy`, `energyToBand`,
`drawNeutrino`), the physics (`src/game/physics.ts`), and the Canvas rendering
and input (`src/render/game.ts`) read from this data and do not need to change
when you rebalance the drop ratios.

## Project layout

```
NutrinoStrike/
  index.html              entry HTML (mounts #app)
  src/
    main.ts               builds the page layout and starts the game loop
    style.css             page and panel styling
    game/                 pure logic (no DOM)
      neutrinos.ts        species data + energy bands + weight tables (balance knobs)
      lottery.ts          pull -> energy -> band -> weighted draw
      physics.ts          ball integration and drag -> velocity/energy
      detectors.ts        Super-Kamiokande / KamLAND targets
      __tests__/          Vitest unit tests for the lottery/energy logic
    render/
      game.ts             Canvas drawing, pointer/touch input, game loop wiring
```
