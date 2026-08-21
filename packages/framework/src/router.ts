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
   * Called when navigation occurs (pushState or popstate).
   * Receives the navigation event with route info and params.
   */
  onNavigate(event: RouterNavigateEvent): void;
  /**
   * Whether to intercept clicks on same-origin <a> elements.
   * Defaults to true.
   */
  interceptClicks?: boolean;
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
 * Listens to click events on the document for same-origin <a> navigation
 * (no target=_blank, no modifier keys), uses history.pushState for navigation,
 * dispatches a custom `app:route` event, and handles popstate for back/forward.
 */
export function createRouter(opts: CreateRouterOptions): Router {
  const { routes, onNavigate, interceptClicks = true } = opts;

  const handlePopState = (): void => {
    const pathname = window.location.pathname;
    const match = matchRoute(pathname, routes);
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

    const target = (ev.target as HTMLElement).closest('a');
    if (!target || !(target instanceof HTMLAnchorElement)) return;

    // Skip if modifier key pressed
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    // Skip if target=_blank or other special targets
    if (target.target && target.target !== '_self') return;

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
    const match = matchRoute(pathname, routes);
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
  const pathname = window.location.pathname;
  const match = matchRoute(pathname, routes);
  if (match) {
    onNavigate({
      route: match.route,
      pathname,
      params: match.params,
      url: new URL(window.location.href),
    });
  }

  window.addEventListener('popstate', handlePopState);
  if (interceptClicks) {
    document.addEventListener('click', handleClick, { capture: true });
  }

  return {
    navigate(path: string): void {
      const url = new URL(path, window.location.href);
      const match = matchRoute(url.pathname, routes);
      if (match) {
        window.history.pushState({}, '', url);
        onNavigate({
          route: match.route,
          pathname: url.pathname,
          params: match.params,
          url,
        });
        window.dispatchEvent(
          new CustomEvent('app:route', {
            detail: { route: match.route, pathname: url.pathname, params: match.params, url },
          }),
        );
      }
    },
    replace(path: string): void {
      const url = new URL(path, window.location.href);
      const match = matchRoute(url.pathname, routes);
      if (match) {
        window.history.replaceState({}, '', url);
        onNavigate({
          route: match.route,
          pathname: url.pathname,
          params: match.params,
          url,
        });
        window.dispatchEvent(
          new CustomEvent('app:route', {
            detail: { route: match.route, pathname: url.pathname, params: match.params, url },
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
