// Keyboard + pointer input. Held keys give steering / throttle; one-shot presses
// (confirm, pause, enter/exit car, use) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_USE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const USE = new Set(['KeyF']);
const HANDBRAKE = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, handbrake: false };
  // Two queues: UI actions (confirm/pause, read by the loop) and game actions
  // (enter/use, read by the world step) — so the loop never eats a game press.
  let uiActions = 0;
  let gameActions = 0;

  function onKeyDown(event) {
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (HANDBRAKE.has(event.code)) held.handbrake = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) uiActions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) uiActions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) gameActions |= ACTION_ENTER;
    } else if (USE.has(event.code)) {
      if (!event.repeat) gameActions |= ACTION_USE;
    } else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (HANDBRAKE.has(event.code)) held.handbrake = false;
  }

  function onBlur() {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
    held.handbrake = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', onBlur);
  // A click is a confirm (start / resume / restart).
  target.addEventListener('pointerdown', () => {
    uiActions |= ACTION_CONFIRM;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. Steering. */
    direction() {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    /** 1 for forward, -1 for reverse, 0 for neither or both. */
    throttle() {
      return (held.up ? 1 : 0) - (held.down ? 1 : 0);
    },
    /** Normalised 2D walk vector from the held keys: {x, y}. */
    axis() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** True while either Shift is held: handbrake in a car, sprint on foot. */
    handbrake() {
      return held.handbrake;
    },
    /** Alias for handbrake(): Shift means "run" while on foot (world.js). */
    run() {
      return held.handbrake;
    },
    /** The one-shot UI presses since the last call (CONFIRM / PAUSE). */
    takeActions() {
      const taken = uiActions;
      uiActions = 0;
      return taken;
    },
    /** The one-shot game presses since the last call (ENTER / USE). */
    takeGameActions() {
      const taken = gameActions;
      gameActions = 0;
      return taken;
    },
    /** Read-only view of the held keys (menus, hints). */
    get held() {
      return held;
    },
  };
}
