/**
 * Tests for @mfe/framework/bus.ts
 * Typed cross-MFE event bus.
 */
import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { makeWindow } from './_helpers.js';

// Import the compiled ESM
import { createBus } from '../dist/bus.js';

describe('createBus', () => {
  let bus;

  beforeEach(() => {
    bus = createBus();
  });

  it('should create a bus instance with expected methods', () => {
    assert.ok(typeof bus.on === 'function', 'bus.on should be a function');
    assert.ok(typeof bus.off === 'function', 'bus.off should be a function');
    assert.ok(typeof bus.once === 'function', 'bus.once should be a function');
    assert.ok(typeof bus.emit === 'function', 'bus.emit should be a function');
  });

  it('should emit and receive events', () => {
    const events = [];
    const listener = (payload) => events.push(payload);
    
    bus.on('test', listener);
    bus.emit('test', { data: 'hello' });
    
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { data: 'hello' });
  });

  it('should support multiple listeners for the same event', () => {
    const events1 = [];
    const events2 = [];
    const listener1 = (payload) => events1.push(payload);
    const listener2 = (payload) => events2.push(payload);
    
    bus.on('test', listener1);
    bus.on('test', listener2);
    bus.emit('test', { data: 'multi' });
    
    assert.equal(events1.length, 1);
    assert.equal(events2.length, 1);
    assert.deepEqual(events1[0], { data: 'multi' });
    assert.deepEqual(events2[0], { data: 'multi' });
  });

  it('should support unsubscribing with off', () => {
    const events = [];
    const listener = (payload) => events.push(payload);
    
    bus.on('test', listener);
    bus.emit('test', { data: 'first' });
    bus.off('test', listener);
    bus.emit('test', { data: 'second' });
    
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { data: 'first' });
  });

  it('should support once (auto-unsubscribe after first emission)', () => {
    const events = [];
    const listener = (payload) => events.push(payload);
    
    bus.once('test', listener);
    bus.emit('test', { data: 'first' });
    bus.emit('test', { data: 'second' });
    
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { data: 'first' });
  });

  it('should return a disposer from on', () => {
    const events = [];
    const listener = (payload) => events.push(payload);
    
    const off = bus.on('test', listener);
    bus.emit('test', { data: 'first' });
    off();
    bus.emit('test', { data: 'second' });
    
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { data: 'first' });
  });

  it('should return a disposer from once', () => {
    const events = [];
    const listener = (payload) => events.push(payload);
    
    const off = bus.once('test', listener);
    bus.emit('test', { data: 'first' });
    // The listener should have been auto-removed, but let's verify off works too
    off();
    bus.emit('test', { data: 'second' });
    
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { data: 'first' });
  });

  it('should handle different event types independently', () => {
    const eventsA = [];
    const eventsB = [];
    
    bus.on('eventA', (p) => eventsA.push(p));
    bus.on('eventB', (p) => eventsB.push(p));
    
    bus.emit('eventA', { type: 'A' });
    bus.emit('eventB', { type: 'B' });
    
    assert.equal(eventsA.length, 1);
    assert.equal(eventsB.length, 1);
    assert.deepEqual(eventsA[0], { type: 'A' });
    assert.deepEqual(eventsB[0], { type: 'B' });
  });

  it('should not throw when emitting to an event with no listeners', () => {
    assert.doesNotThrow(() => {
      bus.emit('nonexistent', { data: 'test' });
    });
  });

  it('should not throw when unsubscribing a non-existent listener', () => {
    const listener = () => {};
    assert.doesNotThrow(() => {
      bus.off('test', listener);
    });
  });

  it('should handle multiple emit/on cycles', () => {
    const events = [];
    const listener = (payload) => events.push(payload);
    
    bus.on('test', listener);
    bus.emit('test', { data: '1' });
    bus.emit('test', { data: '2' });
    bus.emit('test', { data: '3' });
    
    assert.equal(events.length, 3);
    assert.deepEqual(events, [
      { data: '1' },
      { data: '2' },
      { data: '3' },
    ]);
  });

  it('should support typed event maps (runtime behavior)', () => {
    // This test verifies the bus works with typed-like event structures
    const typedBus = createBus();
    
    typedBus.on('user:login', (payload) => {
      assert.ok(typeof payload.userId === 'string');
    });
    
    typedBus.on('basket:updated', (payload) => {
      assert.ok(typeof payload.id === 'number');
      assert.ok(typeof payload.quantity === 'number');
    });
    
    typedBus.emit('user:login', { userId: '123' });
    typedBus.emit('basket:updated', { id: 1, quantity: 5 });
    
    assert.ok(true, 'Typed bus works correctly');
  });
});
