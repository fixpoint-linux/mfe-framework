/**
 * Homepage MFE - vanilla JS implementation
 * Exports the @mfe/core lifecycle: { mount, unmount, update, initialize }
 */
export const mount = async (element, ctx) => {
  const props = ctx.props || {};
  element.innerHTML = `
    <main style="padding: 2rem;">
      <h2>Welcome to the Homepage</h2>
      <p>This is the homepage content.</p>
      ${props.title ? `<p>Title: ${props.title}</p>` : ''}
      <p><a href="/about">Go to About</a></p>
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
  console.log('Homepage MFE initialized');
};
