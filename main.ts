// SOLMAR BAY — the entrypoint (Node 22, standard library only).
//
// The game itself is the static game/ folder next to this file: plain files
// a desktop browser loads offline — game/index.html with its ES modules and
// three.js vendored under game/vendor/three/, zero network requests. This
// program is the hand-in: it copies game/ and screenshots/ beside this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// through the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps come from the scorer's own gate (reference/gate.json). Only
// text_max_bytes changes how many dossier bytes are written; the rest refuse
// an entry the scorer would refuse anyway — more than 4 screenshots, one
// over 256 KiB, more than 993 files or 48 MiB under game/, or a game/ path
// over 1000 bytes (game/ counts against /output's own 1000-entry cap,
// alongside screenshots/ and dossier.json).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
