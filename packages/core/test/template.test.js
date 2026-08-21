// template.test.js — loadTemplate (src/template.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadTemplate } from '../dist/index.js';
import { makeDoc } from './_helpers.js';

describe('loadTemplate', () => {
  it('parses an HTML string into a detached root Element', () => {
    const doc = makeDoc();
    const root = loadTemplate('<div><p>hello</p></div>', doc);
    assert.equal(root.tagName, 'DIV');
    assert.equal(root.querySelector('p').textContent, 'hello');
    // Detached: not connected to the document.
    assert.equal(root.isConnected, false);
  });

  it('returns the first element child, trimming surrounding whitespace', () => {
    const doc = makeDoc();
    const root = loadTemplate('  \n  <main><section data-mfe="x"></section></main>  \n', doc);
    assert.equal(root.tagName, 'MAIN');
  });

  it('works with a single self-closing-style element', () => {
    const doc = makeDoc();
    const root = loadTemplate('<header></header>', doc);
    assert.equal(root.tagName, 'HEADER');
  });

  it('throws when no Document is available', () => {
    // In this node process there is no global `document`, so omitting `doc`
    // must throw rather than silently break.
    assert.throws(() => loadTemplate('<div></div>'), /no Document available/);
  });

  it('throws when the template has no root element', () => {
    const doc = makeDoc();
    assert.throws(() => loadTemplate('   ', doc), /no root element/);
    assert.throws(() => loadTemplate('<!-- only a comment -->', doc), /no root element/);
  });
});
