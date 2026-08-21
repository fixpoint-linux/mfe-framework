// app.test.js — createApp tests
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../dist/index.js';
import { makeWindow, createMfe, createMockFetch, createMockImport } from './_helpers.js';

describe('createApp', () => {
  let window;
  let document;

  beforeEach(() => {
    window = makeWindow();
    document = window.document;
    global.window = window;
    global.document = document;
    global.CustomEvent = window.CustomEvent;
    global.history = window.history;
    global.fetch = null;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.CustomEvent;
    delete global.history;
    delete global.fetch;
  });

  it('creates an app with router, templateLoader, and registry', async () => {
    const mockFetch = createMockFetch({
      'home': '<div><section data-mfe="header"></section><main data-mfe="homepage"></main></div>',
    });
    global.fetch = mockFetch;

    const app = await createApp({
      root: document.getElementById('app') || document.createElement('div'),
      routes: [{ path: '/', template: 'home' }],
      baseURL: '',
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
    });

    assert.ok(app.router);
    assert.ok(app.templateLoader);
    assert.ok(app.registry);
    assert.ok(Array.isArray(app.routes));
    assert.equal(app.routes.length, 1);

    app.destroy();
  });

  it('mounts MFEs for matched routes', async () => {
    const headerMfe = createMfe({ render: () => '<h1>Header</h1>' });
    const homepageMfe = createMfe({ render: () => '<p>Homepage</p>' });

    const mockFetch = createMockFetch({
      'home': '<div><section data-mfe="header"></section><main data-mfe="homepage"></main></div>',
    });
    global.fetch = mockFetch;

    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = await createApp({
      root,
      routes: [{ path: '/', template: 'home' }],
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
      importModule: createMockImport({
        header: headerMfe.mfe,
        homepage: homepageMfe.mfe,
      }),
    });

    // Check that MFEs were mounted
    assert.equal(headerMfe.calls.mount.length, 1);
    assert.equal(homepageMfe.calls.mount.length, 1);

    app.destroy();
  });

  it('handles navigation between routes', async () => {
    const headerMfe = createMfe({ render: () => '<h1>Header</h1>' });
    const homepageMfe = createMfe({ render: () => '<p>Homepage</p>' });
    const aboutMfe = createMfe({ render: () => '<p>About</p>' });

    const mockFetch = createMockFetch({
      'home': '<div><section data-mfe="header"></section><main data-mfe="homepage"></main></div>',
      'about': '<div><section data-mfe="header"></section><main data-mfe="about"></main></div>',
    });
    global.fetch = mockFetch;

    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = await createApp({
      root,
      routes: [
        { path: '/', template: 'home' },
        { path: '/about', template: 'about' },
      ],
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
      importModule: createMockImport({
        header: headerMfe.mfe,
        homepage: homepageMfe.mfe,
        about: aboutMfe.mfe,
      }),
    });

    // Initially at /, header and homepage should be mounted
    assert.equal(headerMfe.calls.mount.length, 1);
    assert.equal(homepageMfe.calls.mount.length, 1);
    assert.equal(aboutMfe.calls.mount.length, 0);

    // Navigate to /about
    app.navigate('/about');

    // Wait for async navigation
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Header should still be mounted (transplanted), homepage unmounted, about mounted
    assert.equal(headerMfe.calls.mount.length, 1); // Still 1, not remounted
    assert.equal(homepageMfe.calls.unmount.length, 1);
    assert.equal(aboutMfe.calls.mount.length, 1);

    app.destroy();
  });

  it('passes props to MFEs', async () => {
    const mfe = createMfe({ render: (phase, ctx) => `<div>${JSON.stringify(ctx.props)}</div>` });

    const mockFetch = createMockFetch({
      'page': '<div><section data-mfe="test"></section></div>',
    });
    global.fetch = mockFetch;

    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = await createApp({
      root,
      routes: [{ path: '/', template: 'page', props: { title: 'Home' } }],
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
      importModule: createMockImport({
        test: mfe.mfe,
      }),
    });

    assert.equal(mfe.calls.mount.length, 1);
    assert.deepEqual(mfe.calls.mount[0].ctx.props, { title: 'Home' });

    app.destroy();
  });

  it('handles :param in route paths', async () => {
    const userMfe = createMfe({ render: (phase, ctx) => `<div>User: ${ctx.props.id}</div>` });

    const mockFetch = createMockFetch({
      'user': '<div><main data-mfe="user"></main></div>',
    });
    global.fetch = mockFetch;

    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = await createApp({
      root,
      routes: [{ path: '/users/:id', template: 'user' }],
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
      importModule: createMockImport({
        user: userMfe.mfe,
      }),
    });

    // Navigate to /users/123
    app.navigate('/users/123');
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(userMfe.calls.mount.length, 1);
    assert.deepEqual(userMfe.calls.mount[0].ctx.props, { id: '123' });

    app.destroy();
  });

  it('navigate() and replace() work programmatically', async () => {
    const mfe = createMfe({ render: () => '<div>Test</div>' });

    const mockFetch = createMockFetch({
      'page': '<div><main data-mfe="test"></main></div>',
    });
    global.fetch = mockFetch;

    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = await createApp({
      root,
      routes: [{ path: '/', template: 'page' }],
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
      importModule: createMockImport({
        test: mfe.mfe,
      }),
    });

    const initialMounts = mfe.calls.mount.length;

    // Navigate to same route
    app.navigate('/');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should have triggered a re-render
    assert.equal(mfe.calls.mount.length, initialMounts);

    app.destroy();
  });

  it('destroy() cleans up resources', async () => {
    const mockFetch = createMockFetch({
      'home': '<div><section data-mfe="header"></section></div>',
    });
    global.fetch = mockFetch;

    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = await createApp({
      root,
      routes: [{ path: '/', template: 'home' }],
      loadTemplate: async (name) => {
        const html = mockFetch.templates[name];
        const t = document.createElement('template');
        t.innerHTML = html;
        return t.content.firstElementChild;
      },
      importModule: createMockImport({}),
    });

    assert.equal(app.registry.size, 0); // No MFEs mounted yet (no importModule for header)

    app.destroy();

    // Registry should be cleared
    assert.equal(app.registry.size, 0);
  });
});
