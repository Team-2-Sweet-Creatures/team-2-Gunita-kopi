/* Gunita Kopi POS — POS screen: menu + cart, Customize Item, Payment, Receipt.
   Exposes window.GKPos. */
(function () {
  'use strict';
  var G = window.GKStore;
  var $ = G.$, $$ = G.$$, peso = G.peso, esc = G.esc, ICONS = G.ICONS;
  var S = function () { return G.state(); };
  var A = function () { return window.GKApp; };

  /* Cart line: {product_id, quantity, customization, special_instructions,
     addons:[{ingredient_id,label,unit_price}]} */
  var cart = [];
  var posCat = 'All', posSearch = '';

  function lineUnit(l) {
    var p = G.prodById(l.product_id);
    return (p ? p.price : 0) + l.addons.reduce(function (s, a) { return s + a.unit_price; }, 0);
  }
  function cartTotal() { return cart.reduce(function (s, l) { return s + lineUnit(l) * l.quantity; }, 0); }
  function isPlain(l) { return !l.addons.length && !l.customization && !l.special_instructions; }

  function screen(el) {
    var cats = ['All'].concat(G.CATS);
    var prods = S().products.filter(function (p) {
      if (posCat !== 'All' && p.category !== posCat) return false;
      if (posSearch && p.product_name.toLowerCase().indexOf(posSearch) < 0) return false;
      return true;
    });
    el.innerHTML =
      '<div class="pos-wrap">' +
      '<div class="pos-menu">' +
      '<div class="pos-tools">' +
      '<div class="cat-tabs">' + cats.map(function (c) {
        return '<button class="opt" data-cat="' + esc(c) + '" aria-pressed="' + (posCat === c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<label class="field pos-search"><input type="text" id="pos-q" placeholder="Search menu…" value="' + esc(posSearch) + '"></label>' +
      '</div>' +
      '<div class="menu-grid" id="pos-grid">' +
      (prods.map(function (p) {
        var ok = G.productOrderable(p);
        var thumb = p.image
          ? '<img class="menu-thumb" src="' + esc(p.image) + '" alt="">'
          : '<span class="menu-thumb">' + (ICONS[G.CAT_ICONS[p.category]] || ICONS.cup) + '</span>';
        return '<button class="menu-item" data-pid="' + p.product_id + '"' + (ok ? '' : ' aria-disabled="true" disabled') + '>' +
          thumb +
          '<span class="menu-body"><span class="menu-name">' + esc(p.product_name) + '</span>' +
          '<span class="menu-tag">' + esc(p.description || '') + '</span>' +
          '<span class="menu-price">' + peso(p.price) + '</span></span>' +
          (ok ? '' : '<span class="sold-out">Sold out</span>') + '</button>';
      }).join('') || '<p class="muted">No products match.</p>') +
      '</div></div>' +
      '<aside class="cart-panel" id="cart-panel" aria-label="Cart">' +
      '<div class="cart-head"><h3>Cart</h3><button class="btn btn-ghost btn-sm" id="cart-clear">Clear</button></div>' +
      '<div class="cart-items" id="cart-items"></div>' +
      '<div class="cart-totals"><div class="row"><span>Subtotal</span><span class="num" id="cart-sub">' + peso(0) + '</span></div>' +
      '<div class="row total"><span>Total</span><span class="num" id="cart-tot">' + peso(0) + '</span></div></div>' +
      '<button class="btn btn-primary btn-block" id="cart-charge">' + ICONS.cash + 'Charge <span class="num" id="charge-amt">' + peso(0) + '</span></button>' +
      '</aside>' +
      '<button class="cart-fab" id="cart-fab">' + ICONS.cart + '<span id="fab-label">Cart</span></button>' +
      '</div>';
    $$('#pos-grid .menu-item').forEach(function (b) {
      b.addEventListener('click', function () { addLine(G.prodById(b.dataset.pid)); });
    });
    $$('.pos-tools .opt').forEach(function (b) {
      b.addEventListener('click', function () { posCat = b.dataset.cat; screen(el); });
    });
    $('#pos-q').addEventListener('input', function () {
      posSearch = this.value.toLowerCase(); screen(el);
      var i = $('#pos-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
    });
    $('#cart-clear').addEventListener('click', function () {
      if (!cart.length) return;
      cart = []; renderCart();
    });
    $('#cart-charge').addEventListener('click', function () {
      if (!cart.length) { G.toast('Cart is empty', true); return; }
      paymentModal(el);
    });
    var fab = $('#cart-fab');
    if (fab) fab.addEventListener('click', function () { $('#cart-panel').classList.toggle('open'); });
    renderCart();
  }

  function addLine(p) {
    if (!p || !G.productOrderable(p)) return;
    var same = cart.filter(function (l) { return l.product_id === p.product_id && isPlain(l); })[0];
    if (same) same.quantity++;
    else cart.push({ product_id: p.product_id, quantity: 1, customization: '', special_instructions: '', addons: [] });
    renderCart();
  }

  function renderCart() {
    var box = $('#cart-items');
    if (!box) return;
    box.innerHTML = cart.length ? cart.map(function (l, i) {
      var p = G.prodById(l.product_id);
      var meta = [];
      l.addons.forEach(function (a) { meta.push('+ ' + a.label); });
      if (l.customization) meta.push(l.customization);
      if (l.special_instructions) meta.push('“' + l.special_instructions + '”');
      return '<div class="cart-line">' +
        '<div class="grow"><div class="name">' + esc(p ? p.product_name : l.product_id) + '</div>' +
        '<div class="meta">' + esc(meta.join(' · ') || 'Standard') + '</div>' +
        '<button class="btn btn-ghost btn-sm cust-btn" data-cust="' + i + '">Customize</button></div>' +
        '<div class="cart-side"><div class="stepper">' +
        '<button data-dec="' + i + '" aria-label="Decrease">−</button><span class="qv">' + l.quantity + '</span><button data-inc="' + i + '" aria-label="Increase">+</button>' +
        '</div><span class="num line-tot">' + peso(lineUnit(l) * l.quantity) + '</span>' +
        '<button class="btn btn-ghost icon-btn btn-sm" data-del="' + i + '" aria-label="Remove">' + ICONS.trash + '</button></div>' +
        '</div>';
    }).join('') : '<div class="cart-empty">Cart is empty — tap a product.</div>';
    var tot = cartTotal();
    $('#cart-sub').textContent = peso(tot);
    $('#cart-tot').textContent = peso(tot);
    $('#charge-amt').textContent = peso(tot);
    var fab = $('#fab-label');
    if (fab) fab.textContent = 'Cart · ' + cart.reduce(function (s, l) { return s + l.quantity; }, 0) + ' · ' + peso(tot);
    $$('[data-inc]').forEach(function (b) { b.addEventListener('click', function () { cart[+b.dataset.inc].quantity++; renderCart(); }); });
    $$('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = cart[+b.dataset.dec];
        l.quantity--;
        if (l.quantity <= 0) cart.splice(+b.dataset.dec, 1);
        renderCart();
      });
    });
    $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { cart.splice(+b.dataset.del, 1); renderCart(); }); });
    $$('[data-cust]').forEach(function (b) { b.addEventListener('click', function () { customizeModal(cart[+b.dataset.cust]); }); });
  }

  /* ---------- Customize Item popup ---------- */
  var QUICK_CHIPS = {
    'Iced Coffee Drinks': ['Sugar 0%', 'Sugar 25%', 'Sugar 50%', 'Sugar 75%', 'Sugar 100%', 'Less ice', 'No ice'],
    'Hot Beverages': ['Sugar 0%', 'Sugar 25%', 'Sugar 50%', 'Sugar 75%', 'Sugar 100%', 'Extra hot'],
    'Rice Meals': ['Sunny side up', 'Scrambled egg', 'Plain rice'],
    'Pastries & Snacks': ['Heated', 'Sliced']
  };
  function quickChipsFor(cat) { return QUICK_CHIPS[cat] || []; }
  function customizeModal(l) {
    var p = G.prodById(l.product_id);
    if (!p) return;
    var picked = {};
    l.addons.forEach(function (a) { picked[a.ingredient_id] = true; });
    var addons = G.addonsFor(p);
    var html = G.modalTitle('Customize — ' + p.product_name) +
      '<p class="muted" style="margin-top:-.4rem">' + esc(p.description || '') + ' — <span class="num">' + peso(p.price) + '</span> base</p>' +
      '<div class="opt-group"><span class="lbl">Add-ons</span><div class="opt-row" data-group="addons">' +
      (addons.length ? addons.map(function (a) {
        return '<button class="opt" data-ing="' + a.ingredient_id + '" data-price="' + a.price + '" data-label="' + esc(a.label) + '" aria-pressed="' + !!picked[a.ingredient_id] + '"' + (a.out ? ' disabled' : '') + '>' +
          esc(a.label) + ' · +' + a.price + (a.out ? ' (out)' : '') + '</button>';
      }).join('') : '<span class="muted" style="font-size:.85rem">No add-ons for this item.</span>') +
      '</div></div>' +
      '<div class="opt-group"><span class="lbl">Customization</span>' +
      '<div class="opt-row" style="margin-bottom:.45rem">' +
      quickChipsFor(p.category).map(function (c) {
        return '<button class="opt qc" data-qc="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<textarea id="cm-cust" rows="2" placeholder="e.g. Sugar 50%, less ice">' + esc(l.customization) + '</textarea></div>' +
      '<label class="field">Special instructions<textarea id="cm-instr" rows="2" placeholder="e.g. no lid, serve last">' + esc(l.special_instructions) + '</textarea></label>' +
      '<div class="field-err" id="cm-err"></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="cm-save">Save</button></div>';
    G.openModal(html, { label: 'Customize ' + p.product_name });
    $$('[data-group="addons"] .opt').forEach(function (b) {
      b.addEventListener('click', function () {
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      });
    });
    $$('.qc').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = $('#cm-cust');
        var v = b.dataset.qc;
        t.value = t.value ? (t.value.replace(/[,\s]*$/, '') + ', ' + v) : v;
      });
    });
    $('#cm-save').addEventListener('click', function () {
      l.addons = $$('[data-group="addons"] .opt[aria-pressed="true"]').map(function (b) {
        return { ingredient_id: b.dataset.ing, label: b.dataset.label, unit_price: +b.dataset.price };
      });
      l.customization = $('#cm-cust').value.trim();
      l.special_instructions = $('#cm-instr').value.trim();
      G.closeModal();
      renderCart();
      G.toast(p.product_name + ' updated');
    });
  }

  /* ---------- Payment popup ---------- */
  function paymentModal(el) {
    var total = cartTotal();
    var orderType = 'Dine-in', method = 'Cash';
    var html = G.modalTitle('Payment') +
      '<div class="opt-group"><span class="lbl">Order type</span><div class="seg" id="pay-type">' +
      ['Dine-in', 'Take-out', 'Pre-order'].map(function (t, i) {
        return '<button data-v="' + t + '" aria-pressed="' + (i === 0) + '">' + t + '</button>';
      }).join('') + '</div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">Total due</span><span class="due num" style="font-size:1.5rem;color:var(--coffee)">' + peso(total) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between"><span class="muted">Payment method</span><span>' + ICONS.cash + ' Cash</span></div>' +
      '<label class="field">Amount paid<input type="number" id="pay-amt" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></label>' +
      '<div class="field-err" id="pay-err"></div>' +
      '<div style="display:flex;justify-content:space-between"><span>Change</span><span class="change-out num" id="pay-change">—</span></div>' +
      '<div class="modal-actions"><button class="btn" data-close>Back</button>' +
      '<button class="btn btn-primary" id="pay-ok">' + ICONS.cash + 'Confirm payment</button></div>';
    G.openModal(html, { label: 'Payment' });
    var amt = $('#pay-amt');
    function upd() {
      var t = parseFloat(amt.value);
      if (isNaN(t)) { $('#pay-change').textContent = '—'; $('#pay-err').textContent = ''; return; }
      if (t < total) { $('#pay-err').textContent = 'Amount is less than the total (' + peso(total) + ').'; $('#pay-change').textContent = '—'; }
      else { $('#pay-err').textContent = ''; $('#pay-change').textContent = peso(t - total); }
    }
    $$('#pay-type button').forEach(function (b) {
      b.addEventListener('click', function () {
        orderType = b.dataset.v;
        $$('#pay-type button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
    amt.addEventListener('input', upd);
    $('#pay-ok').addEventListener('click', function () {
      var t = parseFloat(amt.value);
      if (isNaN(t) || t < total) { $('#pay-err').textContent = 'Enter an amount ≥ ' + peso(total) + '.'; amt.focus(); return; }
      var u = A().currentUser();
      var res = G.placeOrder({
        user_id: u.user_id, order_type: orderType,
        lines: cart.map(function (l) {
          var p = G.prodById(l.product_id);
          return { product_id: l.product_id, quantity: l.quantity, unit_price: p ? p.price : 0,
            customization: l.customization, special_instructions: l.special_instructions,
            addons: l.addons.map(function (a) { return { ingredient_id: a.ingredient_id, unit_price: a.unit_price }; }) };
        }),
        payment_method: method, amount_paid: t
      });
      cart = [];
      G.closeModal();
      A().receiptModal(res.order_id, { newOrder: function () { screen(el); } });
      screen(el);
    });
  }

  window.GKPos = { screen: screen };
})();
