/**
 * @mfe/framework — Micro-frontend framework layer.
 *
 * Public API:
 *   createRouter    — Native client-side router (replaces `page` npm dep)
 *   createTemplateLoader — Template loader with in-memory cache
 *   createApp       — App shell that wires router → loader → reconcile
 *
 * Types:
 *   Router, CreateRouterOptions, RouterNavigateEvent, Route
 *   TemplateLoader, CreateTemplateLoaderOptions
 *   App, CreateAppOptions, AppRoute
 */
export {
  createRouter,
  type Router,
  type CreateRouterOptions,
  type RouterNavigateEvent,
  type Route,
} from './router.js';

export {
  createTemplateLoader,
  type TemplateLoader,
  type CreateTemplateLoaderOptions,
} from './template-loader.js';

export {
  createApp,
  type App,
  type CreateAppOptions,
  type AppRoute,
} from './app.js';
