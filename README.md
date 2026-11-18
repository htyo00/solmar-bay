# SOLMAR BAY — open-world crime in a neon coastal city

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/htyo00/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/htyo00/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

A 3D open-world crime game made for [make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01). You play **Dante Cross**, a retired getaway driver dragged back for one last job by fixer **Mara Voss**, in **Solmar Bay** — a modern coastal city glowing with neon after dark. Everything runs offline from static files in a desktop browser: no network, no build step.

## Inside the game

- **A drivable, walkable 3D city** (three.js, vendored under `game/vendor/three/`): five districts — Downtown, Marina, Hills, Port, Ocean Drive — plus a marina pier, painted in neon dusk: cold moonlight, warm lit windows, pink neon, wet asphalt that throws it all back.
- **Steal any car**: hold **E** beside a parked or traffic car and it is yours — the driver bails and runs. Eight named models, from the Comet GT to the Harbor Bus.
- **Living streets**: traffic cars drive the road graph, stop for trouble and honk; pedestrians stroll the sidewalks, scatter from speeding cars, and fall when hit.
- **Wanted 1–5 and the SBPD**: stealing, hitting pedestrians and ramming cops raise the heat. Interceptors chase and ram, foot cops climb out and run you down, roadblocks go up at three stars, a searchlight helicopter circles at four. Break line of sight and the stars blink away one at a time.
- **Jobs and a story**: six named jobs from Mara Voss, opening with FIRST JOB — steal the Comet GT, run it to the Marina pier, lose the cops, deliver it. Graded S/A/B/C on time, paid in cash.
- **HUD and minimap**: wanted stars, cash, a mission card with a step bar, a police-response panel, Mara Voss dialogue, a district label, speed, and a live minimap showing the player, police vision cones, the search area and waypoint blips. Health / armour / nitro bars sit under the minimap; Tab opens the full city map with districts and completion stats.
- **Pickups and gear**: 8 Bay Coins tucked around the city ($25 each), SBPD vest crates worth +50 armour, and a nitro meter — hold Shift in a car for +30% top speed.
- **Screens and saving**: start screen, pause, and a save — progress, cash and best runs persist in localStorage; three difficulties (Cruise / Street / Heat).

## Controls

W A S D drive / walk · E hold to steal a car, tap to step out · Space handbrake · Shift run / nitro in a car · drag the mouse to look around · Tab city map · P pause · R restart mission · M mute.

## Tech

Plain ES modules, no bundler: `game/index.html` + `game/src/*.js` (one job per file) + vendored `three.module.min.js`. Seeded, deterministic city and traffic; `?shot=chase|title|mission|complete&seed=N` stages the four screenshots. Serve locally with `node serve.ts` (http://localhost:8080); build the dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
