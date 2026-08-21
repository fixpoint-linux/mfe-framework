/**
 * @mfe/core — app-agnostic micro-frontend reconciliation kernel.
 *
 * Public API:
 *   types        — MFE, HostInterface, Slot, MountContext
 *   makeRef      — hardened structural slot identity
 *   collect      — gather slots from a parsed template
 *   loadTemplate — parse an HTML template string into a detached Element
 *   createRegistry — per-instance mounted-MFE registry
 *   reconcile    — diff a template's slots against a registry
 *
 * The kernel never fetches templates, never imports MFE modules, and never
 * assumes a particular host. Everything app-specific is injected through
 * `reconcile`'s options and `loadTemplate`'s document argument.
 */
export type {
  MFE,
  HostInterface,
  Slot,
  MountContext,
} from './types.js';

export { makeRef } from './ref.js';
export type { MakeRefOptions } from './ref.js';

export {
  SLOT_SELECTOR,
  querySlotElements,
  getSlotName,
  getSlotProps,
  collect,
} from './dom.js';

export { loadTemplate } from './template.js';

export { createRegistry } from './registry.js';
export type { Registry, RegistryEntry } from './registry.js';

export { reconcile } from './reconcile.js';
export type {
  ReconcileAction,
  ReconcileError,
  ReconcileOptions,
} from './reconcile.js';
