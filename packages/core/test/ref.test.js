// ref.test.js — hardened structural ref identity (see src/ref.ts).
//
// The naive `childNodes.indexOf(node) + nodeName` from the original prototype
// is unstable: inserting a text/comment node shifts every sibling's index even
// though the element layout is unchanged. makeRef uses element-only sibling
// index (previousElementSibling) plus an optional data-ref/id escape hatch.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { makeRef } from '../dist/index.js';
import { makeDoc } from './_helpers.js';

// Parse a tiny single-root template string and return its root Element.
function parse(doc, html) {
  const t = doc.createElement('template');
  t.innerHTML = html;
  return t.content.firstElementChild;
}

// Extract a slot element by [data-mfe] from a parsed root.
function slot(root, name) {
  return root.querySelector(`[data-mfe="${name}"]`);
}

describe('makeRef', () => {
  it('builds a document-relative path of localName[index] levels', () => {
    const doc = makeDoc();
    const root = parse(doc, '<div><p></p><section data-mfe="x"></section></div>');
    // section has one element sibling (p) before it → section[1]; root div[0].
    assert.equal(makeRef(slot(root, 'x')), 'div[0]/section[1]');
  });

  it('is stable when a text node is inserted before the slot (hardened case)', () => {
    const doc = makeDoc();
    const withoutText = parse(doc, '<div><span></span><section data-mfe="x"></section></div>');
    // Whitespace text node inserted between the span and the section.
    const withText = parse(doc, '<div><span></span>\n  <section data-mfe="x"></section></div>');

    const refNoText = makeRef(slot(withoutText, 'x'));
    const refWithText = makeRef(slot(withText, 'x'));
    assert.equal(refNoText, refWithText, 'text-node insertion must not change the ref');
    assert.equal(refNoText, 'div[0]/section[1]');
  });

  it('is stable when the number of preceding text/comment nodes changes', () => {
    const doc = makeDoc();
    const a = parse(doc, '<div><section data-mfe="x"></section></div>');
    const b = parse(doc, '<div><!-- c -->\n\t<section data-mfe="x"></section></div>');
    // Only text/comment nodes precede the section in both cases → section[0].
    assert.equal(makeRef(slot(a, 'x')), makeRef(slot(b, 'x')));
    assert.equal(makeRef(slot(a, 'x')), 'div[0]/section[0]');
  });

  it('detects a real reorder (a sibling element inserted before the slot)', () => {
    const doc = makeDoc();
    const before = parse(doc, '<div><p></p><span></span><section data-mfe="x"></section></div>');
    const after = parse(doc, '<div><p></p><span></span><b></b><section data-mfe="x"></section></div>');

    const refBefore = makeRef(slot(before, 'x'));
    const refAfter = makeRef(slot(after, 'x'));
    assert.notEqual(refBefore, refAfter, 'a real element insertion must change the ref');
    assert.equal(refBefore, 'div[0]/section[2]');
    assert.equal(refAfter, 'div[0]/section[3]');
  });

  it('short-circuits a level with data-ref, staying stable under real reorder', () => {
    const doc = makeDoc();
    const alone = parse(doc, '<div><section data-mfe="x" data-ref="cart"></section></div>');
    const withSibling = parse(doc, '<div><b></b><section data-mfe="x" data-ref="cart"></section></div>');

    assert.equal(makeRef(slot(alone, 'x')), makeRef(slot(withSibling, 'x')));
    assert.equal(makeRef(slot(alone, 'x')), 'div[0]/section#cart');
  });

  it('uses id as an escape hatch when data-ref is absent', () => {
    const doc = makeDoc();
    const root = parse(doc, '<div><section data-mfe="x" id="cart"></section></div>');
    assert.equal(makeRef(slot(root, 'x')), 'div[0]/section#cart');
  });

  it('prefers data-ref over id when both are present', () => {
    const doc = makeDoc();
    const root = parse(doc, '<div><section data-mfe="x" data-ref="a" id="b"></section></div>');
    assert.equal(makeRef(slot(root, 'x')), 'div[0]/section#a');
  });

  it('uses localName (lowercase) rather than nodeName for HTML elements', () => {
    const doc = makeDoc();
    const root = parse(doc, '<DIV><SECTION data-mfe="x"></SECTION></DIV>');
    assert.equal(makeRef(slot(root, 'x')), 'div[0]/section[0]');
  });

  it('honours the root option by stopping the walk at the boundary', () => {
    const doc = makeDoc();
    // Detach a nested subtree and pass the section's immediate parent as root.
    const root = parse(doc, '<main><div><section data-mfe="x"></section></div></main>');
    const div = root.querySelector('div');
    const sec = slot(root, 'x');
    assert.equal(makeRef(sec), 'main[0]/div[0]/section[0]');
    assert.equal(makeRef(sec, { root: div }), 'div[0]/section[0]');
  });

  it('returns a stable value for a root element with no ancestors', () => {
    const doc = makeDoc();
    const root = parse(doc, '<div><section data-mfe="x"></section></div>');
    assert.equal(makeRef(root), 'div[0]');
  });
});
