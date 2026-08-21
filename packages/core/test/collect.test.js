// collect.test.js — slot gathering (src/dom.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { collect, loadTemplate } from '../dist/index.js';
import { makeDoc } from './_helpers.js';

describe('collect', () => {
  it('gathers every [data-mfe] slot with name, element, ref', () => {
    const doc = makeDoc();
    const root = loadTemplate(
      '<div><header data-mfe="header"></header><section data-mfe="plp"></section><footer data-mfe="footer"></footer></div>',
      doc,
    );
    const slots = collect(root);
    assert.deepEqual(slots.map((s) => s.name), ['header', 'plp', 'footer']);
    assert.equal(slots[0].element.tagName, 'HEADER');
    // Document order preserved.
    assert.equal(slots[1].element.tagName, 'SECTION');
    // Refs computed and unique per slot.
    assert.equal(slots[0].ref, 'div[0]/header[0]');
    assert.equal(slots[1].ref, 'div[0]/section[1]');
    assert.equal(slots[2].ref, 'div[0]/footer[2]');
    // No props when the attribute is absent.
    assert.equal(slots[0].props, undefined);
  });

  it('is stable across two parses of the same template (identical refs)', () => {
    const doc = makeDoc();
    const a = collect(loadTemplate('<div><p></p><section data-mfe="x"></section></div>', doc));
    const b = collect(loadTemplate('<div><p></p><section data-mfe="x"></section></div>', doc));
    assert.equal(a[0].ref, b[0].ref);
  });

  it('decodes data-mfe-props JSON into props', () => {
    const doc = makeDoc();
    const root = loadTemplate(
      '<div><section data-mfe="x" data-mfe-props=\'{"sku":"A1","qty":3}\'></section></div>',
      doc,
    );
    const [slot] = collect(root);
    assert.deepEqual(slot.props, { sku: 'A1', qty: 3 });
  });

  it('degrades to undefined props on malformed/empty data-mfe-props', () => {
    const doc = makeDoc();
    const malformed = collect(loadTemplate('<div><section data-mfe="x" data-mfe-props="not json"></section></div>', doc));
    assert.equal(malformed[0].props, undefined);
    const empty = collect(loadTemplate('<div><section data-mfe="x" data-mfe-props=""></section></div>', doc));
    assert.equal(empty[0].props, undefined);
    const nonObject = collect(loadTemplate('<div><section data-mfe="x" data-mfe-props="[1,2]"></section></div>', doc));
    assert.equal(nonObject[0].props, undefined);
  });

  it('skips elements with an empty data-mfe name', () => {
    const doc = makeDoc();
    const root = loadTemplate('<div><section data-mfe=""></section><section data-mfe="x"></section></div>', doc);
    const slots = collect(root);
    assert.deepEqual(slots.map((s) => s.name), ['x']);
  });

  it('returns an empty array for a template with no slots', () => {
    const doc = makeDoc();
    const root = loadTemplate('<div><p>no mfe here</p></div>', doc);
    assert.deepEqual(collect(root), []);
  });
});
