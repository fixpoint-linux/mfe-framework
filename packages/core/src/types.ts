/**
 * @mfe/core — public types shared across the framework.
 *
 * These types define the *contract* between an app (which owns the page
 * shell, the router and the template sources) and a micro-frontend module
 * (a single `data-mfe` slot implementation).
 *
 * @mfe/core itself is app-agnostic: it never fetches templates, never
 * imports MFE modules, and never touches a specific host. All of that is
 * injected through `reconcile`'s options (see reconcile.ts).
 */

/**
 * A micro-frontend module.
 *
 * A module implementing this interface is loaded lazily per slot via the
 * `loadModule(name)` callback supplied to `reconcile`. It is expected to be
 * a singleton module (ESM) that renders *into* the given slot `element`.
 */
export interface MFE {
  /**
   * Render this MFE's UI into `element` for the first time.
   * `element` is the slot's `[data-mfe]` element in the freshly parsed
   * template; it is empty on a client-side mount.
   */
  mount(element: Element, ctx: MountContext): Promise<void>;
  /**
   * Tear down the UI previously rendered into `element`, releasing any
   * event listeners / subscriptions.
   */
  unmount(element: Element, ctx: MountContext): Promise<void>;
  /**
   * Re-render when the slot's structural ref changed between two renders of
   * the same template (i.e. the slot *moved*) while the MFE stayed mounted.
   * `prev` is the previous slot element, `next` the new one; `ctx` describes
   * the new location. The MFE is responsible for moving/cleaning its UI out
   * of `prev` and (re)rendering into `next`.
   */
  update(prev: Element, next: Element, ctx: MountContext): Promise<void>;
  /**
   * Optional one-time host bootstrap (e.g. subscribing to the host's bus /
   * store, installing head tags). Called by the framework layer when the app
   * boots, *not* per slot mount.
   */
  initialize?(host: HostInterface): Promise<void>;
}

/**
 * The interface an app exposes to its MFEs. Kept minimal here; the bus/store
 * members are added by the @mfe/framework layer in P3.
 */
export interface HostInterface {
  /**
   * Append a node (e.g. a <link> or <script>) to the document head.
   * Returns a disposer that removes the node.
   */
  addHeadTag(node: Node): () => void;
  /** Optional cross-MFE event bus (added by @mfe/framework). */
  bus?: unknown;
  /** Optional shared state store (added by @mfe/framework). */
  store?: unknown;
}

/**
 * A single `[data-mfe]` slot discovered in a parsed template.
 * `ref` is the hardened structural identity of the slot element (see ref.ts).
 */
export interface Slot {
  /** The MFE name — value of the `data-mfe` attribute. */
  name: string;
  /** The slot element itself. */
  element: Element;
  /** Hardened structural ref (makeRef). */
  ref: string;
  /** Optional props decoded from the slot's `data-mfe-props` attribute. */
  props?: Record<string, unknown>;
}

/**
 * Context handed to an MFE's lifecycle hooks at mount/update/unmount time.
 */
export interface MountContext {
  host: HostInterface;
  ref: string;
  props?: Record<string, unknown>;
}
