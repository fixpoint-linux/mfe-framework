/**
 * @mfe/core — hardened structural refs.
 *
 * A *ref* is a stable string identity for a slot element within its template.
 * Reconcile uses refs to answer one question across two renders of the SAME
 * template: "did this MFE's slot move, and did it move to the same place?"
 *
 * Why not the naive `childNodes.indexOf(node) + nodeName` (as in the original
 * prototype)? Because `childNodes` counts text/comment nodes, so inserting a
 * whitespace text node (or any attribute change that shifts parsing) changes
 * every sibling's index even though the *element* layout is unchanged. That
 * makes a stable slot look like it moved, causing an avoidable re-render (or,
 * worse, a full unmount/remount and silent state loss).
 *
 * The hardened algorithm builds a path from ELEMENT-only sibling index
 * (counting `previousElementSibling` — text/comment nodes are skipped) plus
 * `localName`, and lets an explicit stable key (`data-ref` or `id`) on any
 * ancestor short-circuit that level. Element-only indexing is sufficient
 * because reconcile only ever compares two renders of the SAME template, in
 * which slots are structurally unique.
 */

/** Options for {@link makeRef}. */
export interface MakeRefOptions {
  /**
   * Optional boundary element. The walk stops *after* including `root`,
   * so refs become relative to `root` rather than to the whole document.
   * Use this to make refs independent of where the app shell is embedded.
   */
  root?: Element;
}

/**
 * Compute the hardened structural ref of an element.
 *
 * Walking from `el` up through its ancestors, each level contributes either
 *   `localName#key`   — if the element has a `data-ref` or `id` attribute
 *                       (explicit, stable identity that short-circuits the
 *                       positional index), or
 *   `localName[N]`    — otherwise, where N is the ELEMENT-only sibling index
 *                       (number of `previousElementSibling`s).
 * Levels are joined with `/` from the top-most ancestor down to `el`.
 *
 * SVG is fine (uses `localName`). Shadow DOM / iframes are out of scope.
 */
export function makeRef(el: Element, opts?: MakeRefOptions): string {
  const parts: string[] = [];
  let n: Element | null = el;
  while (n) {
    const key = n.getAttribute('data-ref') || n.id;
    if (key) {
      parts.unshift(`${n.localName}#${key}`);
    } else {
      let i = 0;
      let s: Element | null = n.previousElementSibling;
      while (s) {
        i++;
        s = s.previousElementSibling;
      }
      parts.unshift(`${n.localName}[${i}]`);
    }
    if (opts?.root && n === opts.root) break;
    n = n.parentElement;
  }
  return parts.join('/');
}
