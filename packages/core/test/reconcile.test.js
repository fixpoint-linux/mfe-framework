// reconcile.test.js — the reconciliation kernel diff semantics (src/reconcile.ts).
//
// Four actions, per slot, across two renders of the SAME template:
//   NEW        → load + mount
//   TRANSPLANT → same MFE + same ref → move live childNodes (state preserved)
//   UPDATE     → same MFE + moved ref → mfe.update(prev, next, ctx)
//   UNMOUNT    → MFE gone from template → mfe.unmount + drop
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRegistry, loadTemplate, reconcile } from '../dist/index.js';
import { createMfe, makeDoc, makeHost } from './_helpers.js';

const T_ONE_SLOT = '<div><section data-mfe="header"></section></div>';
const T_MOVED = '<div><p></p><section data-mfe="header"></section></div>';
const T_EMPTY = '<div><p>no mfe</p></div>';

describe('reconcile', () => {
  it('mounts a brand-new MFE slot', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const modules = new Map();
    const { mfe, calls } = createMfe({ render: () => '<div class="live">LIVE</div>' });
    modules.set('header', mfe);

    const root = loadTemplate(T_ONE_SLOT, doc);
    const returned = await reconcile(root, { loadModule: async (n) => modules.get(n), host, registry });

    assert.strictEqual(returned, root, 'reconcile returns the root element');
    assert.equal(calls.mount.length, 1);
    assert.equal(calls.update.length, 0);
    const ctx = calls.mount[0].ctx;
    assert.strictEqual(ctx.host, host);
    assert.equal(ctx.ref, 'div[0]/section[0]');
    assert.equal(ctx.props, undefined);
    assert.strictEqual(calls.mount[0].element, root.querySelector('section'));
    assert.equal(root.querySelector('.live').textContent, 'LIVE');
    assert.equal(registry.has('header'), true);
    assert.equal(registry.size, 1);
  });

  it('transplants live childNodes for same MFE + same ref (no re-render, state preserved)', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const modules = new Map();
    const { mfe, calls } = createMfe({ render: () => '<div class="live">LIVE</div>' });
    modules.set('header', mfe);

    // First render: mount.
    const root1 = loadTemplate(T_ONE_SLOT, doc);
    await reconcile(root1, { loadModule: async (n) => modules.get(n), host, registry });
    const liveNode1 = root1.querySelector('.live');

    // Second render: identical template → transplant, NOT re-mount.
    const root2 = loadTemplate(T_ONE_SLOT, doc);
    await reconcile(root2, { loadModule: async (n) => modules.get(n), host, registry });

    assert.equal(calls.mount.length, 1, 'mount must not run again');
    assert.equal(calls.update.length, 0, 'update must not run on unchanged ref');
    assert.equal(calls.unmount.length, 0);

    const liveNode2 = root2.querySelector('.live');
    assert.strictEqual(liveNode2, liveNode1, 'the live node is moved, not recreated → state preserved');
    assert.equal(liveNode2.textContent, 'LIVE');
    // The old element lost its child; the registry now points at the new element.
    assert.equal(root1.querySelector('.live'), null);
    assert.strictEqual(registry.get('header').element, root2.querySelector('section'));
  });

  it('calls update() when the same MFE moves to a new ref', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const modules = new Map();
    const { mfe, calls } = createMfe({ render: (phase) => `<div class="live">${phase}</div>` });
    modules.set('header', mfe);

    const root1 = loadTemplate(T_ONE_SLOT, doc);
    await reconcile(root1, { loadModule: async (n) => modules.get(n), host, registry });
    const prevSection = root1.querySelector('section');

    // Template where an element sibling was inserted before the slot → ref changed.
    const root2 = loadTemplate(T_MOVED, doc);
    const nextSection = root2.querySelector('section');
    await reconcile(root2, { loadModule: async (n) => modules.get(n), host, registry });

    assert.equal(calls.mount.length, 1, 'mount must not run again for a moved slot');
    assert.equal(calls.unmount.length, 0);
    assert.equal(calls.update.length, 1);
    const u = calls.update[0];
    assert.strictEqual(u.prev, prevSection, 'prev is the old slot element');
    assert.strictEqual(u.next, nextSection, 'next is the new slot element');
    assert.equal(u.ctx.ref, 'div[0]/section[1]');
    assert.strictEqual(nextSection.firstElementChild, nextSection.querySelector('.live'));
    assert.equal(nextSection.querySelector('.live').textContent, 'update');

    // Registry tracks the new element + ref.
    assert.equal(registry.get('header').ref, 'div[0]/section[1]');
    assert.strictEqual(registry.get('header').element, nextSection);
  });

  it('unmounts an MFE whose slot disappeared from the template', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const modules = new Map();
    const { mfe, calls } = createMfe();
    modules.set('header', mfe);

    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async (n) => modules.get(n), host, registry });
    const slot = registry.get('header').element;

    await reconcile(loadTemplate(T_EMPTY, doc), { loadModule: async (n) => modules.get(n), host, registry });

    assert.equal(calls.unmount.length, 1);
    assert.strictEqual(calls.unmount[0].element, slot);
    assert.equal(registry.has('header'), false);
    assert.equal(registry.size, 0);
  });

  it('mounts a new MFE while leaving an already-mounted one untouched', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const modules = new Map();
    const header = createMfe({ render: () => '<h1>H</h1>' });
    const footer = createMfe({ render: () => '<h1>F</h1>' });
    modules.set('header', header.mfe);
    modules.set('footer', footer.mfe);

    // Render 1: header only.
    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async (n) => modules.get(n), host, registry });
    // Render 2: footer only → header unmounts, footer mounts.
    await reconcile(loadTemplate('<div><footer data-mfe="footer"></footer></div>', doc), {
      loadModule: async (n) => modules.get(n),
      host,
      registry,
    });

    assert.equal(header.calls.unmount.length, 1);
    assert.equal(footer.calls.mount.length, 1);
    assert.equal(footer.calls.mount[0].ctx.ref, 'div[0]/footer[0]');
    assert.equal(registry.has('header'), false);
    assert.equal(registry.has('footer'), true);

    // Render 3: both — footer (same ref) transplants, header mounts fresh.
    // NB: the new header slot must come AFTER footer so footer's ref is
    // unchanged (footer[0]); a slot inserted before it would legitimately
    // change footer's ref and trigger update() instead.
    await reconcile(
      loadTemplate('<div><footer data-mfe="footer"></footer><section data-mfe="header"></section></div>', doc),
      { loadModule: async (n) => modules.get(n), host, registry },
    );
    assert.equal(header.calls.mount.length, 2, 'header remounts (mounted in render 1, unmounted, then remounted in render 3)');
    assert.equal(footer.calls.mount.length, 1, 'footer is not re-mounted');
    assert.equal(footer.calls.update.length, 0);
    assert.equal(registry.size, 2);
  });

  it('preserves mounted state across multiple identical renders (no churn)', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const modules = new Map();
    const { mfe, calls } = createMfe();
    modules.set('header', mfe);

    for (let i = 0; i < 5; i++) {
      await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async (n) => modules.get(n), host, registry });
    }
    assert.equal(calls.mount.length, 1);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.unmount.length, 0);
    assert.equal(registry.size, 1);
  });

  it('is stateless when no registry is passed (each call mounts fresh)', async () => {
    const doc = makeDoc();
    const host = makeHost();
    const { mfe, calls } = createMfe();
    const loadModule = async () => mfe;
    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule, host });
    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule, host });
    assert.equal(calls.mount.length, 2);
  });

  it('passes slot props into the mount context', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const { mfe, calls } = createMfe();
    await reconcile(
      loadTemplate('<div><section data-mfe="x" data-mfe-props=\'{"sku":"A1"}\'></section></div>', doc),
      { loadModule: async () => mfe, host, registry },
    );
    assert.deepEqual(calls.mount[0].ctx.props, { sku: 'A1' });
  });

  it('triggers update when props change at a stable ref, but transplants on unchanged props', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const { mfe, calls } = createMfe();
    const withProps = (sku) =>
      `<div><section data-mfe="x" data-mfe-props='{"sku":"${sku}"}'></section></div>`;

    // First render — mount with props {sku:A1}.
    await reconcile(loadTemplate(withProps('A1'), doc), { loadModule: async () => mfe, host, registry });
    assert.equal(calls.mount.length, 1);
    assert.deepEqual(calls.mount[0].ctx.props, { sku: 'A1' });
    assert.equal(calls.update.length, 0);

    // Same ref, UNCHANGED props → transplant only (no re-render).
    await reconcile(loadTemplate(withProps('A1'), doc), { loadModule: async () => mfe, host, registry });
    assert.equal(calls.update.length, 0);

    // Same ref, CHANGED props → transplant + update() so the MFE re-renders with new props.
    await reconcile(loadTemplate(withProps('A2'), doc), { loadModule: async () => mfe, host, registry });
    assert.equal(calls.update.length, 1);
    assert.deepEqual(calls.update[0].ctx.props, { sku: 'A2' });
    // Registry props now reflect the latest slot.
    assert.deepEqual(registry.get('x').props, { sku: 'A2' });
  });

  it('reports load errors via onError and leaves the slot unmounted', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const errs = [];
    const root = loadTemplate('<div><section data-mfe="bad"></section></div>', doc);
    await reconcile(root, {
      loadModule: async () => {
        throw new Error('boom');
      },
      host,
      registry,
      onError: (e) => errs.push(e),
    });
    assert.equal(errs.length, 1);
    assert.equal(errs[0].action, 'mount');
    assert.equal(errs[0].name, 'bad');
    assert.equal(errs[0].ref, 'div[0]/section[0]');
    assert.ok(errs[0].error instanceof Error);
    assert.equal(registry.has('bad'), false);
  });

  it('reports mount errors and continues with remaining slots', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const errs = [];
    const bad = { mount: async () => { throw new Error('mount fail'); } };
    const good = createMfe({ render: () => '<b>ok</b>' });
    await reconcile(loadTemplate('<div><section data-mfe="a"></section><section data-mfe="b"></section></div>', doc), {
      loadModule: async (n) => (n === 'a' ? bad : good.mfe),
      host,
      registry,
      onError: (e) => errs.push(e),
    });
    assert.equal(errs.length, 1);
    assert.equal(errs[0].action, 'mount');
    assert.equal(errs[0].name, 'a');
    assert.equal(registry.has('a'), false);
    assert.equal(registry.has('b'), true);
    assert.equal(good.calls.mount.length, 1);
  });

  it('transplants and adopts the new ref when update fails (MFE stays visible)', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    let updates = 0;
    const mfe = {
      async mount(el) { el.innerHTML = '<i>stable</i>'; },
      async update() { updates++; throw new Error('update fail'); },
      async unmount() {},
    };
    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async () => mfe, host, registry });

    const errs = [];
    const root2 = loadTemplate(T_MOVED, doc);
    await reconcile(root2, { loadModule: async () => mfe, host, registry, onError: (e) => errs.push(e) });

    assert.equal(errs.length, 1);
    assert.equal(errs[0].action, 'update');
    // The live content survives into the new slot, and the entry adopts the new ref.
    const newSlot = root2.querySelector('section[data-mfe="header"]');
    assert.equal(newSlot.innerHTML, '<i>stable</i>');
    assert.equal(registry.get('header').ref, 'div[0]/section[1]');
    // A follow-up render of the same moved template transplants (no retry of update).
    await reconcile(loadTemplate(T_MOVED, doc), { loadModule: async () => mfe, host, registry, onError: () => {} });
    assert.equal(updates, 1);
  });

  it('continues even if the onError handler itself throws', async () => {
    const doc = makeDoc();
    const registry = createRegistry();
    const host = makeHost();
    const good = createMfe({ render: () => '<b>ok</b>' });
    const root = loadTemplate('<div><section data-mfe="a"></section><section data-mfe="b"></section></div>', doc);
    await reconcile(root, {
      loadModule: async (n) => (n === 'a' ? { mount: async () => { throw new Error('x'); } } : good.mfe),
      host,
      registry,
      onError: () => { throw new Error('handler exploded'); },
    });
    // The good slot still mounted despite the handler blowing up on the bad one.
    assert.equal(registry.has('b'), true);
    assert.equal(good.calls.mount.length, 1);
  });

  it('supports multiple independent app shells via separate registries', async () => {
    const doc = makeDoc();
    const host = makeHost();
    const { mfe: mfeA, calls: callsA } = createMfe();
    const { mfe: mfeB, calls: callsB } = createMfe();

    const registryA = createRegistry();
    const registryB = createRegistry();

    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async () => mfeA, host, registry: registryA });
    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async () => mfeB, host, registry: registryB });

    assert.equal(callsA.mount.length, 1);
    assert.equal(callsB.mount.length, 1);
    assert.equal(registryA.has('header'), true);
    assert.equal(registryB.has('header'), true);
    // Navigating shell A (identical template) does not touch shell B's MFE.
    await reconcile(loadTemplate(T_ONE_SLOT, doc), { loadModule: async () => mfeA, host, registry: registryA });
    assert.equal(callsA.mount.length, 1);
    assert.equal(callsB.mount.length, 1);
  });
});
