// ── Mouse Tracker Utility ─────────────────────────────────────────────────────
// Records raw mouse movement paths between clicks.
// Each path is an array of { x, y, t } points captured via uiohook-napi.
// On playback, picks a random path from the pool and replays it point by point.
//
// Used by models that need natural mouse movement between clicks (e.g. dart).
// ─────────────────────────────────────────────────────────────────────────────

let tracking = false;
let currentPath = [];
let pathStartTime = null;

/**
 * Start recording mouse movement points.
 * Call this right after a click is registered.
 * @param {object} uIOhook - the uiohook-napi instance
 */
function startPath(uIOhook) {
  currentPath = [];
  pathStartTime = Date.now();
  tracking = true;

  uIOhook.on('mousemove', onMouseMove);
}

/**
 * Stop recording and return the captured path.
 * Call this right before the next click is registered.
 * @param {object} uIOhook - the uiohook-napi instance
 * @returns {{ x: number, y: number, t: number }[]} - array of movement points
 */
function stopPath(uIOhook) {
  tracking = false;
  uIOhook.removeListener('mousemove', onMouseMove);
  return [...currentPath];
}

function onMouseMove(e) {
  if (!tracking) return;
  currentPath.push({
    x: e.x,
    y: e.y,
    t: Date.now() - pathStartTime,
  });
}

/**
 * Replay a randomly picked path from the pool.
 * Moves the mouse point by point using robotjs.
 *
 * @param {Array[]} pathPool   - array of recorded paths to pick from
 * @param {object}  robot      - robotjs instance
 * @param {Function} sleep     - sleep utility from core
 * @param {Function} isPlaying - isPlaying check from core
 */
async function replayPath(pathPool, robot, sleep, isPlaying) {
  if (!pathPool || pathPool.length === 0) return;

  // Pick a random path from the pool
  const path = pathPool[Math.floor(Math.random() * pathPool.length)];
  if (!path || path.length === 0) return;

  for (let i = 0; i < path.length; i++) {
    if (!isPlaying()) break;

    const point = path[i];

    // Move mouse to this point
    robot.moveMouse(point.x, point.y);

    // Wait until the next point's timestamp (or a small default if last point)
    const nextT = path[i + 1]?.t ?? point.t + 16;
    const delay = Math.max(1, nextT - point.t);
    await sleep(delay);
  }
}

export { startPath, stopPath, replayPath };