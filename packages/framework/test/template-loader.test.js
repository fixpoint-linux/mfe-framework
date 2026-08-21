// template-loader.test.js — template loader tests
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTemplateLoader } from '../dist/index.js';
import { makeWindow } from './_helpers.js';

describe('createTemplateLoader', () => {
  let window;
  let document;

  beforeEach(() => {
    window = makeWindow();
    document = window.document;
    global.window = window;
    global.document = document;
    global.fetch = null; // Will be mocked per-test
  });

  it('loads and caches templates', async () => {
    const templates = {
      'home': '<div><h1>Home</h1></div>',
      'about': '<section><p>About</p></section>',
    };

    const mockFetch = async (url) => {
      const name = Object.keys(templates).find((k) => url.includes(k));
      if (!name) {
        return { ok: false };
      }
      return {
        ok: true,
        text: async () => templates[name],
      };
    };

    global.fetch = mockFetch;

    const loader = createTemplateLoader({ fetchImpl: mockFetch });

    // First load
    const el1 = await loader.load('home');
    assert.equal(el1.tagName, 'DIV');
    assert.equal(el1.querySelector('h1')?.textContent, 'Home');

    // Second load should use cache (no fetch call)
    const el2 = await loader.load('home');
    assert.equal(el2.tagName, 'DIV');
    assert.equal(el2.querySelector('h1')?.textContent, 'Home');

    // Verify it's a different element (cloned)
    assert.notStrictEqual(el1, el2);
  });

  it('preloads templates into cache', async () => {
    const mockFetch = async () => {
      throw new Error('Should not be called');
    };

    global.fetch = mockFetch;

    const loader = createTemplateLoader({ fetchImpl: mockFetch });
    
    // Preload a template
    loader.preload('home', '<div><h1>Preloaded</h1></div>');

    // Load should use preloaded content
    const el = await loader.load('home');
    assert.equal(el.tagName, 'DIV');
    assert.equal(el.querySelector('h1')?.textContent, 'Preloaded');
  });

  it('clears cache', async () => {
    const mockFetch = async (url) => {
      if (url.includes('home')) {
        return { ok: true, text: async () => '<div>Home</div>' };
      }
      return { ok: false };
    };

    global.fetch = mockFetch;

    const loader = createTemplateLoader({ fetchImpl: mockFetch });

    // Load and cache
    await loader.load('home');

    // Clear cache
    loader.clearCache();

    // Load again should fetch fresh
    const el = await loader.load('home');
    assert.equal(el.tagName, 'DIV');
  });

  it('throws on failed fetch', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
    });

    global.fetch = mockFetch;

    const loader = createTemplateLoader({ fetchImpl: mockFetch });

    await assert.rejects(
      async () => await loader.load('nonexistent'),
      /failed to fetch template/,
    );
  });

  it('uses baseURL for template resolution', async () => {
    const mockFetch = async (url) => {
      if (url === 'https://example.com/templates/home.html') {
        return { ok: true, text: async () => '<div>Base URL</div>' };
      }
      return { ok: false };
    };

    global.fetch = mockFetch;

    const loader = createTemplateLoader({
      baseURL: 'https://example.com/templates',
      fetchImpl: mockFetch,
    });

    const el = await loader.load('home');
    assert.equal(el.tagName, 'DIV');
    assert.equal(el.textContent, 'Base URL');
  });

  it('parses templates using @mfe/core loadTemplate', async () => {
    const mockFetch = async () => ({
      ok: true,
      text: async () => '<template><div data-mfe="test">Content</div></template>',
    });

    global.fetch = mockFetch;

    const loader = createTemplateLoader({ fetchImpl: mockFetch });

    const el = await loader.load('test');
    // loadTemplate should parse the first element child of the template
    assert.equal(el.tagName, 'DIV');
    assert.equal(el.getAttribute('data-mfe'), 'test');
  });
});
