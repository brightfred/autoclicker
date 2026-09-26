// ── SequenceRunner ────────────────────────────────────────────────────────────
// Runs the steps of a sequence strictly in order, loop after loop, until the
// loop count is reached or I stop it. It only knows about the Action interface,
// never about what a specific action does.
//
// Status updates go out through onStatus() so the UI can highlight the
// current step — the runner itself knows nothing about windows or IPC.
// ─────────────────────────────────────────────────────────────────────────────

// Short natural pause between two steps, like a human reacting (ms)
export const DEFAULT_REACTION_MS = [90, 240];

export class SequenceRunner {
  #stopRequested = false;
  #running = false;

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
   */
  async run(sequence, targets) {
    if (this.#running) return;

    const problems = this.validate(sequence, targets);
    if (problems.length > 0) {
      this.onStatus({ running: false, done: true, problems });
      return;
    }

    const actions = sequence.actions.map(def => this.registry.create(def));
    const loops   = sequence.loops > 0 ? sequence.loops : Infinity;
    const ctx     = this.#context(targets);

    this.#running = true;
    this.#stopRequested = false;

    try {
      for (let loop = 1; loop <= loops && !ctx.shouldStop(); loop++) {
        for (let step = 0; step < actions.length && !ctx.shouldStop(); step++) {
          this.onStatus({ running: true, loop, loops: sequence.loops, step, stepId: sequence.actions[step].id });
          await actions[step].execute(ctx);
          await ctx.sleep(this.#between(this.reactionMs));
        }
      }
      this.onStatus({ running: false, done: true, stopped: this.#stopRequested });
    } catch (err) {
      console.error('[SEQUENCE] Error:', err);
      this.onStatus({ running: false, done: true, error: err.message });
    } finally {
      this.#running = false;
    }
  }

  #context(targets) {
    return {
      engine:     this.engine,
      targets:    new Map(targets.map(t => [t.id, t])),
      shouldStop: () => this.#stopRequested,
      sleep:      (ms) => this.#sleep(ms),
    };
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
