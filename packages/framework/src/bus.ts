/**
 * @mfe/framework — Typed cross-MFE event bus.
 *
 * Provides a type-safe publish/subscribe mechanism for cross-MFE communication.
 * Events are plain data (serializable for SSR).
 */

export interface Bus<Events extends Record<string, unknown>> {
  /**
   * Subscribe to an event type. Returns a disposer function.
   */
  on<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): () => void;
  /**
   * Unsubscribe a specific listener from an event type.
   */
  off<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): void;
  /**
   * Subscribe to an event type once (auto-unsubscribe after first emission).
   * Returns a disposer function.
   */
  once<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): () => void;
  /**
   * Emit an event of a specific type with its payload.
   */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
}

/**
 * Create a typed event bus.
 *
 * @example
 * ```ts
 * interface AppEvents {
 *   'basket:updated': { id: number; quantity: number };
 *   'user:login': { userId: string };
 * }
 *
 * const bus = createBus<AppEvents>();
 *
 * // Subscribe
 * const off = bus.on('basket:updated', (payload) => {
 *   console.log('Basket updated:', payload.id, payload.quantity);
 * });
 *
 * // Emit
 * bus.emit('basket:updated', { id: 1, quantity: 5 });
 *
 * // Unsubscribe
 * off();
 * ```
 */
export function createBus<Events extends Record<string, unknown>>(): Bus<Events> {
  type EventType = keyof Events;
  type Listener<T> = (payload: T) => void;

  const listeners = new Map<EventType, Set<Listener<unknown>>>();

  return {
    on<K extends EventType>(type: K, listener: Listener<Events[K]>): () => void {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      (listeners.get(type) as Set<Listener<Events[K]>>).add(listener);
      return () => this.off(type, listener);
    },

    off<K extends EventType>(type: K, listener: Listener<Events[K]>): void {
      const typeListeners = listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(listener as Listener<unknown>);
      }
    },

    once<K extends EventType>(type: K, listener: Listener<Events[K]>): () => void {
      const wrapped: Listener<Events[K]> = (payload) => {
        listener(payload);
        this.off(type, wrapped);
      };
      return this.on(type, wrapped);
    },

    emit<K extends EventType>(type: K, payload: Events[K]): void {
      const typeListeners = listeners.get(type);
      if (typeListeners) {
        // Create a copy to avoid issues if listeners are added/removed during iteration
        const listenersCopy = new Set(typeListeners);
        for (const listener of listenersCopy) {
          (listener as Listener<Events[K]>)?.(payload);
        }
      }
    },
  };
}
