// Shared helpers for @mfe/framework tests.
import { Window } from 'happy-dom';

/** A fresh happy-dom Window/Document for testing. */
export function makeWindow() {
  return new Window();
}

/** A fresh happy-dom Document. */
export function makeDoc() {
  return makeWindow().document;
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
  const calls = { mount: [], update: [], unmount: [], initialize: [] };
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
    async initialize(host) {
      calls.initialize.push({ host });
    },
  };
  return { mfe, calls };
}

/**
 * Create a mock fetch that returns templates from an in-memory map.
 */
export function createMockFetch(templates = {}) {
  return async (url) => {
    const name = Object.keys(templates).find((k) => url.includes(k));
    if (!name) {
      return { ok: false, status: 404 };
    }
    return {
      ok: true,
      text: async () => templates[name],
    };
  };
}

/**
 * Create a mock dynamic import that returns MFEs from an in-memory map.
 */
export function createMockImport(mfes = {}) {
  return async (name) => {
    const mfe = mfes[name];
    if (!mfe) {
      throw new Error(`Module not found: ${name}`);
    }
    return { default: mfe };
  };
}
