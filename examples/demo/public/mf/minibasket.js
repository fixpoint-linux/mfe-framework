/**
 * Minibasket MFE - vanilla JS implementation
 * Emits 'basket:updated' events when items are added.
 * Exports the @mfe/core lifecycle: { mount, unmount, update, initialize }
 */

let bus = null;
let store = null;
let unsubscribe = null;

/** @type {import('@mfe/core').MFE} */
export const mfe = {
  async mount(element, ctx) {
    // Get bus and store from host context
    bus = ctx.host.bus;
    store = ctx.host.store;

    // Get current basket from store
    const state = store?.getState() || {};
    const basket = state.basket || [];

    element.innerHTML = `
      <aside style="position: fixed; top: 60px; right: 20px; background: #f0f0f0; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 1rem 0;">Mini Basket</h3>
        <div id="basket-items" style="margin-bottom: 1rem;">
          ${basket.length === 0 ? '<p style="margin: 0; color: #666;">Empty</p>' : ''}
          ${basket.map(item => `
            <div style="display: flex; justify-content: space-between; margin: 0.25rem 0;">
              <span>Product ${item.id}</span>
              <span>Qty: ${item.quantity}</span>
            </div>
          `).join('')}
        </div>
        <button id="add-item" style="background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
          Add Item
        </button>
        <button id="clear-basket" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;">
          Clear
        </button>
        <div id="basket-count" style="margin-top: 0.5rem; font-size: 0.875rem; color: #666;">
          Total items: ${basket.reduce((sum, item) => sum + item.quantity, 0)}
        </div>
      </aside>
    `;

    // Wire up button handlers
    const addButton = element.querySelector('#add-item');
    const clearButton = element.querySelector('#clear-basket');

    addButton?.addEventListener('click', () => {
      const newItem = { id: Date.now(), quantity: 1 };
      // Emit event
      bus?.emit('basket:updated', newItem);
      
      // Also update store directly for immediate UI feedback
      const currentState = store?.getState() || {};
      const currentBasket = currentState.basket || [];
      store?.setState({
        ...currentState,
        basket: [...currentBasket, newItem]
      });
    });

    clearButton?.addEventListener('click', () => {
      // Emit clear event
      bus?.emit('basket:cleared', {});
      
      // Update store
      const currentState = store?.getState() || {};
      store?.setState({
        ...currentState,
        basket: []
      });
    });
  },

  async unmount(element, ctx) {
    // Clean up subscriptions
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    element.innerHTML = '';
  },

  async update(prev, next, ctx) {
    // For minibasket, we just re-render
    await this.mount(next, ctx);
  },

  async initialize(host) {
    console.log('Minibasket MFE initialized');
    bus = host.bus;
    store = host.store;

    // Subscribe to store changes to re-render when basket changes
    if (store) {
      unsubscribe = store.subscribe((state) => {
        // When store changes, we need to trigger a re-render
        // This is handled by the framework's reconcile loop
      });
    }
  }
};

export default mfe;
