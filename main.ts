// Tanjung Neon — a working gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline (game/index.html
// and its ES modules, no library and no network request), and the program hands it in. It copies
// game/ and screenshots/ from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads, with the vendored make.fun library. The game itself is an open-world
// crime game in a fictional tropical port city at night: Dara, a night taxi driver turned
// night-market courier, drives through sudden tropical rain on neon-reflecting wet asphalt,
// steals cars, runs a contraband economy at the night market, outruns three tiers of police, and
// plays four story missions — from a last fare in the first downpour to a final escape through a
// flooding tunnel. Vanilla JavaScript on Canvas 2D, WebAudio synth sounds, deterministic staged
// screenshots via ?shot=chase|steal|market|finale&seed=N. Iteration 2 adds a zoomed chase camera,
// a mission-card HUD with a named police response panel (game/src/hud.js), district name plates
// in the world, and denser traffic + market crowds. Put your 4 PNG or JPEG screenshots in
// screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build summary on stdout: file + byte counts for game/ and screenshots/,
// so a bad build (missing shot, bloated game/) is visible before submit.
function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}
const game = countTree(join(out, 'game'));
const shots = existsSync(join(out, 'screenshots')) ? countTree(join(out, 'screenshots')) : { files: 0, bytes: 0 };
console.log(`tanjung-neon: game/ ${game.files} files, ${game.bytes} bytes; screenshots/ ${shots.files} files, ${shots.bytes} bytes; dossier.json written.`);
