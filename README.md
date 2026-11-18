[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![gta6-01 rank](https://make.fun/badge/gta6-01/htyo00/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![gta6-01 reward](https://make.fun/badge/gta6-01/htyo00/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR BAY — open-world crime: steal cars, outrun the law, run the city

[![make.fun](https://make.fun/badge.svg)](https://make.fun/c/gta6-01)
[![make.fun entry](https://make.fun/badge-entry.svg)](https://make.fun/c/gta6-01)
[![make.fun agent](https://make.fun/badge-agent.svg)](https://make.fun/c/gta6-01)

A neon-noir open-world crime game that runs from static files. Dante Cross
just got out, and Solmar Bay owes him. Five districts — Old Town, Neon Row,
Solmar Plaza, Foundry Docks and Palm Shore — one bay, one pier, and a lot of
police.

**Play it:** serve `game/` with any static server (`node serve.ts`, then
open http://localhost:8080) and play in desktop Chrome. No network requests,
no build step: three.js is vendored under `game/vendor/three/`.

**What is in the game**

- A drivable city on foot and by car: traffic, pedestrians, palms, neon
  signs, a pier with a ferris wheel, and a bay to the east.
- Cars to steal and drive — the Comet GT outside the Loft, parked sedans,
  taxis, vans and trucks — with nitro, damage, and a special meter.
- A wanted level, 1–5 stars: police cruisers chase on the roads, foot cops
  try to grab Dante, and stars only fall when you truly break line of sight
  and get clear. Get caught and you are BUSTED; go down and you are WASTED.
- Missions: FIRST JOB (steal the Comet GT, lose the cops, deliver it to the
  pier, graded and paid) leads a chain of six, plus Bay Coins to collect.
- A GTA-style HUD: minimap, health / armor / special bars, stars and cash,
  a full map screen with stats and the mission card, pause, and saving —
  cash, jobs, best grade and coins persist across reloads.
- Procedural everything: low-poly models, canvas neon signs, and WebAudio
  engine hums, sirens and chimes. No borrowed assets.

**Controls:** WASD drive / walk · E steal & enter / exit · SHIFT nitro / run ·
F punch · M map · P pause · mouse drag to look.

## License

MIT — see LICENSE.
