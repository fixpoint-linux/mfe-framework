/**
 * Tests for @mfe/framework/store.ts
 * Shared state store with shallow/immutable diffing.
 */
import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { makeWindow } from './_helpers.js';

// Import the compiled ESM
import { createStore } from '../dist/store.js';

describe('createStore', () => {
  let store;

  beforeEach(() => {
    store = createStore({ count: 0, name: 'test' });
  });

  it('should create a store instance with expected methods', () => {
    assert.ok(typeof store.getState === 'function', 'store.getState should be a function');
    assert.ok(typeof store.setState === 'function', 'store.setState should be a function');
    assert.ok(typeof store.subscribe === 'function', 'store.subscribe should be a function');
  });

  it('should return initial state via getState', () => {
    const state = store.getState();
    assert.deepEqual(state, { count: 0, name: 'test' });
  });

  it('should return a copy of state (immutable)', () => {
    const state = store.getState();
    state.count = 999;
    const state2 = store.getState();
    assert.equal(state2.count, 0, 'Original state should not be mutated');
  });

  it('should update state with partial object', () => {
    store.setState({ count: 5 });
    const state = store.getState();
    assert.deepEqual(state, { count: 5, name: 'test' });
  });

  it('should update state with updater function', () => {
    store.setState((prev) => ({ ...prev, count: prev.count + 1 }));
    const state = store.getState();
    assert.deepEqual(state, { count: 1, name: 'test' });
  });

  it('should notify subscribers on state change', () => {
    const states = [];
    const unsubscribe = store.subscribe((state) => states.push({ ...state }));
    
    store.setState({ count: 1 });
    store.setState({ count: 2 });
    
    assert.equal(states.length, 3); // Initial state + 2 updates
    assert.deepEqual(states[0], { count: 0, name: 'test' }); // Initial state
    assert.deepEqual(states[1], { count: 1, name: 'test' });
    assert.deepEqual(states[2], { count: 2, name: 'test' });
    
    unsubscribe();
  });

  it('should not notify subscribers when state does not change (shallow equal)', () => {
    const states = [];
    const unsubscribe = store.subscribe((state) => states.push({ ...state }));
    
    // Same values
    store.setState({ count: 0, name: 'test' });
    
    assert.equal(states.length, 1, 'Should only have initial state, no update notification');
    
    unsubscribe();
  });

  it('should notify subscribers when deep values change but shallow is same', () => {
    // Create a store with nested object
    const nestedStore = createStore({ items: [{ id: 1 }] });
    const states = [];
    const unsubscribe = nestedStore.subscribe((state) => states.push({ ...state }));
    
    // Replace the array (shallow change)
    nestedStore.setState({ items: [{ id: 2 }] });
    
    assert.equal(states.length, 2, 'Should notify on shallow change');
    assert.deepEqual(states[1].items, [{ id: 2 }]);
    
    unsubscribe();
  });

  it('should not notify when mutating nested values without setState', () => {
    const nestedStore = createStore({ items: [{ id: 1 }] });
    const states = [];
    const unsubscribe = nestedStore.subscribe((state) => states.push({ ...state }));
    
    // Mutate the array directly (not recommended, but should not trigger notification)
    const state = nestedStore.getState();
    state.items.push({ id: 2 });
    
    // setState with same reference
    nestedStore.setState({ items: state.items });
    
    // Since we're passing the same array reference, shallow equal will pass
    // and no notification should occur
    assert.equal(states.length, 1, 'Should not notify when shallow equal');
    
    unsubscribe();
  });

  it('should return disposer from subscribe that stops notifications', () => {
    const states = [];
    const unsubscribe = store.subscribe((state) => states.push({ ...state }));
    
    store.setState({ count: 1 });
    unsubscribe();
    store.setState({ count: 2 });
    
    assert.equal(states.length, 2, 'Should only have initial + one update before unsubscribe');
    assert.deepEqual(states[1], { count: 1, name: 'test' });
  });

  it('should handle multiple subscribers', () => {
    const states1 = [];
    const states2 = [];
    
    store.subscribe((state) => states1.push({ ...state }));
    store.subscribe((state) => states2.push({ ...state }));
    
    store.setState({ count: 1 });
    
    assert.equal(states1.length, 2);
    assert.equal(states2.length, 2);
    assert.deepEqual(states1[1], { count: 1, name: 'test' });
    assert.deepEqual(states2[1], { count: 1, name: 'test' });
  });

  it('should handle complex state objects', () => {
    const complexStore = createStore({
      user: { id: '123', name: 'John' },
      basket: [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }],
      settings: { theme: 'dark', notifications: true },
    });
    
    const state = complexStore.getState();
    assert.deepEqual(state.user, { id: '123', name: 'John' });
    assert.deepEqual(state.basket, [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }]);
    assert.deepEqual(state.settings, { theme: 'dark', notifications: true });
  });

  it('should handle empty initial state', () => {
    const emptyStore = createStore({});
    const state = emptyStore.getState();
    assert.deepEqual(state, {});
    
    emptyStore.setState({ key: 'value' });
    const newState = emptyStore.getState();
    assert.deepEqual(newState, { key: 'value' });
  });

  it('should handle updater function that returns new object', () => {
    store.setState((prev) => {
      return { count: prev.count + 10, name: prev.name.toUpperCase() };
    });
    
    const state = store.getState();
    assert.deepEqual(state, { count: 10, name: 'TEST' });
  });

  it('should handle multiple sequential updates', () => {
    store.setState({ count: 1 });
    store.setState({ count: 2 });
    store.setState({ count: 3 });
    
    const state = store.getState();
    assert.equal(state.count, 3);
    assert.equal(state.name, 'test');
  });

  it('should merge new state with existing state', () => {
    store.setState({ completely: 'new', state: 'object' });
    
    const state = store.getState();
    // setState merges with existing state
    assert.deepEqual(state, { count: 0, name: 'test', completely: 'new', state: 'object' });
    assert.equal(state.count, 0);
    assert.equal(state.name, 'test');
  });

  it('should work with typed state (runtime behavior)', () => {
    // This test verifies the store works with typed-like state structures
    const typedStore = createStore({ basket: [] });
    
    typedStore.setState({ basket: [{ id: 1, quantity: 5 }] });
    typedStore.setState((prev) => ({
      ...prev,
      basket: [...prev.basket, { id: 2, quantity: 3 }],
    }));
    
    const state = typedStore.getState();
    assert.deepEqual(state.basket, [{ id: 1, quantity: 5 }, { id: 2, quantity: 3 }]);
    
    const states = [];
    const unsubscribe = typedStore.subscribe((state) => {
      states.push({ ...state });
    });
    
    unsubscribe();
    assert.ok(true, 'Typed store works correctly');
  });
});
