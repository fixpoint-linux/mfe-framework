/**
 * @mfe/core — template parsing.
 *
 * Templates are plain HTML strings parsed client-side via a `<template>`
 * element. This is DOM-agnostic: it accepts an optional `Document` (defaulting
 * to the global `document`) so it works both in a browser and under a DOM
 * implementation used for SSR / tests (happy-dom, jsdom, …).
 */

/**
 * Parse an HTML string into a detached `Element`.
 *
 * The HTML is parsed inside a `<template>` element and the *first element
 * child* of the template's content is returned. A template is expected to
 * have exactly one root element.
 *
 * @param html The template source (plain HTML).
 * @param doc  A `Document` to parse with. Defaults to the global `document`.
 *             Must be provided in environments without a global document.
 * @returns The root `Element` of the parsed template, detached from the DOM.
 */
export function loadTemplate(html: string, doc?: Document): Element {
  const d: Document | undefined = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!d) {
    throw new Error(
      'loadTemplate: no Document available. Pass one explicitly when there is no global document (e.g. in SSR).',
    );
  }
  const template = d.createElement('template');
  template.innerHTML = html.trim();
  const el = template.content.firstElementChild;
  if (!el) {
    throw new Error('loadTemplate: template produced no root element.');
  }
  return el;
}
