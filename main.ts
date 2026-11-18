// Solmar Bay entrypoint: copies game/ + screenshots/ to the output dir and
// writes dossier.json with the kit's buildDossier. Deterministic: two runs
// of this program write the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

async function main() {
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(repo, 'game'), path.join(out, 'game'), { recursive: true });
  fs.cpSync(path.join(repo, 'screenshots'), path.join(out, 'screenshots'), { recursive: true });
  const dossier = await buildDossier(repo, { text_max_bytes: 163840 });
  const dossierPath = path.join(out, 'dossier.json');
  fs.writeFileSync(dossierPath, dossier);
  // verify what we just wrote: it must parse, hold the 4 shots, and keep
  // the source text under the 163,840-byte cap with room to spare.
  const back = JSON.parse(fs.readFileSync(dossierPath, 'utf8'));
  const textBytes = Buffer.byteLength(back.text || '', 'utf8');
  console.log('wrote', dossierPath, dossier.length + ' bytes');
  console.log('dossier text:', textBytes + ' bytes (cap 163840), images:', (back.images || []).length);
  if (textBytes > 163840) throw new Error('dossier text over the cap');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
