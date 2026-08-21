/**
 * PLP (Product Listing Page) MFE - vanilla JS implementation
 * Subscribes to 'basket:updated' events and displays basket count.
 * Exports the @mfe/core lifecycle: { mount, unmount, update, initialize }
 */

let bus = null;
let store = null;
let unsubscribeBus = null;
let unsubscribeStore = null;
let basketCount = 0;

/** @type {import('@mfe/core').MFE} */
export const mfe = {
  async mount(element, ctx) {
    bus = ctx.host.bus;
    store = ctx.host.store;

    // Get current basket from store
    const state = store?.getState() || {};
    const basket = state.basket || [];
    basketCount = basket.reduce((sum, item) => sum + item.quantity, 0);

    element.innerHTML = `
      <main style="padding: 2rem;">
        <h2>Product Listing Page</h2>
        <p>Browse our amazing products!</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0;">
          <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
            <h4>Product 1</h4>
            <p>$19.99</p>
            <button class="add-to-basket" data-id="1" style="background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
              Add to Basket
            </button>
          </div>
          <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
            <h4>Product 2</h4>
            <p>$29.99</p>
            <button class="add-to-basket" data-id="2" style="background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
              Add to Basket
            </button>
          </div>
          <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
            <h4>Product 3</h4>
            <p>$39.99</p>
            <button class="add-to-basket" data-id="3" style="background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
              Add to Basket
            </button>
          </div>
        </div>

        <div id="basket-status" style="position: fixed; bottom: 20px; left: 20px; background: #28a745; color: white; padding: 0.75rem 1.5rem; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
          Basket: <span id="basket-count">${basketCount}</span> items
        </div>
      </main>
    `;

    // Wire up add-to-basket buttons
    const buttons = element.querySelectorAll('.add-to-basket');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const productId = parseInt(button.getAttribute('data-id'));
        const newItem = { id: productId, quantity: 1 };
        
        // Emit event
        bus?.emit('basket:updated', newItem);
        
        // Update store
        const currentState = store?.getState() || {};
        const currentBasket = currentState.basket || [];
        store?.setState({
          ...currentState,
          basket: [...currentBasket, newItem]
        });
      });
    });

    // Subscribe to bus events
    if (bus) {
      unsubscribeBus = bus.on('basket:updated', (payload) => {
        console.log('PLP received basket:updated:', payload);
        // Update local count
        basketCount++;
        const countEl = element.querySelector('#basket-count');
        if (countEl) {
          countEl.textContent = basketCount;
        }
      });

      unsubscribeBus = bus.on('basket:cleared', () => {
        console.log('PLP received basket:cleared');
        basketCount = 0;
        const countEl = element.querySelector('#basket-count');
        if (countEl) {
          countEl.textContent = basketCount;
        }
      });
    }

    // Subscribe to store changes
    if (store) {
      unsubscribeStore = store.subscribe((state) => {
        const basket = state.basket || [];
        const newCount = basket.reduce((sum, item) => sum + item.quantity, 0);
        if (newCount !== basketCount) {
          basketCount = newCount;
          const countEl = element.querySelector('#basket-count');
          if (countEl) {
            countEl.textContent = basketCount;
          }
        }
      });
    }
  },

  async unmount(element, ctx) {
    // Clean up subscriptions
    if (unsubscribeBus) {
      unsubscribeBus();
      unsubscribeBus = null;
    }
    if (unsubscribeStore) {
      unsubscribeStore();
      unsubscribeStore = null;
    }
    element.innerHTML = '';
  },

  async update(prev, next, ctx) {
    // For PLP, we just re-render
    await this.mount(next, ctx);
  },

  async initialize(host) {
    console.log('PLP MFE initialized');
    bus = host.bus;
    store = host.store;
  }
};

export default mfe;
