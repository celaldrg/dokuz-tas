/**
 * Module Web Worker for the computer player, so a deep search never freezes
 * the page. Receives {id, state, level, seed} with `state` from
 * game.getState() and answers {id, move}.
 */
import { chooseMove } from './ai.js';

self.addEventListener('message', ({ data }) => {
  const { id, state, level, seed } = data;
  self.postMessage({ id, move: chooseMove(state, { level, seed }) });
});
