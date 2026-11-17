// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, paused, game over, win.
//
// ?seed=N fixes the city. ?shot=chase|steal|market|finale|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIXED_DT, MAX_FRAME } from './config.js';
import { createRandom } from './random.js';
import { EVENT_BOUGHT, EVENT_GAMEOVER, EVENT_MISSION, EVENT_WANTED, createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { MISSIONS, retryMission, startMission } from './missions.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__game = {
    world,
    getScreen: () => scene.screen,
    state: () => world.state,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let bannerUntil = 0;

  world.load();
  if (world.state.best > best) best = world.state.best;

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.ensure();
    world.reset();
    world.load();
    // Resume the saved job, or start the first one for a new / finished player.
    if (world.state.missionIndex < 0 || world.state.missionIndex >= MISSIONS.length) startMission(world.state, 0);
    else startMission(world.state, world.state.missionIndex);
    accumulator = 0;
    banner = null;
    screen = SCREEN_PLAY;
    announce('Bermain. Antar Dara menyelesaikan misi pertamanya.');
  }

  function endGame(won) {
    audio.siren(false);
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.money > best) {
      best = world.state.money;
      saveBest(best);
    }
    world.save();
    announce(won ? `Semua misi selesai. Uang $${world.state.money}.` : `Busted. Uang $${world.state.money}. Rekor $${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.ensure();
    // Retry a failed mission with Space/Enter (or R, see the key listener).
    if (world.state.missionFailed && (actions & ACTION_CONFIRM)) {
      if (retryMission(world.state)) {
        audio.beep();
        announce(`Misi dimulai lagi: ${world.state.mission.def.title}.`);
        return;
      }
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      // Esc/P while the shop is open closes the shop instead of pausing.
      if (world.state.shop.open) {
        world.state.shop.open = false;
        announce('Toko ditutup.');
      } else {
        screen = SCREEN_PAUSED;
        announce('Jeda.');
      }
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Bermain.');
    }
  }

  // M mute toggle + R mission retry (keys the input module does not own).
  let retryKey = false;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyM') {
      audio.muted = !audio.muted;
      announce(audio.muted ? 'Suara mati.' : 'Suara hidup.');
    } else if (event.code === 'KeyR') {
      retryKey = true;
    }
  });

  function step() {
    if (screen === SCREEN_TITLE) {
      // Backdrop: the city lives (traffic, crowds, rain) with no player control.
      world.step(FIXED_DT, null);
      return;
    }
    // R retries a failed mission from the play screen.
    if (retryKey && world.state.missionFailed) {
      retryKey = false;
      if (retryMission(world.state)) {
        audio.beep();
        announce(`Misi dimulai lagi: ${world.state.mission.def.title}.`);
      }
    } else {
      retryKey = false;
    }
    const events = world.step(FIXED_DT, input);
    audio.setRain(world.state.rain.intensity);
    audio.engine(world.state.player.speed);
    audio.siren(world.state.wanted >= 1);
    if (events & EVENT_MISSION) {
      banner = world.state.missionFailed
        ? 'Misi gagal! Tekan R / Spasi untuk coba lagi.'
        : world.state.mission ? 'Checkpoint tercapai!' : 'Misi selesai! Bayaran masuk.';
      bannerUntil = world.state.elapsed + 2.5;
      audio.beep();
      world.save();
      announce(banner);
    }
    if (events & EVENT_WANTED) {
      audio.beep();
      announce(`Wanted naik ke ${world.state.wanted}.`);
    }
    if (events & EVENT_BOUGHT) audio.beep();
    if (world.state.elapsed > bannerUntil) banner = null;
    if (events & EVENT_GAMEOVER) {
      endGame(false);
      return;
    }
    if (!world.state.mission && world.state.missionIndex >= MISSIONS.length) endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= FIXED_DT && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= FIXED_DT;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, banner);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  // Playtesting hook: window.__game = { world, getScreen, state, audioState }.
  window.__game = {
    world,
    getScreen: () => screen,
    state: () => world.state,
    audioState: () => audio.state ?? '',
    audioMuted: () => audio.muted,
  };

  announce('Tanjung Neon. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
