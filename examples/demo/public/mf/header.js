/**
 * Header MFE - vanilla JS implementation
 * Exports the @mfe/core lifecycle: { mount, unmount, update, initialize }
 */
export const mount = async (element, ctx) => {
  element.innerHTML = `
    <header style="background: #333; color: white; padding: 1rem;">
      <h1>MFE Framework Demo</h1>
      <nav>
        <a href="/" style="color: white; margin-right: 1rem;">Home</a>
        <a href="/about" style="color: white; margin-right: 1rem;">About</a>
        <a href="/users/123" style="color: white;">User 123</a>
      </nav>
    </header>
  `;
};

export const unmount = async (element, ctx) => {
  element.innerHTML = '';
};

export const update = async (prev, next, ctx) => {
  // For header, we just re-render
  await mount(next, ctx);
};

export const initialize = async (host) => {
  // Could subscribe to host bus/store here
  console.log('Header MFE initialized');
};
