/**
 * @mfe/core — DOM helpers for discovering slots in a parsed template.
 */
import { makeRef } from './ref.js';
import type { Slot } from './types.js';

/** Selector for slot elements. Slots are `[data-mfe]` elements. */
export const SLOT_SELECTOR = '[data-mfe]';

/**
 * Return all slot elements under `root`, in document order.
 */
export function querySlotElements(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(SLOT_SELECTOR));
}

/**
 * Read the MFE name from a slot element (the `data-mfe` attribute value),
 * or `null` if absent/empty.
 */
export function getSlotName(el: Element): string | null {
  const name = el.getAttribute('data-mfe');
  return name ? name : null;
}

/**
 * Decode the `data-mfe-props` attribute (a JSON object) into a props record.
 * Returns `undefined` when the attribute is absent or not valid JSON, rather
 * than throwing, so a malformed slot degrades gracefully to no props.
 */
export function getSlotProps(el: Element): Record<string, unknown> | undefined {
  const raw = el.getAttribute('data-mfe-props');
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Gather all slots in a parsed template root as {@link Slot} objects.
 *
 * Refs are computed with plain {@link makeRef}. Because a freshly parsed
 * template root is detached (its ancestor chain ends at the root element),
 * these refs are automatically *root-relative*: the same template parsed
 * twice yields identical refs regardless of where the root is eventually
 * embedded in the document. (No dependence on a global `Element`, so this
 * works under SSR too.)
 *
 * Slot elements without a `data-mfe` name are skipped.
 */
export function collect(root: ParentNode): Slot[] {
  const slots: Slot[] = [];
  for (const el of querySlotElements(root)) {
    const name = getSlotName(el);
    if (!name) continue;
    slots.push({
      name,
      element: el,
      ref: makeRef(el),
      props: getSlotProps(el),
    });
  }
  return slots;
}
