// SOLMAR BAY — the entrypoint (Node 22, standard library only).
//
// The game is the static game/ folder beside this file: plain files a
// desktop browser loads offline — game/index.html plus its ES modules,
// three.js vendored under game/vendor/three/, zero network requests. This
// program is the hand-in: it copies game/ and screenshots/ next to this
// file into /output and writes /output/dossier.json, the summary the judge
// reads, using the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(root, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps come from the scorer's own gate (reference/gate.json). Only
// text_max_bytes changes the dossier's bytes; the rest refuse an entry the
// scorer would refuse anyway — more than 4 screenshots, one over 256 KiB,
// more than 993 files or 48 MiB under game/, or a game/ path over 1000
// bytes (game/ counts against /output's own 1000-entry cap, alongside
// screenshots/ and dossier.json).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
