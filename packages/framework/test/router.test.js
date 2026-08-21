// router.test.js — native router tests
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createRouter } from '../dist/index.js';
import { makeWindow } from './_helpers.js';

describe('createRouter', () => {
  let window;
  let document;
  let router;
  const routes = [
    { path: '/' },
    { path: '/home' },
    { path: '/users/:id' },
    { path: '/products/:category/:id' },
  ];

  const navigateEvents = [];

  beforeEach(() => {
    window = makeWindow();
    document = window.document;
    navigateEvents.length = 0;
    
    // Mock window and document globals
    global.window = window;
    global.document = document;
    global.CustomEvent = window.CustomEvent;
    global.MouseEvent = window.MouseEvent;
    global.history = window.history;
    
    router = createRouter({
      routes,
      onNavigate: (event) => navigateEvents.push(event),
      interceptClicks: true,
    });
  });

  afterEach(() => {
    router.destroy();
    delete global.window;
    delete global.document;
    delete global.CustomEvent;
    delete global.MouseEvent;
    delete global.history;
  });

  it('matches exact path /', () => {
    assert.equal(navigateEvents.length, 1);
    assert.equal(navigateEvents[0].pathname, '/');
    assert.deepEqual(navigateEvents[0].params, {});
  });

  it('matches exact path /home', () => {
    // Simulate navigation to /home
    window.history.pushState({}, '', '/home');
    window.dispatchEvent(new window.CustomEvent('popstate'));
    
    assert.equal(navigateEvents.length, 2);
    assert.equal(navigateEvents[1].pathname, '/home');
    assert.deepEqual(navigateEvents[1].params, {});
  });

  it('matches :param pattern /users/:id', () => {
    window.history.pushState({}, '', '/users/123');
    window.dispatchEvent(new window.CustomEvent('popstate'));
    
    assert.equal(navigateEvents.length, 2);
    assert.equal(navigateEvents[1].pathname, '/users/123');
    assert.deepEqual(navigateEvents[1].params, { id: '123' });
  });

  it('matches multi-param pattern /products/:category/:id', () => {
    window.history.pushState({}, '', '/products/electronics/456');
    window.dispatchEvent(new window.CustomEvent('popstate'));
    
    assert.equal(navigateEvents.length, 2);
    assert.equal(navigateEvents[1].pathname, '/products/electronics/456');
    assert.deepEqual(navigateEvents[1].params, { category: 'electronics', id: '456' });
  });

  it('does not match non-matching paths', () => {
    window.history.pushState({}, '', '/nonexistent');
    window.dispatchEvent(new window.CustomEvent('popstate'));
    
    // Should still have only the initial navigation
    assert.equal(navigateEvents.length, 1);
  });

  it('navigate() triggers onNavigate', () => {
    router.navigate('/users/456');
    
    assert.equal(navigateEvents.length, 2);
    assert.equal(navigateEvents[1].pathname, '/users/456');
    assert.deepEqual(navigateEvents[1].params, { id: '456' });
  });

  it('replace() triggers onNavigate without adding history entry', () => {
    router.replace('/users/789');
    
    assert.equal(navigateEvents.length, 2);
    assert.equal(navigateEvents[1].pathname, '/users/789');
    assert.deepEqual(navigateEvents[1].params, { id: '789' });
  });

  it('pathname getter returns current pathname', () => {
    assert.equal(router.pathname, '/');
    
    window.history.pushState({}, '', '/users/123');
    assert.equal(router.pathname, '/users/123');
  });

  it('dispatches app:route custom event on navigation', () => {
    const events = [];
    window.addEventListener('app:route', (ev) => events.push(ev.detail));
    
    router.navigate('/users/123');
    
    assert.equal(events.length, 1);
    assert.equal(events[0].pathname, '/users/123');
    assert.deepEqual(events[0].params, { id: '123' });
  });

  it('intercepts same-origin <a> clicks', () => {
    const link = document.createElement('a');
    link.href = '/users/123';
    document.body.appendChild(link);
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    
    // Simulate click on the link
    link.dispatchEvent(clickEvent);
    
    assert.equal(navigateEvents.length, 2);
    assert.equal(navigateEvents[1].pathname, '/users/123');
    assert.deepEqual(navigateEvents[1].params, { id: '123' });
  });

  it('does not intercept clicks with modifier keys', () => {
    const link = document.createElement('a');
    link.href = '/users/123';
    document.body.appendChild(link);
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    
    link.dispatchEvent(clickEvent);
    
    // Should not have triggered navigation
    assert.equal(navigateEvents.length, 1);
  });

  it('does not intercept clicks with target=_blank', () => {
    const link = document.createElement('a');
    link.href = '/users/123';
    link.target = '_blank';
    document.body.appendChild(link);
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    
    link.dispatchEvent(clickEvent);
    
    assert.equal(navigateEvents.length, 1);
  });

  it('does not intercept cross-origin links', () => {
    const link = document.createElement('a');
    link.href = 'https://example.com/users/123';
    document.body.appendChild(link);
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    
    link.dispatchEvent(clickEvent);
    
    assert.equal(navigateEvents.length, 1);
  });

  it('does not intercept hash-only links', () => {
    const link = document.createElement('a');
    link.href = '#section';
    document.body.appendChild(link);
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    
    link.dispatchEvent(clickEvent);
    
    assert.equal(navigateEvents.length, 1);
  });

  it('destroy() removes all event listeners', () => {
    router.destroy();
    
    // These should not trigger any errors or navigation
    window.history.pushState({}, '', '/users/123');
    window.dispatchEvent(new window.CustomEvent('popstate'));
    
    // No new events should be added
    assert.equal(navigateEvents.length, 1);
  });

  it('interceptClicks=false disables click interception', () => {
    router.destroy();
    navigateEvents.length = 0;
    
    router = createRouter({
      routes,
      onNavigate: (event) => navigateEvents.push(event),
      interceptClicks: false,
    });
    
    const link = document.createElement('a');
    link.href = '/users/123';
    document.body.appendChild(link);
    
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    
    link.dispatchEvent(clickEvent);
    
    // Should not have triggered navigation via click
    assert.equal(navigateEvents.length, 1);
    
    router.destroy();
  });
});
