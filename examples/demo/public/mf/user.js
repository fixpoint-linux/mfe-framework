/**
 * User MFE - vanilla JS implementation
 * Exports the @mfe/core lifecycle: { mount, unmount, update, initialize }
 */
export const mount = async (element, ctx) => {
  const props = ctx.props || {};
  const userId = props.id || 'unknown';
  element.innerHTML = `
    <main style="padding: 2rem;">
      <h2>User Profile</h2>
      <p>User ID: ${userId}</p>
      <p>This is the user page content.</p>
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
  console.log('User MFE initialized');
};
