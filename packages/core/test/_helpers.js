// Shared helpers for @mfe/core tests.
// This file is intentionally *not* matched by the node --test glob
// (only *.test.js files are), so it is safe to import from test files.
import { Window } from 'happy-dom';

/** A fresh happy-dom Document (no global DOM required). */
export function makeDoc() {
  return new Window().document;
}

/** A minimal HostInterface stub. */
export function makeHost() {
  return { addHeadTag: () => () => {} };
}

/**
 * Build a fake MFE module plus a call recorder.
 * `render` is invoked inside mount/update and its return value is assigned to
 * `element.innerHTML`, so tests can observe what is live in a slot.
 */
export function createMfe({ render = () => '' } = {}) {
  const calls = { mount: [], update: [], unmount: [] };
  const mfe = {
    async mount(element, ctx) {
      calls.mount.push({ element, ctx });
      element.innerHTML = render('mount', ctx);
    },
    async update(prev, next, ctx) {
      calls.update.push({ prev, next, ctx });
      next.innerHTML = render('update', ctx);
    },
    async unmount(element, ctx) {
      calls.unmount.push({ element, ctx });
    },
  };
  return { mfe, calls };
}
