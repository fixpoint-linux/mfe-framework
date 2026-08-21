/**
 * @mfe/framework — Shared state store with shallow/immutable diffing.
 *
 * Provides a simple, observable state container for cross-MFE shared state.
 * State is plain data (serializable for SSR).
 */

export interface Store<T> {
  /**
   * Get the current state (returns a copy to prevent mutation).
   */
  getState(): T;
  /**
   * Update state using an updater function or a partial state object.
   * Uses shallow comparison to detect changes before notifying subscribers.
   */
  setState(updater: ((prev: T) => T) | Partial<T>): void;
  /**
   * Subscribe to state changes. Returns a disposer function.
   * Subscribers are notified only when the state actually changes (shallow diff).
   */
  subscribe(listener: (state: T) => void): () => void;
}

/**
 * Shallow equality check for objects.
 * Returns true if all top-level keys have the same values (by reference).
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const keysA = Object.keys(a as object) as Array<keyof T>;
  const keysB = Object.keys(b as object) as Array<keyof T>;
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key as string] !== (b as Record<string, unknown>)[key as string]) {
      return false;
    }
  }
  return true;
}

/**
 * Create a store with initial state.
 *
 * @example
 * ```ts
 * interface AppState {
 *   basket: Array<{ id: number; quantity: number }>;
 *   user?: { id: string; name: string };
 * }
 *
 * const store = createStore<AppState>({ basket: [] });
 *
 * // Get state
 * const current = store.getState();
 *
 * // Update with partial
 * store.setState({ basket: [{ id: 1, quantity: 5 }] });
 *
 * // Update with updater function
 * store.setState((prev) => ({
 *   ...prev,
 *   basket: [...prev.basket, { id: 2, quantity: 3 }],
 * }));
 *
 * // Subscribe
 * const off = store.subscribe((state) => {
 *   console.log('State changed:', state);
 * });
 *
 * // Unsubscribe
 * off();
 * ```
 */
export function createStore<T extends object>(initial: T): Store<T> {
  let state: T = { ...initial };
  const subscribers = new Set<(state: T) => void>();

  return {
    getState(): T {
      // Return a shallow copy to prevent mutation of internal state
      return { ...state };
    },

    setState(updater: ((prev: T) => T) | Partial<T>): void {
      const newState = typeof updater === 'function'
        ? (updater as (prev: T) => T)(state)
        : { ...state, ...(updater as Partial<T>) };

      // Only notify if state actually changed
      if (!shallowEqual(state, newState)) {
        state = newState;
        // Notify all subscribers with a copy
        const stateCopy = { ...state };
        for (const listener of subscribers) {
          listener(stateCopy);
        }
      }
    },

    subscribe(listener: (state: T) => void): () => void {
      subscribers.add(listener);
      // Immediately notify with current state
      listener({ ...state });
      return () => subscribers.delete(listener);
    },
  };
}
