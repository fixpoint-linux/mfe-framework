// registry.test.js — per-instance registry (src/registry.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRegistry } from '../dist/index.js';
import { createMfe, makeDoc } from './_helpers.js';

describe('createRegistry', () => {
  it('is empty initially', () => {
    const r = createRegistry();
    assert.equal(r.size, 0);
    assert.deepEqual(r.names(), []);
    assert.deepEqual(r.entries(), []);
    assert.equal(r.has('header'), false);
    assert.equal(r.get('header'), undefined);
  });

  it('stores and retrieves entries keyed by name', () => {
    const doc = makeDoc();
    const { mfe } = createMfe();
    const r = createRegistry();
    const entry = { name: 'header', ref: 'div[0]/header[0]', element: doc.createElement('header'), mfe };
    r.set(entry);
    assert.equal(r.has('header'), true);
    assert.equal(r.get('header'), entry);
    assert.deepEqual(r.names(), ['header']);
    assert.deepEqual(r.entries(), [entry]);
    assert.equal(r.size, 1);
  });

  it('overwrites an existing name on set', () => {
    const doc = makeDoc();
    const { mfe } = createMfe();
    const r = createRegistry();
    r.set({ name: 'x', ref: 'a', element: doc.createElement('div'), mfe });
    const second = { name: 'x', ref: 'b', element: doc.createElement('div'), mfe };
    r.set(second);
    assert.equal(r.get('x'), second);
    assert.equal(r.size, 1);
  });

  it('deletes by name', () => {
    const doc = makeDoc();
    const { mfe } = createMfe();
    const r = createRegistry();
    r.set({ name: 'x', ref: 'a', element: doc.createElement('div'), mfe });
    assert.equal(r.delete('x'), true);
    assert.equal(r.has('x'), false);
    assert.equal(r.delete('x'), false);
    assert.equal(r.size, 0);
  });

  it('clears all entries', () => {
    const doc = makeDoc();
    const { mfe } = createMfe();
    const r = createRegistry();
    r.set({ name: 'a', ref: '1', element: doc.createElement('div'), mfe });
    r.set({ name: 'b', ref: '2', element: doc.createElement('div'), mfe });
    r.clear();
    assert.equal(r.size, 0);
    assert.deepEqual(r.names(), []);
  });

  it('returns fresh arrays so callers cannot mutate internal state', () => {
    const doc = makeDoc();
    const { mfe } = createMfe();
    const r = createRegistry();
    r.set({ name: 'a', ref: '1', element: doc.createElement('div'), mfe });
    const names = r.names();
    const entries = r.entries();
    names.push('injected');
    entries.length = 0;
    assert.deepEqual(r.names(), ['a']);
    assert.equal(r.size, 1);
  });

  it('gives each call a fully independent registry instance', () => {
    const a = createRegistry();
    const b = createRegistry();
    const doc = makeDoc();
    const { mfe } = createMfe();
    a.set({ name: 'x', ref: '1', element: doc.createElement('div'), mfe });
    assert.equal(a.has('x'), true);
    assert.equal(b.has('x'), false);
  });
});
