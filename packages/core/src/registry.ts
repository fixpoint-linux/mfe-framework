/**
 * @mfe/core — the running-MFE registry.
 *
 * A registry tracks which MFEs are currently mounted, keyed by MFE *name*
 * (the `data-mfe` attribute value), along with the live slot element and the
 * last-seen structural ref for that MFE. Reconcile consults the registry to
 * decide between transplant / update / unmount for a freshly parsed template.
 *
 * The original prototype used a module-global `running` map, which couples
 * core to a single app instance. `createRegistry()` returns a *per-instance*
 * registry so multiple app shells can coexist, each with its own state.
 */
import type { MFE } from './types.js';

/** A single mounted-MFE record held in a registry. */
export interface RegistryEntry {
  /** MFE name — the `data-mfe` attribute value; the registry key. */
  name: string;
  /** The last-seen structural ref of the slot (see ref.ts). */
  ref: string;
  /** The live slot element the MFE currently renders into. */
  element: Element;
  /** The loaded MFE module (kept so we don't re-load it on every reconcile). */
  mfe: MFE;
  /** The props last passed to the MFE (replayed on unmount ctx). */
  props?: Record<string, unknown>;
}

/** The per-instance registry API. */
export interface Registry {
  /** Look up a mounted MFE by name. */
  get(name: string): RegistryEntry | undefined;
  /** Insert or replace a mounted MFE. */
  set(entry: RegistryEntry): void;
  /** Remove a mounted MFE by name. Returns true if it existed. */
  delete(name: string): boolean;
  /** Whether a MFE name is currently mounted. */
  has(name: string): boolean;
  /** Names of all currently-mounted MFEs. */
  names(): string[];
  /** All registry entries (as a fresh array). */
  entries(): RegistryEntry[];
  /** Remove all entries. */
  clear(): void;
  /** Number of currently-mounted MFEs. */
  readonly size: number;
}

/**
 * Create a fresh, empty registry instance. One registry should be created per
 * app shell and passed to {@link reconcile} on every render so that mounted
 * MFE state survives navigation.
 */
export function createRegistry(): Registry {
  const map = new Map<string, RegistryEntry>();
  return {
    get(name) {
      return map.get(name);
    },
    set(entry) {
      map.set(entry.name, entry);
    },
    delete(name) {
      return map.delete(name);
    },
    has(name) {
      return map.has(name);
    },
    names() {
      return [...map.keys()];
    },
    entries() {
      return [...map.values()];
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}
