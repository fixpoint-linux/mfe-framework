/**
 * Demo app bootstrap.
 *
 * This is the entry point for the demo application.
 * It bootstraps the @mfe/framework app shell with:
 * - Native router
 * - Template loader
 * - Dynamic import for MFEs via browser import map
 * - Placeholder vanilla MFEs
 */
import { createApp } from '@mfe/framework';

// Routes configuration
const routes = [
  {
    path: '/',
    template: 'home',
    name: 'home',
  },
  {
    path: '/about',
    template: 'about',
    name: 'about',
  },
  {
    path: '/users/:id',
    template: 'user',
    name: 'user',
  },
];

// Templates (inlined for demo simplicity - in production these would be fetched)
const templates: Record<string, string> = {
  home: `<div>
    <header data-mfe="/mf/header"></header>
    <main data-mfe="/mf/homepage"></main>
  </div>`,
  about: `<div>
    <header data-mfe="/mf/header"></header>
    <main data-mfe="/mf/about"></main>
  </div>`,
  user: `<div>
    <header data-mfe="/mf/header"></header>
    <main data-mfe="/mf/user"></main>
  </div>`,
};

// Create a template loader with inlined templates
const templateLoader = {
  load: async (name: string) => {
    const html = templates[name];
    if (!html) {
      throw new Error(`Template not found: ${name}`);
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    const el = template.content.firstElementChild;
    if (!el) {
      throw new Error(`Template ${name} produced no root element`);
    }
    return el as Element;
  },
  clearCache: () => {},
  preload: (name: string, html: string) => {
    templates[name] = html;
  },
};

// Create the app
const root = document.getElementById('app');
if (!root) {
  throw new Error('Root element #app not found');
}

createApp({
  root,
  routes,
  loadTemplate: templateLoader.load.bind(templateLoader),
  // Use dynamic import which will resolve via the browser's import map
  importModule: async (name: string) => {
    const module = await import(/* @vite-ignore */ name);
    return module.default || module;
  },
  ssr: true, // Enable SSR rehydration if present
}).then((app) => {
  console.log('App started', app);
  
  // Expose app globally for debugging
  (window as any).app = app;
}).catch((err) => {
  console.error('Failed to start app:', err);
});
