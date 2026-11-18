# SOLMAR BAY — open-world crime: steal cars, outrun the law, run the city

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/htyo00/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/htyo00/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for [make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01). **Solmar Bay** is a neon-lit modern coastal city after dark, starring **Dante Cross**, an ex-getaway driver pulled back for one last job by the fixer **Mara Voss**. Everything runs offline from static files in a desktop browser — no network, no build step.

## What is in the game

- **A 3D city on foot and by car** (three.js, vendored under `game/vendor/three/`): five districts — Downtown, Marina, Hills, Port, Ocean Drive — plus a marina pier, all in a neon-dusk palette: cold moonlight, warm lit windows, pink neon, wet asphalt that reflects it.
- **Steal any car**: hold **E** next to a parked or traffic car and it is yours; the driver bails and runs. Eight named models, from the Comet GT to the Harbor Bus.
- **Traffic and pedestrians**: cars drive the road graph, stop for trouble and honk; pedestrians stroll the sidewalks, scatter from speeding cars, and fall when hit.
- **Wanted level 1–5 and the SBPD**: stealing, hitting pedestrians and ramming cops raise the heat. Interceptors chase and ram, foot cops get out and run you down, roadblocks appear at three stars, a searchlight helicopter circles at four. Break line of sight and the stars blink out one by one.
- **Missions and a story**: six named jobs from Mara Voss, starting with FIRST JOB — steal the Comet GT, run it to the Marina pier, lose the cops, deliver it. Graded S/A/B/C on time, paid in cash.
- **HUD with minimap**: wanted stars, cash, mission card with step bar, police-response panel, Mara Voss dialogue, district label, speed, and a live minimap with player, police vision cones, search area and waypoint blips. Health / armour / nitro bars under the minimap; Tab opens the full city map with districts and completion stats.
- **Collectibles and gear**: 8 Bay Coins hidden around the city ($25 each), SBPD vest crates for +50 armour, and a nitro meter — hold Shift in a car for +30% top speed.
- **Start screen, pause, save**: progress, cash and best runs persist in localStorage; three difficulties (Cruise / Street / Heat).

## Controls

W A S D drive / walk · E hold to steal a car, tap to step out · Space handbrake · Shift run / nitro in a car · drag the mouse to look around · Tab city map · P pause · R restart mission · M mute.

## Tech

Plain ES modules, no bundler: `game/index.html` + `game/src/*.js` (one job per file) + vendored `three.module.min.js`. Deterministic seeded city and traffic; `?shot=chase|title|mission|complete&seed=N` stages the four screenshots. Serve locally with `node serve.ts` (http://localhost:8080), build the dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
