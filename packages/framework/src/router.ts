/**
 * @mfe/framework — native client-side router.
 *
 * A ~60-line browser-native router replacing the `page` npm dependency.
 * Uses history.pushState, listens to popstate, and delegates click handling
 * to a single listener on the document.
 */

export interface Route {
  /** The path pattern. Supports exact paths and `:param` segments. */
  path: string;
  /** Optional route name for reverse lookup. */
  name?: string;
}

export interface RouterNavigateEvent {
  /** The matched route path pattern. */
  route: Route;
  /** The actual pathname that was navigated to. */
  pathname: string;
  /** URL params extracted from `:param` segments. */
  params: Record<string, string>;
  /** The full URL. */
  url: URL;
}

export interface CreateRouterOptions {
  /** Array of route definitions. */
  routes: Route[];
  /**
   * Optional base path prefix (e.g. '/dhake') for apps served at a subpath
   * such as a GitHub Pages project site. When set, the prefix is stripped
   * from incoming pathnames before route matching, so routes are defined
   * relative to it. Defaults to '/'.
   */
  basePath?: string;
  /**
   * Called when navigation occurs (pushState or popstate).
   * Receives the navigation event with route info and params.
   */
  onNavigate(event: RouterNavigateEvent): void;
  /**
   * Whether to intercept clicks on same-origin <a> elements.
   * Defaults to true.
   */
  interceptClicks?: boolean;
  /**
   * Whether to run `onNavigate` immediately for the current location at
   * creation time. Defaults to true. Set to false when the caller (e.g.
   * createApp) performs and awaits the initial render itself.
   */
  renderOnInit?: boolean;
}

/**
 * Match a pathname against a route pattern and extract params.
 * Pattern segments starting with `:` are param placeholders.
 * Returns the matched route and params, or null if no match.
 */
function matchRoute(pathname: string, routes: Route[]): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    const result = matchPattern(pathname, route.path);
    if (result) {
      return { route, params: result };
    }
  }
  return null;
}

/**
 * Match a pathname against a single pattern and extract params.
 * Pattern: "/users/:id" matches "/users/123" → { id: "123" }.
 * Pattern: "/" matches "/".
 */
function matchPattern(pathname: string, pattern: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = pathParts[i];
    } else if (part !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Strip a basePath prefix from a pathname before route matching.
 * Both are normalized so leading/trailing slashes don't break comparison.
 * - basePath '/' (or empty) is a no-op: the pathname is returned unchanged.
 * - '/dhake' + '/dhake/' -> '/'; '/dhake' + '/dhake/home' -> '/home'.
 * - A pathname not under basePath is returned unchanged, so a wrong-base
 *   request falls through to normal (non-)matching instead of 404ing oddly.
 */
function stripBasePath(pathname: string, basePath: string): string {
  const base = basePath && basePath !== '/' ? basePath.replace(/\/+$/, '') : '';
  if (!base) return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(base + '/')) return pathname.slice(base.length);
  return pathname;
}

/**
 * The router instance returned by createRouter.
 */
export interface Router {
  /**
   * Navigate to a path programmatically.
   * Uses history.pushState and triggers onNavigate.
   */
  navigate(path: string): void;
  /**
   * Replace the current history entry.
   */
  replace(path: string): void;
  /**
   * Get the current pathname.
   */
  get pathname(): string;
  /**
   * Destroy the router and remove all event listeners.
   */
  destroy(): void;
}

/**
 * Create a browser-native router.
 *
 * Listens to click events on the document for <a> navigation, uses
 * history.pushState for navigation, dispatches a custom `app:route` event,
 * and handles popstate for back/forward.
 *
 * Click handling:
 * - Same-origin links navigate in-shell (no target=_blank, no modifier keys).
 * - Cross-origin links are left to the browser, UNLESS the anchor carries a
 *   `data-mfe-route` attribute naming a local route — then a plain click
 *   navigates in-shell to that route (for cross-origin MFE nav links whose
 *   `href` is the real absolute URL). Modifier clicks / target=_blank still
 *   fall through to the real URL.
 */
export function createRouter(opts: CreateRouterOptions): Router {
  const { routes, onNavigate, interceptClicks = true, renderOnInit = true, basePath = '/' } = opts;

  // Resolve a pathname to a route, stripping the basePath prefix first so apps
  // served at a subpath match routes defined relative to that subpath. The
  // navigation event still carries the original (unstripped) pathname.
  const resolveMatch = (pathname: string) => matchRoute(stripBasePath(pathname, basePath), routes);

  // Route paths are defined relative to basePath. When pushing a URL for a
  // route (programmatic navigate/replace, or a data-mfe-route in-shell nav),
  // re-prefix the basePath so the address bar reflects the real location (e.g.
  // route '/fixpoint-linux' under basePath '/dhake' -> '/dhake/fixpoint-linux').
  // Idempotent: a path already under the base is returned unchanged.
  const toFullPath = (path: string): string => {
    const base = basePath && basePath !== '/' ? basePath.replace(/\/+$/, '') : '';
    if (!base) return path;
    if (path === base || path.startsWith(base + '/')) return path;
    if (path === '/') return base + '/';
    return base + '/' + path.replace(/^\/+/, '');
  };

  const handlePopState = (): void => {
    const pathname = window.location.pathname;
    const match = resolveMatch(pathname);
    if (match) {
      onNavigate({
        route: match.route,
        pathname,
        params: match.params,
        url: new URL(window.location.href),
      });
    }
  };

  const handleClick = (ev: MouseEvent): void => {
    if (!interceptClicks) return;

    const node = ev.target as Element | null;
    const target = node && typeof node.closest === 'function' ? node.closest('a') : null;
    // `tagName === 'A'` is used instead of `instanceof HTMLAnchorElement` so the
    // router works in DOM environments without that global (e.g. happy-dom / SSR).
    if (!target || (target as Element).tagName !== 'A') return;

    // Skip if modifier key pressed
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    // Skip if target=_blank or other special targets
    if (target.target && target.target !== '_self') return;

    // data-mfe-route: a cross-origin MFE nav link. The anchor's `href` is the
    // real absolute URL (correct for hover/copy/open-in-new-tab/SEO), but a
    // plain click should navigate in-shell to the named local route instead of
    // leaving the page. Only intercepted when that local route actually
    // matches — otherwise the (cross-origin) href is left to the browser.
    const mfeRoute = target.getAttribute('data-mfe-route');
    if (mfeRoute) {
      const mfeUrl = new URL(mfeRoute, window.location.href);
      // mfeRoute is a local route path (relative to basePath); strip any base
      // for matching, then re-prefix it for the pushed URL so the address bar
      // stays under the basePath.
      const mfePath = stripBasePath(mfeUrl.pathname, basePath);
      const mfeMatch = matchRoute(mfePath, routes);
      if (mfeMatch) {
        ev.preventDefault();
        const fullUrl = new URL(toFullPath(mfePath), window.location.href);
        window.history.pushState({}, '', fullUrl);
        onNavigate({
          route: mfeMatch.route,
          pathname: fullUrl.pathname,
          params: mfeMatch.params,
          url: fullUrl,
        });
        // Dispatch custom event for any other listeners
        window.dispatchEvent(
          new CustomEvent('app:route', {
            detail: { route: mfeMatch.route, pathname: fullUrl.pathname, params: mfeMatch.params, url: fullUrl },
          }),
        );
      }
      return;
    }

    // Skip if not same-origin
    const href = target.getAttribute('href');
    if (!href) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    // Skip if it's a hash-only link (let browser handle)
    if (url.pathname === window.location.pathname && url.hash) return;

    // Prevent default and navigate
    ev.preventDefault();
    const pathname = url.pathname;
    const match = resolveMatch(pathname);
    if (match) {
      window.history.pushState({}, '', url);
      onNavigate({
        route: match.route,
        pathname,
        params: match.params,
        url,
      });
      // Dispatch custom event for any other listeners
      window.dispatchEvent(
        new CustomEvent('app:route', {
          detail: { route: match.route, pathname, params: match.params, url },
        }),
      );
    }
  };

  // Initial navigation
  if (renderOnInit) {
    const pathname = window.location.pathname;
    const match = resolveMatch(pathname);
    if (match) {
      onNavigate({
        route: match.route,
        pathname,
        params: match.params,
        url: new URL(window.location.href),
      });
    }
  }

  window.addEventListener('popstate', handlePopState);
  if (interceptClicks) {
    document.addEventListener('click', handleClick, { capture: true });
  }

  return {
    navigate(path: string): void {
      const url = new URL(path, window.location.href);
      const match = resolveMatch(url.pathname);
      if (match) {
        const fullUrl = new URL(toFullPath(url.pathname), window.location.href);
        window.history.pushState({}, '', fullUrl);
        onNavigate({
          route: match.route,
          pathname: fullUrl.pathname,
          params: match.params,
          url: fullUrl,
        });
        window.dispatchEvent(
          new CustomEvent('app:route', {
            detail: { route: match.route, pathname: fullUrl.pathname, params: match.params, url: fullUrl },
          }),
        );
      }
    },
    replace(path: string): void {
      const url = new URL(path, window.location.href);
      const match = resolveMatch(url.pathname);
      if (match) {
        const fullUrl = new URL(toFullPath(url.pathname), window.location.href);
        window.history.replaceState({}, '', fullUrl);
        onNavigate({
          route: match.route,
          pathname: fullUrl.pathname,
          params: match.params,
          url: fullUrl,
        });
        window.dispatchEvent(
          new CustomEvent('app:route', {
            detail: { route: match.route, pathname: fullUrl.pathname, params: match.params, url: fullUrl },
          }),
        );
      }
    },
    get pathname(): string {
      return window.location.pathname;
    },
    destroy(): void {
      window.removeEventListener('popstate', handlePopState);
      if (interceptClicks) {
        document.removeEventListener('click', handleClick, { capture: true });
      }
    },
  };
}
