// Missions — four jobs for Dara, night taxi driver turned courier.
// Each def has checkpoints (targets) the player drives to; startMission sets
// state.mission, reaching a target advances it, and the last target completes
// the job for its reward. Dialogue is shown as a banner (Dara + dispatcher
// Raka); mission 1 teaches the controls, mission 3 has a guard to punch out
// (see combat.js), mission 4 is a 90 s race against rising flood water at
// wanted 4. Failing (timer out) parks the mission for a retry.

import { raiseWanted } from './police.js';
import { createGuard } from './combat.js';

export const MISSIONS = [
  {
    id: 'last-fare',
    title: 'Last Fare',
    briefing: 'Dara, satu penumpang terakhir: VIP yang harus sampai ke pasar sebelum hujan deras. Jangan bikin dia basah.',
    objective: 'Antar VIP ke Night Market',
    targets: [
      { x: 1080, y: 520, label: 'Jemput VIP', prompt: 'Jalan ke taksi, tekan E untuk masuk mobil' },
      { x: 1080, y: 860, label: 'Night Market', prompt: 'Antar VIP ke pasar — jalanan licin saat hujan' },
    ],
    reward: 150,
    dialogue: [
      'Raka: "Dara, VIP menunggu di utara pasar. Jemput dia — jangan bikin dia basah."',
      'Dara: "Naik, Pak. Hujan begini, jalanan licin — tapi saya hafal tiap gang."',
      'VIP: "Cepat sedikit. Pasar tutup jam dua."',
    ],
  },
  {
    id: 'market-run',
    title: 'Night Market Run',
    briefing: 'Tiga paket, tiga kios, satu malam. Polisi mulai curiga — tiap paket menaikkan wanted.',
    objective: 'Antar 3 paket di pasar',
    targets: [
      { x: 760, y: 860, label: 'Kios Sate', prompt: 'Paket 1/3 — antar ke Kios Sate' },
      { x: 1360, y: 860, label: 'Kios Kopi', prompt: 'Paket 2/3 — polisi mulai curiga!' },
      { x: 1080, y: 1140, label: 'Kios Es Teh', prompt: 'Paket 3/3 — terakhir, jangan ketangkap' },
    ],
    reward: 250,
    dialogue: [
      'Raka: "Tiga paket, tiga kios. Jangan dibuka, jangan ditanya."',
      'Dara: "Paket pertama... sirene makin dekat — gas."',
      'Dara: "Dua lagi. Kalau ketangkap, Raka yang bayar denda."',
      'Dara: "Selesai! Pasar tutup, kita menang malam ini."',
    ],
  },
  {
    id: 'container-heist',
    title: 'Container Heist',
    briefing: 'Sebuah truk di pelabuhan menunggu. Tahan 5 detik di sampingnya, lalu kabur ke kanal sebelum patroli datang. Penjaga berjaga — pukul dia dengan F.',
    objective: 'Ambil muatan di pelabuhan, kabur ke kanal',
    targets: [
      { x: 320, y: 860, label: 'Truk Pelabuhan', hold: 5, prompt: 'Tahan 5 detik di samping truk — awas penjaga!' },
      { x: 1080, y: 1430, label: 'Jembatan Kanal', prompt: 'Kabur ke Jembatan Kanal!' },
    ],
    reward: 400,
    dialogue: [
      'Raka: "Truknya di pelabuhan barat. Penjaga satu orang — kalau dia mendekat, pukul saja."',
      'Dara: "Truknya di sana. Lima detik saja — hitung dalam hati."',
      'Dara: "Dapat! Sekarang hilang lewat kanal."',
    ],
  },
  {
    id: 'flood-tunnel',
    title: 'Flood Tunnel',
    briefing: 'Terowongan banjir di tenggara — satu-satunya jalan keluar kota malam ini. Sampai di ujung sebelum air naik. Wanted 4: seluruh kota mengejarmu.',
    objective: 'Capai ujung terowongan banjir',
    targets: [{ x: 2300, y: 1540, label: 'Ujung Terowongan', prompt: '90 detik — air naik, polisi di mana-mana!' }],
    reward: 500,
    timer: 90,
    dialogue: [
      'Raka: "Terowongan banjir, 90 detik. Wanted 4 — seluruh kota mengejarmu, Dara."',
      'Dara: "Air sudah setinggi lutut di terowongan. Kalau telat, kita berenang."',
      'Dara: "Lampu ujung terowongan... sedikit lagi!"',
    ],
  },
];

/** Dialogue line for the mission's current checkpoint (index into dialogue). */
export function dialogueFor(mission) {
  if (!mission) return null;
  const lines = mission.def.dialogue ?? [];
  const line = lines[Math.min(mission.checkpoint, lines.length - 1)] ?? null;
  if (!line) return null;
  const cut = line.indexOf(':');
  if (cut > 0) return { speaker: line.slice(0, cut), text: line.slice(cut + 1).trim() };
  return { speaker: 'Dara', text: line };
}

/** Show a dialogue line on the state for `seconds` (render draws it). */
export function setDialogue(state, line, seconds = 4) {
  if (!line) return;
  state.dialogue = { speaker: line.speaker, text: line.text, until: state.elapsed + seconds };
}

/** Begin mission i: sets state.mission {def, checkpoint, hold, timeLeft}. */
export function startMission(state, i) {
  const def = MISSIONS[i];
  if (!def) return false;
  state.missionIndex = i;
  state.mission = { def, checkpoint: 0, hold: 0, timeLeft: def.timer ?? 0 };
  state.missionFailed = false;
  state.failedMissionIndex = -1;
  state.guard = null;
  if (def.id === 'container-heist') {
    const truck = def.targets[0];
    state.guard = createGuard(truck.x + 60, truck.y + 30);
  }
  if (def.id === 'flood-tunnel') raiseWanted(state, 4);
  setDialogue(state, dialogueFor(state.mission), 5);
  return true;
}

/** Finish the active mission: pay the reward, advance, clear the mission. */
export function completeMission(state) {
  const mission = state.mission;
  if (!mission) return 0;
  const reward = mission.def.reward;
  state.money += reward;
  state.missionIndex = (state.missionIndex ?? -1) + 1;
  state.mission = null;
  state.guard = null;
  return reward;
}

/** Fail the active mission (timer out): park it so the player can retry. */
export function failMission(state) {
  const mission = state.mission;
  if (!mission) return false;
  state.failedMissionIndex = state.missionIndex;
  state.mission = null;
  state.guard = null;
  state.missionFailed = true;
  state.dialogue = { speaker: 'Raka', text: 'Misi gagal. Tarik napas — coba lagi, Dara.', until: state.elapsed + 5 };
  return true;
}

/** Retry the failed mission from its start. */
export function retryMission(state) {
  const i = state.failedMissionIndex;
  if (i < 0 || i >= MISSIONS.length) return false;
  return startMission(state, i);
}

/** Current objective label, short: one line, no repeated target prompt. */
export function missionProgress(state) {
  const card = missionCard(state);
  if (card.done) return { label: 'Semua misi selesai — kota ini milikmu.', done: true };
  const step = card.steps > 1 ? ` (${card.checkpoint + 1}/${card.steps})` : '';
  return { label: `${card.objective}${step}`, done: false };
}

/**
 * Everything the mission card HUD needs in one object: mission number,
 * title, a single objective line, the next step + live distance, and the
 * stage bar fraction. The HUD (hud.js drawMissionCard) renders this; the
 * old long label that repeated the target prompt three times is gone.
 */
export function missionCard(state) {
  const total = MISSIONS.length;
  const distTo = (t) => (state.player ? Math.round(Math.hypot(t.x - state.player.x, t.y - state.player.y)) : 0);
  if (!state.mission) {
    if (state.missionFailed) {
      const i = Math.max(0, state.failedMissionIndex);
      return { num: i + 1, total, title: 'MISI GAGAL', objective: 'Tekan R / Spasi untuk coba lagi', next: MISSIONS[i].title, nextDist: 0, done: false, failed: true, checkpoint: 0, steps: MISSIONS[i].targets.length };
    }
    const next = state.missionIndex + 1;
    if (next >= total) {
      return { num: total, total, title: 'KOTA MILIKMU', objective: 'Semua misi selesai — kota ini milikmu.', next: '', nextDist: 0, done: true, failed: false, checkpoint: 1, steps: 1 };
    }
    const def = MISSIONS[next];
    return { num: next + 1, total, title: def.title.toUpperCase(), objective: def.objective, next: def.targets[0].label, nextDist: distTo(def.targets[0]), done: false, failed: false, checkpoint: 0, steps: def.targets.length };
  }
  const m = state.mission;
  const def = m.def;
  const target = def.targets[m.checkpoint];
  return { num: (state.missionIndex ?? 0) + 1, total, title: def.title.toUpperCase(), objective: def.objective, next: target.label, nextDist: distTo(target), done: false, failed: false, checkpoint: m.checkpoint, steps: def.targets.length };
}
