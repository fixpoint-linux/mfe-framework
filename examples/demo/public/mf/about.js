/**
 * About MFE - vanilla JS implementation
 * Exports the @mfe/core lifecycle: { mount, unmount, update, initialize }
 */
export const mount = async (element, ctx) => {
  element.innerHTML = `
    <main style="padding: 2rem;">
      <h2>About Page</h2>
      <p>This is the about page content.</p>
      <p><a href="/">Go to Home</a></p>
    </main>
  `;
};

export const unmount = async (element, ctx) => {
  element.innerHTML = '';
};

export const update = async (prev, next, ctx) => {
  await mount(next, ctx);
};

export const initialize = async (host) => {
  console.log('About MFE initialized');
};
