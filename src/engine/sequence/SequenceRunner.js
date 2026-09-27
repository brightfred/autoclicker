// ── SequenceRunner ────────────────────────────────────────────────────────────
// Runs the steps of a sequence strictly in order, loop after loop, until the
// loop count is reached or I stop it. It only knows about the Action and
// BreakPolicy interfaces, never about what a specific action or policy does.
//
// Breaks only happen at break points: every "Break point" step, or — if the
// sequence has none — at the end of each loop.
//
// Any step can be marked firstLoopOnly (e.g. withdraw a tinderbox once)
// or skipFirstLoop (e.g. deposit the wine I made in the previous loop).
//
// Status updates go out through onStatus() so the UI can highlight the
// current step — the runner itself knows nothing about windows or IPC.
// ─────────────────────────────────────────────────────────────────────────────

import { NoBreakPolicy } from '../efficiency/BreakPolicy.js';
import { SessionClock } from '../efficiency/SessionClock.js';

// Short natural pause between two steps, like a human reacting (ms)
export const DEFAULT_REACTION_MS = [90, 240];

export class SequenceRunner {
  #stopRequested = false;
  #running  = false;
  #position = {};       // { loop, loops, step, stepId } — sent with every status
  #breaks   = 0;        // how many breaks this run

  /**
   * @param {object}   opts
   * @param {import('../index.js').Engine} opts.engine
   * @param {import('./ActionRegistry.js').ActionRegistry} opts.registry
   * @param {(status:object) => void} [opts.onStatus]
   * @param {[number,number]} [opts.reactionMs]
   */
  constructor({ engine, registry, onStatus = () => {}, reactionMs = DEFAULT_REACTION_MS }) {
    this.engine     = engine;
    this.registry   = registry;
    this.onStatus   = onStatus;
    this.reactionMs = reactionMs;
  }

  get running() {
    return this.#running;
  }

  stop() {
    this.#stopRequested = true;
  }

  /**
   * Check a sequence without running it.
   * @returns {string[]} problems, each prefixed with its step number
   */
  validate(sequence, targets) {
    const ctx = this.#context(targets);
    const problems = [];
    if (sequence.actions.length === 0) problems.push('The sequence has no steps');

    sequence.actions.forEach((def, i) => {
      try {
        for (const p of this.registry.create(def).validate(ctx)) problems.push(`Step ${i + 1}: ${p}`);
      } catch (err) {
        problems.push(`Step ${i + 1}: ${err.message}`);
      }
    });
    return problems;
  }

  /**
   * @param {object}   sequence - { actions: [...], loops } (loops 0 = forever)
   * @param {object[]} targets  - targets of the sequence's setup
   * @param {object}   [opts]
   * @param {import('../efficiency/BreakPolicy.js').BreakPolicy} [opts.breakPolicy]
   */
  async run(sequence, targets, { breakPolicy = new NoBreakPolicy() } = {}) {
    if (this.#running) return;

    const problems = this.validate(sequence, targets);
    if (problems.length > 0) {
      this.onStatus({ running: false, done: true, problems });
      return;
    }

    const actions = sequence.actions.map(def => this.registry.create(def));
    const loops   = sequence.loops > 0 ? sequence.loops : Infinity;
    const clock   = new SessionClock();
    const ctx     = this.#context(targets, { clock, breakPolicy });

    // No break point steps → the end of each loop is the break point
    const hasBreakPoints = sequence.actions.some(a => a.type === 'breakpoint');

    this.#running = true;
    this.#stopRequested = false;
    this.#breaks = 0;
    clock.start();

    try {
      for (let loop = 1; loop <= loops && !ctx.shouldStop(); loop++) {
        for (let step = 0; step < actions.length && !ctx.shouldStop(); step++) {
          // Some steps only belong to the first loop (withdraw a tinderbox),
          // others only to the loops after it (deposit what I just made)
          const def = sequence.actions[step];
          if (def.firstLoopOnly && loop > 1) continue;
          if (def.skipFirstLoop && loop === 1) continue;

          this.#position = { loop, loops: sequence.loops, step, stepId: sequence.actions[step].id };
          this.#emit(clock);
          await actions[step].execute(ctx);

          // Natural reaction pause, a bit slower when I'm "tired"
          const pace = breakPolicy.paceMultiplier(clock.snapshot(breakPolicy.kinds));
          await ctx.sleep(this.#between(this.reactionMs) * pace);
        }
        if (!hasBreakPoints && !ctx.shouldStop()) await ctx.breakPoint();
      }
      this.onStatus({ running: false, done: true, stopped: this.#stopRequested, ...this.#stats(clock) });
    } catch (err) {
      console.error('[SEQUENCE] Error:', err);
      this.onStatus({ running: false, done: true, error: err.message, ...this.#stats(clock) });
    } finally {
      this.#running = false;
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  #context(targets, { clock, breakPolicy } = {}) {
    return {
      engine:     this.engine,
      targets:    new Map(targets.map(t => [t.id, t])),
      shouldStop: () => this.#stopRequested,
      sleep:      (ms) => this.#sleep(ms),
      breakPoint: () => this.#breakPoint(clock, breakPolicy),
    };
  }

  // Ask the policy if I take a break here; if yes, wait it out (stoppable)
  async #breakPoint(clock, policy) {
    if (!clock || !policy) return;
    const decision = policy.decide(clock.snapshot(policy.kinds));
    if (!decision) return;

    this.#emit(clock, { onBreak: { kind: decision.kind, label: decision.label, ms: decision.ms } });

    const startedAt = Date.now();
    await this.#sleep(decision.ms);
    clock.addBreak(Date.now() - startedAt, decision.kind);
    policy.onBreakTaken(decision);
    this.#breaks++;

    if (!this.#stopRequested) this.#emit(clock);
  }

  #emit(clock, extra = {}) {
    this.onStatus({ running: true, ...this.#position, ...this.#stats(clock), ...extra });
  }

  #stats(clock) {
    return { activeMs: clock.activeMs, breakMs: clock.breakMs, breaks: this.#breaks };
  }

  // Sleep in small chunks so Stop reacts within ~50ms, even during a long wait
  async #sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (this.#stopRequested) return false;
      await new Promise(resolve => setTimeout(resolve, Math.min(50, end - Date.now())));
    }
    return !this.#stopRequested;
  }

  #between([min, max]) {
    return min + Math.random() * (max - min);
  }
}
