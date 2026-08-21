/**
 * @mfe/core — the reconciliation kernel.
 *
 * `reconcile` diffs the slots of a freshly parsed template against a registry
 * of currently-mounted MFEs and decides, per slot, between four actions:
 *
 *   NEW          — MFE name not in the registry        → load + mount
 *   TRANSPLANT   — same MFE, unchanged ref             → move live childNodes
 *                                                         (state preserved, no re-render)
 *   UPDATE       — same MFE, moved ref                 → mfe.update(prev, next, ctx)
 *   UNMOUNT      — MFE name gone from the new template → mfe.unmount + drop
 *
 * This is a faithful generalization of the prototype's `loadAllMFEs`: the
 * hardcoded `fetch(name)` for templates, `import(name)` for MFE modules and
 * the module-global `running` map are all moved behind injected callbacks and
 * an explicit per-instance registry, making the kernel app-agnostic.
 */
import { collect } from './dom.js';
import type { Registry, RegistryEntry } from './registry.js';
import { createRegistry } from './registry.js';
import type { HostInterface, MFE, MountContext } from './types.js';

/** What reconcile was doing when an error occurred. */
export type ReconcileAction = 'mount' | 'update' | 'unmount' | 'transplant';

/** Context describing a per-slot error reported through `onError`. */
export interface ReconcileError {
  action: ReconcileAction;
  name: string;
  ref: string;
  /** The slot element involved (the new one for mount/update/transplant). */
  element?: Element;
  error: unknown;
}

/** Options for {@link reconcile}. */
export interface ReconcileOptions {
  /** Load (and cache) the MFE module for a slot by its `data-mfe` name. */
  loadModule(name: string): Promise<MFE>;
  /** The host interface handed to every MFE lifecycle hook. */
  host: HostInterface;
  /**
   * The registry to diff against and mutate. Omit to use a throwaway
   * registry (stateless — useful for one-shot renders / SSR).
   */
  registry?: Registry;
  /**
   * Called when a per-slot lifecycle step throws. Reconciliation continues
   * with the remaining slots; without this, the first error rejects the whole
   * render.
   */
  onError?(err: ReconcileError): void;
}

/**
 * Diff `root`'s slots against the registry and return `root` populated with
 * mounted / transplanted MFE output.
 *
 * `root` must be a *detached* template root (as returned by
 * {@link loadTemplate}): reconcile mutates `root` in place but does not
 * attach it to the document — the caller places it where it belongs after the
 * promise resolves. Because the fresh template is detached, live childNodes
 * transplanted from previously-mounted slots are preserved across the swap.
 */
export async function reconcile(root: Element, opts: ReconcileOptions): Promise<Element> {
  const registry: Registry = opts.registry ?? createRegistry();
  const { loadModule, host } = opts;
  const onError = opts.onError ?? ((): void => {});

  const slots = collect(root);

  // Pass 1 — reconcile every slot in the new template.
  for (const slot of slots) {
    const existing: RegistryEntry | undefined = registry.get(slot.name);

    if (!existing) {
      // NEW → load + mount.
      await mountNew(registry, slot, { loadModule, host, onError });
      continue;
    }

    if (existing.ref === slot.ref) {
      // SAME MFE + SAME REF → transplant live DOM, preserve state, no re-render.
      transplant(existing.element, slot.element);
      existing.element = slot.element;
      // If the slot's props changed at a stable ref, the MFE must be told to
      // re-render; otherwise we'd silently render stale props while the
      // registry (and future unmount ctx) carry props the MFE never saw.
      if (!shallowEqual(existing.props, slot.props)) {
        const ctx: MountContext = { host, ref: slot.ref, props: slot.props };
        try {
          await existing.mfe.update(existing.element, slot.element, ctx);
        } catch (error) {
          report(onError, { action: 'update', name: slot.name, ref: slot.ref, element: slot.element, error });
        }
      }
      existing.props = slot.props;
      registry.set(existing);
      continue;
    }

    // SAME MFE + MOVED REF → inform the MFE it needs to re-render.
    const ctx: MountContext = { host, ref: slot.ref, props: slot.props };
    try {
      await existing.mfe.update(existing.element, slot.element, ctx);
    } catch (error) {
      report(onError, { action: 'update', name: slot.name, ref: slot.ref, element: slot.element, error });
      // Best-effort fallback: move whatever live DOM survives so the MFE stays
      // visible in the new slot, and adopt the new ref so future renders
      // transplant instead of retrying a failing update.
      transplant(existing.element, slot.element);
      existing.element = slot.element;
      existing.ref = slot.ref;
      existing.props = slot.props;
      registry.set(existing);
      continue;
    }
    existing.element = slot.element;
    existing.ref = slot.ref;
    existing.props = slot.props;
    registry.set(existing);
  }

  // Pass 2 — unmount MFEs no longer present in the new template.
  const present = new Set(slots.map((s) => s.name));
  for (const entry of registry.entries()) {
    if (present.has(entry.name)) continue;
    const ctx: MountContext = { host, ref: entry.ref, props: entry.props };
    try {
      await entry.mfe.unmount(entry.element, ctx);
    } catch (error) {
      report(onError, { action: 'unmount', name: entry.name, ref: entry.ref, element: entry.element, error });
    } finally {
      // Always drop the entry: the slot is gone from the page, so keeping it
      // would leak a reference to a discarded element.
      registry.delete(entry.name);
    }
  }

  return root;
}

interface MountCtx {
  loadModule(name: string): Promise<MFE>;
  host: HostInterface;
  onError(err: ReconcileError): void;
}

/** Load + mount a brand-new MFE slot. Never throws (reports via onError). */
async function mountNew(
  registry: Registry,
  slot: { name: string; ref: string; element: Element; props?: Record<string, unknown> },
  ctx: MountCtx,
): Promise<void> {
  const { host } = ctx;
  let mfe: MFE;
  try {
    mfe = await ctx.loadModule(slot.name);
  } catch (error) {
    report(ctx.onError, { action: 'mount', name: slot.name, ref: slot.ref, element: slot.element, error });
    return;
  }
  const mountCtx: MountContext = { host, ref: slot.ref, props: slot.props };
  try {
    await mfe.mount(slot.element, mountCtx);
  } catch (error) {
    report(ctx.onError, { action: 'mount', name: slot.name, ref: slot.ref, element: slot.element, error });
    return;
  }
  registry.set({ name: slot.name, ref: slot.ref, element: slot.element, mfe, props: slot.props });
}

/**
 * Move all live childNodes from `source` into `target` (state preserved, no
 * re-render). The target is cleared first so placeholder/SSR content in the
 * fresh template slot is replaced by the live children.
 */
function transplant(source: Element, target: Element): void {
  while (target.firstChild) target.removeChild(target.firstChild);
  for (const child of Array.from(source.childNodes)) {
    target.appendChild(child);
  }
}

function report(onError: (err: ReconcileError) => void, err: ReconcileError): void {
  try {
    onError(err);
  } catch {
    // The error handler itself must never break reconciliation.
  }
}

/** True when `a` and `b` have the same own keys and shallow-equal values. */
function shallowEqual(a?: Record<string, unknown>, b?: Record<string, unknown>): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
