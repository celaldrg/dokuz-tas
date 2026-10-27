/**
 * Asks the computer player for a move. The search runs in a module Web
 * Worker (src/ai-worker.js); where module workers are unavailable it runs
 * on the main thread instead. Only one request is open at a time.
 */
import { chooseMove } from './ai.js';

/** @typedef {import('./rules.js').Move} Move */
/** @typedef {{level: import('./ai.js').Level, seed: number}} AiOptions */

/**
 * @returns {{choose(state: object, options: AiOptions): Promise<Move|null>, cancel(): void}}
 *   `choose` resolves with the move, or with null when cancelled;
 *   `cancel` drops the open request and stops a search still running
 */
export function createAiClient() {
  let worker = null;
  let workerBroken = typeof Worker !== 'function';
  let open = null;
  let lastId = 0;

  function settle(move) {
    if (!open) return;
    const { resolve } = open;
    open = null;
    resolve(move);
  }

  function getWorker() {
    if (worker || workerBroken) return worker;
    try {
      worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', ({ data }) => {
        if (open && data.id === open.id) settle(data.move);
      });
      worker.addEventListener('error', (event) => {
        event.preventDefault();
        switchToMainThread();
      });
    } catch {
      workerBroken = true;
      worker = null;
    }
    return worker;
  }

  function switchToMainThread() {
    workerBroken = true;
    worker?.terminate();
    worker = null;
    if (open) runHere(open);
  }

  function runHere(request) {
    setTimeout(() => {
      if (open === request) settle(chooseMove(request.state, request.options));
    }, 0);
  }

  function cancel() {
    if (!open) return;
    settle(null);
    worker?.terminate();
    worker = null;
  }

  function choose(state, options) {
    cancel();
    return new Promise((resolve) => {
      open = { id: (lastId += 1), resolve, state, options };
      const target = getWorker();
      if (target) target.postMessage({ id: open.id, state, level: options.level, seed: options.seed });
      else runHere(open);
    });
  }

  return { choose, cancel };
}
