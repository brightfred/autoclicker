// ── SessionClock ──────────────────────────────────────────────────────────────
// Keeps track of how long I've been "working" vs "on break" during a run,
// and when I last took each kind of break.
// The break policy reads these numbers to decide when a break is due.
// ─────────────────────────────────────────────────────────────────────────────

export class SessionClock {
  #startedAt   = 0;
  #breakMs     = 0;
  #lastBreakAt = 0;          // session time when the last break ENDED
  #lastByKind  = new Map();  // kind → session time when that kind last ended

  constructor(now = () => Date.now()) {
    this.now = now;
  }

  start() {
    this.#startedAt   = this.now();
    this.#breakMs     = 0;
    this.#lastBreakAt = 0;
    this.#lastByKind.clear();
  }

  /** Record a finished break */
  addBreak(ms, kind) {
    this.#breakMs += ms;
    this.#lastBreakAt = this.elapsedMs;
    this.#lastByKind.set(kind, this.#lastBreakAt);
  }

  get elapsedMs() { return this.now() - this.#startedAt; }
  get breakMs()   { return this.#breakMs; }
  get activeMs()  { return Math.max(0, this.elapsedMs - this.#breakMs); }

  /** Time since the last break of any kind */
  get sinceBreakMs() { return this.elapsedMs - this.#lastBreakAt; }

  /** Time since the last break of one kind (since start if never taken) */
  sinceKindMs(kind) {
    return this.elapsedMs - (this.#lastByKind.get(kind) ?? 0);
  }

  /** Everything the policy needs, as plain numbers */
  snapshot(kinds = []) {
    return {
      activeMs:     this.activeMs,
      breakMs:      this.breakMs,
      sinceBreakMs: this.sinceBreakMs,
      sinceKindMs:  Object.fromEntries(kinds.map(k => [k, this.sinceKindMs(k)])),
    };
  }
}
