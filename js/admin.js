/* Gunita Kopi POS — Admin modules: Products, Recipe & Costing, Inventory,
   Suppliers, Reports, Users. Exposes window.GKAdmin. */
(function () {
  'use strict';
  var G = window.GKStore;
  var $ = G.$, $$ = G.$$, peso = G.peso, esc = G.esc, ICONS = G.ICONS;
  var S = function () { return G.state(); };
  var A = function () { return window.GKApp; };

  function head(t, actions) { return A().head('ᜄᜓᜈᜒᜆ', 'gunita · admin', t, actions); }
  function invHead(t, actions) { return A().head('ᜄᜓᜈᜒᜆ', 'gunita · inventory board', t, actions); }
  function chip(k, label) { return A().chipStatus(k, label); }
  function parseSub(sub) {
    var q = (sub || '').split('?');
    var args = {};
    if (q[1]) q[1].split('&').forEach(function (kv) {
      var p = kv.split('=');
      args[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { path: q[0] || '', args: args };
  }

  /* ================= PRODUCTS ================= */
  var prodQ = '', prodCat = 'All';
  function scrProducts(el, sub) {
    var parts = sub.split('/');
    if (parts[0] === 'new') return productForm(el, null);
    if (parts[0] === 'recipe') return scrRecipe(el, null);
    if (parts[1] === 'edit') return productForm(el, G.prodById(parts[0]));
    if (parts[1] === 'recipe') return scrRecipe(el, parts[0]);
    if (parts[0]) return scrRecipe(el, parts[0]);
    // list
    var cats = ['All'].concat(G.CATS);
    var rows = S().products.filter(function (p) {
      if (prodCat !== 'All' && p.category !== prodCat) return false;
      if (prodQ && p.product_name.toLowerCase().indexOf(prodQ) < 0) return false;
      return true;
    });
    el.innerHTML = head('Products',
      '<a class="btn btn-primary" href="#products/new">' + ICONS.plus + 'Add product</a>') +
      A().subtabs([['Product List', 'products'], ['Recipe & Costing', 'products/recipe']], 'Product List') +
      '<div class="report-controls">' +
      '<label class="field">Search<input type="text" id="p-q" value="' + esc(prodQ) + '" placeholder="Product name"></label>' +
      '<label class="field">Category<select id="p-cat">' + cats.map(function (c) {
        return '<option' + (prodCat === c ? ' selected' : '') + '>' + c + '</option>';
      }).join('') + '</select></label></div>' +
      '<div class="tbl-wrap"><table class="tbl tbl-products"><thead><tr><th>ID</th><th></th><th>Name</th><th>Category</th><th class="num">Price</th><th class="num">Cost</th><th class="num">Margin</th><th>Available</th><th>Date created</th><th>Created by</th><th>Actions</th></tr></thead><tbody>' +
      (rows.map(function (p) {
        var m = G.margin(p);
        var thumb = p.image ? '<img class="thumb" src="' + esc(p.image) + '" alt="">'
          : '<span class="thumb thumb-ic">' + (ICONS[G.CAT_ICONS[p.category]] || ICONS.cup) + '</span>';
        var creator = G.userById(p.created_by);
        var creatorName = creator ? creator.full_name : (p.created_by || '—');
        var createdDate = p.date_created ? G.fmtDate(p.date_created) : '—';
        var idDisplay = p.id_num != null ? p.id_num : p.product_id;
        return '<tr>' +
          '<td class="mono">' + esc(idDisplay) + '</td>' +
          '<td>' + thumb + '</td>' +
          '<td><strong>' + esc(p.product_name) + '</strong><br><span class="muted" style="font-size:.78rem">' + esc(p.description || '') + '</span></td>' +
          '<td>' + esc(p.category) + '</td><td class="num">' + peso(p.price) + '</td>' +
          '<td class="num">' + peso(m.total_cost) + '</td>' +
          '<td class="num">' + (m.pct < 40 ? '<span class="chip chip-low">' + m.pct.toFixed(0) + '%</span>' : m.pct.toFixed(0) + '%') + '</td>' +
          '<td><label class="avail-toggle"><span class="switch"><input type="checkbox" data-avail="' + p.product_id + '"' + (p.is_available ? ' checked' : '') + '><span class="tr"></span></span></label></td>' +
          '<td class="mono">' + esc(createdDate) + '</td>' +
          '<td>' + esc(creatorName) + '</td>' +
          '<td class="act-cell"><a class="btn btn-sm" href="#products/' + p.product_id + '/edit">' + ICONS.pencil + 'Edit</a> ' +
          '<a class="btn btn-sm" href="#products/' + p.product_id + '/recipe">Recipe & Costing</a></td></tr>';
      }).join('') || '<tr><td colspan="11" class="muted">No products match.</td></tr>') + '</tbody></table></div>';
    $('#p-q').addEventListener('input', function () { prodQ = this.value.toLowerCase(); A().render(); var i = $('#p-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    $('#p-cat').addEventListener('change', function () { prodCat = this.value; A().render(); });
    $$('[data-avail]').forEach(function (c) {
      c.addEventListener('change', function () {
        var p = G.prodById(c.dataset.avail);
        p.is_available = c.checked; G.save();
        G.toast(p.product_name + (p.is_available ? ' available' : ' hidden from POS'));
      });
    });
  }

  function productForm(el, p) {
    var isNew = !p;
    p = p || { product_id: null, product_name: '', description: '', category: G.CATS[0], price: 100, is_available: true, image: null };
    var img = p.image;
    el.innerHTML = head(isNew ? 'Add Product' : 'Edit — ' + p.product_name) +
      A().subtabs([['Product List', 'products'], ['Recipe & Costing', 'products/recipe']], 'Product List') +
      '<div class="card" style="max-width:760px">' +
      '<div class="form-row"><label class="field">Name<input type="text" id="pf-name" value="' + esc(p.product_name) + '"></label>' +
      '<label class="field">Category<select id="pf-cat">' + G.CATS.map(function (c) {
        return '<option' + (p.category === c ? ' selected' : '') + '>' + c + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field" style="max-width:130px">Price (₱)<input type="number" id="pf-price" min="0" step="1" value="' + p.price + '"></label></div>' +
      '<label class="field">Description<textarea id="pf-desc" rows="2">' + esc(p.description || '') + '</textarea></label>' +
      '<div class="product-image-section"><div class="product-image-controls"><label class="field">Image<input type="file" id="pf-img" accept="image/*"></label>' +
      '<button class="btn btn-sm" id="pf-rmimg"' + (img ? '' : ' style="display:none"') + '>Remove</button></div>' +
      '<div class="img-preview" id="pf-prev">' + (img ? '<img src="' + esc(img) + '" alt="Product image preview">' : '<span class="muted">No image</span>') + '</div></div>' +
      '<label class="field" style="flex-direction:row;align-items:center;gap:.6rem;margin-top:.6rem"><span class="switch"><input type="checkbox" id="pf-avail"' + (p.is_available ? ' checked' : '') + '><span class="tr"></span></span>Available on POS</label>' +
      '<div class="field-err" id="pf-err"></div>' +
      '<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" id="pf-save">Save</button>' +
      '<a class="btn" href="#products">Cancel</a></div></div>';
    $('#pf-img').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var max = 240, sc = Math.min(1, max / Math.max(im.width, im.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          img = cv.toDataURL('image/jpeg', 0.8);
          $('#pf-prev').innerHTML = '<img src="' + img + '" alt="Product image preview">';
          $('#pf-rmimg').style.display = '';
        };
        im.src = r.result;
      };
      r.readAsDataURL(f);
    });
    $('#pf-rmimg').addEventListener('click', function () {
      img = null;
      $('#pf-prev').innerHTML = '<span class="muted">No image</span>';
      this.style.display = 'none';
    });
    $('#pf-save').addEventListener('click', function () {
      var name = $('#pf-name').value.trim(), price = parseFloat($('#pf-price').value);
      if (!name) { $('#pf-err').textContent = 'Name is required.'; return; }
      if (isNaN(price) || price <= 0) { $('#pf-err').textContent = 'Enter a valid price.'; return; }
      p.product_name = name;
      p.description = $('#pf-desc').value.trim();
      p.category = $('#pf-cat').value;
      p.price = price;
      p.is_available = $('#pf-avail').checked;
      p.image = img;
      if (isNew) {
        S().last_prod_id = (S().last_prod_id || 16) + 1;
        p.id_num = S().last_prod_id;
        p.product_id = G.uid('p');
        p.date_created = Date.now();
        p.created_by = A().currentUser().user_id;
        S().products.push(p);
        G.recomputeCosting(p.product_id);
        G.save();
        G.toast(name + ' added — set up its recipe');
        location.hash = '#products/' + p.product_id + '/recipe';
      } else {
        G.recomputeCosting(p.product_id);
        G.save();
        G.toast(name + ' saved');
        location.hash = '#products';
      }
    });
  }

  /* ---------- Recipe & Costing ---------- */
  function scrRecipe(el, pid) {
    var prods = S().products;
    var p = G.prodById(pid) || prods[0];
    if (!p) { el.innerHTML = head('Recipe & Costing') + '<p class="muted">Add a product first.</p>'; return; }
    var recipe = G.recipeOf(p.product_id).map(function (r) {
      return { product_ingredient_id: r.product_ingredient_id, ingredient_id: r.ingredient_id, quantity_needed: r.quantity_needed };
    });
    var costing = G.costingOf(p.product_id) || { packaging_cost: 0 };

    function rowsHtml() {
      return recipe.map(function (r, i) {
        var ing = G.ingById(r.ingredient_id);
        var cost = ing ? ing.unit_cost : 0;
        var hasIngredient = S().ingredients.some(function (iv) { return iv.ingredient_id === r.ingredient_id; });
        return '<tr><td><select data-ri="' + i + '">' +
          (!hasIngredient ? '<option value="' + esc(r.ingredient_id) + '" selected>Unavailable ingredient (' + esc(r.ingredient_id) + ')</option>' : '') +
          S().ingredients.map(function (iv) {
            return '<option value="' + iv.ingredient_id + '"' + (r.ingredient_id === iv.ingredient_id ? ' selected' : '') + '>' + esc(iv.ingredient_name) + ' (' + iv.unit + ')</option>';
          }).join('') + '</select></td>' +
          '<td class="recipe-qty-cell"><div class="recipe-qty-control">' +
          '<button type="button" class="btn btn-sm recipe-qty-step" data-rminus="' + i + '" aria-label="Decrease ' + esc(ing ? ing.ingredient_name : 'ingredient') + ' quantity">-</button>' +
          '<button type="button" class="btn btn-sm recipe-qty-step" data-rplus="' + i + '" aria-label="Increase ' + esc(ing ? ing.ingredient_name : 'ingredient') + ' quantity">+</button>' +
          '<input type="number" data-rq="' + i + '" min="0" step="0.5" value="' + r.quantity_needed + '" aria-label="' + esc(ing ? ing.ingredient_name : 'Ingredient') + ' quantity">' +
          '<span class="recipe-qty-unit">' + (ing ? esc(ing.unit) : '') + '</span></div></td>' +
          '<td class="num">' + peso(cost) + '</td>' +
          '<td class="num">' + peso(cost * r.quantity_needed) + '</td>' +
          '<td><button class="btn btn-sm btn-danger" data-rr="' + i + '" aria-label="Remove">' + ICONS.trash + '</button></td></tr>';
      }).join('');
    }
    function totalsHtml() {
      var ic = recipe.reduce(function (s, r) {
        var ing = G.ingById(r.ingredient_id);
        return s + (ing ? ing.unit_cost : 0) * r.quantity_needed;
      }, 0);
      var pk = parseFloat($('#rc-pack') ? $('#rc-pack').value : costing.packaging_cost) || 0;
      var tc = ic + pk;
      var mg = p.price - tc, pct = p.price ? mg / p.price * 100 : 0;
      return '<div class="row"><span>Ingredient cost</span><span class="num">' + peso(ic) + '</span></div>' +
        '<div class="row"><span>Packaging</span><span class="num">' + peso(pk) + '</span></div>' +
        '<div class="row"><span>Total cost</span><span class="num">' + peso(tc) + '</span></div>' +
        '<div class="row"><span>Price</span><span class="num">' + peso(p.price) + '</span></div>' +
        '<div class="row strong"><span>Margin</span><span class="num">' + peso(mg) + ' · ' +
        (pct < 40 ? '<span class="chip chip-low">' + pct.toFixed(0) + '%</span>' : pct.toFixed(0) + '%') + '</span></div>';
    }
    el.innerHTML = head('Recipe & Costing') +
      A().subtabs([['Product List', 'products'], ['Recipe & Costing', 'products/recipe']], 'Recipe & Costing') +
      '<div class="report-controls"><label class="field">Product<select id="rc-prod">' +
      prods.map(function (x) {
        return '<option value="' + x.product_id + '"' + (x.product_id === p.product_id ? ' selected' : '') + '>' + esc(x.product_name) + '</option>';
      }).join('') + '</select></label></div>' +
      '<div class="card"><div class="tbl-wrap" style="border:0;background:transparent"><table class="tbl"><thead><tr><th>Ingredient</th><th class="recipe-qty-heading">Qty needed</th><th class="num">Unit cost</th><th class="num">Line cost</th><th></th></tr></thead>' +
      '<tbody id="rc-rows">' + rowsHtml() + '</tbody></table></div>' +
      '<button type="button" class="btn btn-sm" id="rc-add" style="margin-top:.6rem"' + (S().ingredients.length ? '' : ' disabled') + '>' + ICONS.plus + 'Add ingredient</button>' +
      (S().ingredients.length ? '' : '<p class="muted">Add an ingredient in Inventory before setting up this recipe.</p>') +
      '<div class="form-row" style="margin-top:.9rem"><div class="packaging-cost-field"><label class="field" for="rc-pack">Packaging cost (₱)</label><div class="recipe-qty-control packaging-cost-control">' +
      '<button type="button" class="btn btn-sm recipe-qty-step" id="rc-pack-minus" aria-label="Decrease packaging cost">-</button>' +
      '<button type="button" class="btn btn-sm recipe-qty-step" id="rc-pack-plus" aria-label="Increase packaging cost">+</button>' +
      '<input type="number" id="rc-pack" min="0" step="0.5" value="' + costing.packaging_cost + '"></div></div></div>' +
      '<div class="cost-summary" id="rc-totals">' + totalsHtml() + '</div>' +
      '<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" id="rc-save">Save recipe</button>' +
      '<a class="btn" href="#products">Back to list</a></div></div>';
    function sync() {
      $$('#rc-rows [data-ri]').forEach(function (s2) { recipe[+s2.dataset.ri].ingredient_id = s2.value; });
      $$('#rc-rows [data-rq]').forEach(function (n) { recipe[+n.dataset.rq].quantity_needed = parseFloat(n.value) || 0; });
    }
    function refresh(skipSync) {
      if (!skipSync) sync();
      $('#rc-rows').innerHTML = rowsHtml();
      bindRows();
      refreshTotals();
    }
    function refreshTotals() { sync(); $('#rc-totals').innerHTML = totalsHtml(); }
    function bindRows() {
      $$('#rc-rows [data-rr]').forEach(function (b) {
        b.addEventListener('click', function () { sync(); recipe.splice(+b.dataset.rr, 1); refresh(true); });
      });
      $$('#rc-rows [data-rminus], #rc-rows [data-rplus]').forEach(function (b) {
        b.addEventListener('click', function () {
          var i = +(b.dataset.rminus != null ? b.dataset.rminus : b.dataset.rplus);
          var change = b.dataset.rminus != null ? -0.5 : 0.5;
          var input = $('#rc-rows [data-rq="' + i + '"]');
          var quantity = parseFloat(input.value) || 0;
          input.value = Math.max(0, Math.round((quantity + change) * 10) / 10);
          refresh();
        });
      });
      $$('#rc-rows select, #rc-rows input').forEach(function (n) {
        n.addEventListener('change', function () { refresh(); });
        n.addEventListener('input', function () { refreshTotals(); });
      });
    }
    bindRows();
    $('#rc-pack').addEventListener('input', refreshTotals);
    $('#rc-pack-minus').addEventListener('click', function () { adjustPackagingCost(-0.5); });
    $('#rc-pack-plus').addEventListener('click', function () { adjustPackagingCost(0.5); });
    $('#rc-prod').addEventListener('change', function () { location.hash = '#products/' + this.value + '/recipe'; });
    $('#rc-add').addEventListener('click', function () {
      sync();
      if (!S().ingredients.length) {
        G.toast('Add an ingredient in Inventory before setting up this recipe.', true);
        return;
      }
      recipe.push({ product_ingredient_id: null, ingredient_id: S().ingredients[0].ingredient_id, quantity_needed: 1 });
      refresh(true);
    });
    $('#rc-save').addEventListener('click', function () {
      sync();
      S().product_ingredients = S().product_ingredients.filter(function (r) { return r.product_id !== p.product_id; });
      recipe.forEach(function (r) {
        S().product_ingredients.push({ product_ingredient_id: r.product_ingredient_id || G.uid('pi'),
          product_id: p.product_id, ingredient_id: r.ingredient_id, quantity_needed: r.quantity_needed });
      });
      var c = G.costingOf(p.product_id) || G.recomputeCosting(p.product_id);
      c.packaging_cost = parseFloat($('#rc-pack').value) || 0;
      G.recomputeCosting(p.product_id);
      G.save();
      G.toast(p.product_name + ' recipe saved');
      A().render();
    });
    function adjustPackagingCost(change) {
      var input = $('#rc-pack');
      var amount = parseFloat(input.value) || 0;
      input.value = Math.max(0, Math.round((amount + change) * 10) / 10);
      refreshTotals();
    }
  }

  /* ================= INVENTORY ================= */
  var invQ = '', invF = 'all', histIng = 'all';
  function scrInventory(el, sub) {
    var s = parseSub(sub);
    if (s.path === 'stock') return scrStockForm(el, s.args.ing || '');
    if (s.path === 'history') { if (s.args.ing) histIng = s.args.ing; return scrHistory(el); }
    // Ingredient list
    var canDelete = window.GK_ROLE !== 'Barista';
    var rows = S().ingredients.slice().sort(function (a, b) {
      return (b.id_num || 0) - (a.id_num || 0);
    });
    el.innerHTML = invHead('Inventory',
      '<button class="btn btn-primary" id="inv-add">' + ICONS.plus + 'Add ingredient</button>') +
      A().subtabs([['Ingredient List', 'inventory'], ['Stock In / Out', 'inventory/stock'], ['Stock History', 'inventory/history']], 'Ingredient List') +
      '<div class="tbl-wrap"><table class="tbl tbl-inventory"><thead><tr>' +
      '<th>ID</th><th>INGREDIENT</th><th>UNIT</th><th>STOCK</th><th>REORDER AT</th><th>UNIT COST</th><th>SUPPLIER</th><th class="status-cell">STATUS</th><th>ACTIONS</th>' +
      '</tr></thead><tbody>' +
      (rows.map(function (i) {
        var st = G.ingredientStatus(i);
        var sup = G.supplierById(i.supplier_id);
        var supName = sup ? sup.supplier_name : (i.supplier_name || '—');
        return '<tr>' +
          '<td class="mono">' + (i.id_num != null ? i.id_num : i.ingredient_id) + '</td>' +
          '<td><strong>' + esc(i.ingredient_name) + '</strong></td>' +
          '<td>' + esc(i.unit) + '</td>' +
          '<td class="mono">' + i.current_stock + '</td>' +
          '<td class="mono">' + i.reorder_level + '</td>' +
          '<td class="mono">' + peso(i.unit_cost) + '</td>' +
          '<td>' + esc(supName) + '</td>' +
          '<td class="status-cell">' + chip(st.k, st.label) + '</td>' +
          '<td class="act-cell"><a class="btn btn-sm" href="#inventory/stock?ing=' + encodeURIComponent(i.ingredient_id) + '">Stock In/Out</a> ' +
          '<a class="btn btn-sm" href="#inventory/history?ing=' + encodeURIComponent(i.ingredient_id) + '">History</a> ' +
          '<button class="btn btn-sm icon-btn" data-einv="' + esc(i.ingredient_id) + '" aria-label="Edit">' + ICONS.pencil + '</button> ' +
          (canDelete ? '<button class="btn btn-sm btn-danger icon-btn" data-dinv="' + esc(i.ingredient_id) + '" aria-label="Delete">' + ICONS.trash + '</button>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="9" class="muted">No ingredients match.</td></tr>') + '</tbody></table></div>';
    $('#inv-add').addEventListener('click', function () { ingredientModal(null); });
    $$('[data-einv]').forEach(function (b) { b.addEventListener('click', function () { ingredientModal(G.ingById(b.dataset.einv)); }); });
    $$('[data-dinv]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ing = G.ingById(b.dataset.dinv);
        if (!ing) return;
        var usedBy = S().product_ingredients.filter(function (r) { return r.ingredient_id === ing.ingredient_id; })
          .map(function (r) { var p = G.prodById(r.product_id); return p ? p.product_name : null; })
          .filter(function (n, idx, arr) { return n && arr.indexOf(n) === idx; });
        if (usedBy.length) {
          G.toast(ing.ingredient_name + ' is used in ' + usedBy.length + ' recipe(s), remove it there first.', true);
          return;
        }
        G.confirmDialog({
          title: 'Delete ingredient',
          body: 'Delete <strong>' + esc(ing.ingredient_name) + '</strong>? This cannot be undone.',
          okLabel: 'Delete', danger: true
        }).then(function (yes) {
          if (!yes) return;
          S().ingredients = S().ingredients.filter(function (x) { return x.ingredient_id !== ing.ingredient_id; });
          G.save(); A().render(); G.toast(ing.ingredient_name + ' deleted');
        });
      });
    });
  }

  function ingredientModal(it) {
    var isNew = !it;
    it = it || { ingredient_id: null, ingredient_name: '', unit: 'g', current_stock: 0, reorder_level: 100, unit_cost: 0, supplier_id: '' };
    var activeSups = S().suppliers.filter(function (x) { return x.status === 'Active'; });
    G.openModal(G.modalTitle(isNew ? 'Add ingredient' : 'Edit — ' + it.ingredient_name) +
      '<div class="form-row"><label class="field">Name<input type="text" id="iv-name" value="' + esc(it.ingredient_name) + '"></label>' +
      '<label class="field">Unit<select id="iv-unit">' + ['g', 'mL', 'pcs'].map(function (u) {
        return '<option' + (it.unit === u ? ' selected' : '') + '>' + u + '</option>';
      }).join('') + '</select></label></div>' +
      '<div class="form-row"><label class="field">Supplier<select id="iv-sup">' +
      activeSups.map(function (s2) { return '<option value="' + s2.supplier_id + '"' + (it.supplier_id === s2.supplier_id ? ' selected' : '') + '>' + esc(s2.supplier_name) + '</option>'; }).join('') +
      '</select></label></div>' +
      '<div class="form-row"><label class="field">Reorder level<input type="number" id="iv-rl" min="0" value="' + it.reorder_level + '"></label>' +
      '<label class="field">Unit cost (₱)<input type="number" id="iv-cost" min="0" step="0.01" value="' + it.unit_cost + '"></label>' +
      (isNew ? '<label class="field">Opening stock<input type="number" id="iv-open" min="0" value="0"></label>' : '') + '</div>' +
      '<div class="field-err" id="iv-err"></div>' +
      '<div class="modal-actions"><button class="btn" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="iv-save">Save</button></div>', { label: (isNew ? 'Add' : 'Edit') + ' ingredient' });
    $('#iv-save').addEventListener('click', function () {
      var name = $('#iv-name').value.trim();
      if (!name) { $('#iv-err').textContent = 'Name is required.'; return; }
      it.ingredient_name = name;
      it.unit = $('#iv-unit').value;
      it.supplier_id = $('#iv-sup').value;
      it.reorder_level = Math.max(0, parseFloat($('#iv-rl').value) || 0);
      it.unit_cost = Math.max(0, parseFloat($('#iv-cost').value) || 0);
      it.date_updated = Date.now();
      var u = A().currentUser();
      if (isNew) {
        S().last_ing_id = (S().last_ing_id || 7) + 1;
        it.id_num = S().last_ing_id;
        it.ingredient_id = G.uid('i');
        it.status = 'Active';
        it.current_stock = 0;
        S().ingredients.push(it);
        var open = Math.max(0, parseFloat($('#iv-open').value) || 0);
        if (open > 0) G.stockTx(it.ingredient_id, u.user_id, 'IN', open, 'Opening stock');
        G.toast(name + ' added');
      } else {
        G.toast(name + ' saved');
      }
      G.recomputeAllCosting(); // unit_cost may have changed
      G.save(); G.closeModal(); A().render();
    });
  }

  /* ---------- Stock In / Out form ---------- */
  function scrStockForm(el, preIng) {
    var ings = S().ingredients;
    var sel = preIng && G.ingById(preIng) ? preIng : (ings[0] ? ings[0].ingredient_id : '');
    function cur() { return G.ingById($('#st-ing').value); }
    el.innerHTML = invHead('Stock In / Out') +
      A().subtabs([['Ingredient List', 'inventory'], ['Stock In / Out', 'inventory/stock'], ['Stock History', 'inventory/history']], 'Stock In / Out') +
      '<div class="card" style="max-width:560px">' +
      '<label class="field">Ingredient<select id="st-ing">' +
      ings.map(function (i) { return '<option value="' + i.ingredient_id + '"' + (i.ingredient_id === sel ? ' selected' : '') + '>' + esc(i.ingredient_name) + '</option>'; }).join('') +
      '</select></label>' +
      '<p class="muted" style="margin:.5rem 0">Current stock: <strong class="num" id="st-cur">' + (G.ingById(sel) ? G.ingById(sel).current_stock : 0) + '</strong></p>' +
      '<div class="form-row"><label class="field">Type<select id="st-type"><option value="IN">Stock In</option><option value="OUT">Stock Out</option></select></label>' +
      '<label class="field">Quantity<input type="number" id="st-qty" min="1" step="1"></label></div>' +
      '<label class="field">Remarks<input type="text" id="st-rem" placeholder="e.g. Delivery, spoilage, usage"></label>' +
      '<div class="field-err" id="st-err"></div>' +
      '<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" id="st-save">Save transaction</button>' +
      '<a class="btn" href="#inventory">Back</a></div></div>';
    $('#st-ing').addEventListener('change', function () { var c = cur(); $('#st-cur').textContent = c ? c.current_stock : 0; });
    $('#st-save').addEventListener('click', function () {
      var ing = cur();
      if (!ing) return;
      var type = $('#st-type').value;
      var q = parseFloat($('#st-qty').value);
      if (isNaN(q) || q <= 0) { $('#st-err').textContent = 'Enter a quantity > 0.'; return; }
      if (type === 'OUT' && q > ing.current_stock) { $('#st-err').textContent = 'Cannot stock out more than ' + ing.current_stock + ' ' + ing.unit + '.'; return; }
      G.stockTx(ing.ingredient_id, A().currentUser().user_id, type, q, $('#st-rem').value.trim());
      G.save();
      G.toast(ing.ingredient_name + ' ' + (type === 'IN' ? 'restocked' : 'deducted') + ' — ' + ing.current_stock + ' ' + ing.unit + ' left');
      location.hash = '#inventory/history?ing=' + encodeURIComponent(ing.ingredient_id);
    });
  }

  /* ---------- Stock History ---------- */
  var histFrom = '', histTo = '';
  function scrHistory(el) {
    var txs = S().stock_transactions.slice().sort(function (a, b) {
      if (b.id_num != null && a.id_num != null) return b.id_num - a.id_num;
      return b.date_time - a.date_time;
    });
    var rows = txs.filter(function (t) {
      if (histIng !== 'all' && t.ingredient_id !== histIng && t.ingredient_name !== histIng) return false;
      var d = G.dayKey(t.date_time);
      if (histFrom && d < histFrom) return false;
      if (histTo && d > histTo) return false;
      return true;
    });
    var seenIngs = {};
    var ingOpts = [{ id: 'all', name: 'All' }];
    S().ingredients.forEach(function (i) {
      seenIngs[i.ingredient_id] = true;
      ingOpts.push({ id: i.ingredient_id, name: i.ingredient_name });
    });
    S().stock_transactions.forEach(function (t) {
      if (t.ingredient_id && !seenIngs[t.ingredient_id]) {
        seenIngs[t.ingredient_id] = true;
        ingOpts.push({ id: t.ingredient_id, name: t.ingredient_name || t.ingredient_id });
      }
    });

    el.innerHTML = invHead('Stock In / Out') +
      A().subtabs([['Ingredient List', 'inventory'], ['Stock In / Out', 'inventory/stock'], ['Stock History', 'inventory/history']], 'Stock History') +
      '<div class="report-controls">' +
      '<label class="field">Ingredient<select id="h-ing">' +
      ingOpts.map(function (o) { return '<option value="' + esc(o.id) + '"' + (histIng === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field">From<input type="date" id="h-from" value="' + esc(histFrom) + '"></label>' +
      '<label class="field">To<input type="date" id="h-to" value="' + esc(histTo) + '"></label></div>' +
      '<div class="tbl-wrap"><table class="tbl tbl-stock-history"><thead><tr>' +
      '<th>ID</th><th>DATE &amp; TIME</th><th>INGREDIENT</th><th>TYPE</th><th>QTY</th><th>REMAINING</th><th>BY</th><th>REMARKS</th>' +
      '</tr></thead><tbody>' +
      (rows.slice(0, 300).map(function (t) {
        var ing = G.ingById(t.ingredient_id);
        var u = G.userById(t.user_id);
        var ingName = ing ? ing.ingredient_name : (t.ingredient_name || t.ingredient_id);
        var ingUnit = ing ? ing.unit : (t.unit || '');
        var byName = u ? u.full_name : (t.by_name || '—');
        return '<tr>' +
          '<td class="mono">' + (t.id_num != null ? t.id_num : t.stock_trans_id) + '</td>' +
          '<td>' + G.fmtDateTime(t.date_time) + '</td>' +
          '<td>' + esc(ingName) + '</td>' +
          '<td><span class="chip ' + (t.type === 'IN' ? 'chip-ok' : 'chip-out') + '">' + t.type + '</span></td>' +
          '<td class="mono">' + t.quantity + ' ' + esc(ingUnit) + '</td>' +
          '<td class="mono">' + t.remaining_stock + '</td>' +
          '<td>' + esc(byName) + '</td>' +
          '<td>' + esc(String(t.remarks || '—').replace(/\b(Order|Cancelled)\s+(?:\d+-)?[A-Za-z]+-(\d+)/g, '$1 $2')) + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="muted">No transactions.</td></tr>') + '</tbody></table></div>' +
      (rows.length > 300 ? '<p class="muted" style="font-size:.8rem">Showing latest 300 of ' + rows.length + '.</p>' : '');
    $('#h-ing').addEventListener('change', function () { histIng = this.value; A().render(); });
    $('#h-from').addEventListener('change', function () { histFrom = this.value; A().render(); });
    $('#h-to').addEventListener('change', function () { histTo = this.value; A().render(); });
  }

  /* ================= SUPPLIERS ================= */
  function scrSuppliers(el, sub) {
    var parts = sub.split('/');
    if (parts[0] === 'new') return supplierForm(el, null);
    if (parts[1] === 'edit') return supplierForm(el, G.supplierById(parts[0]));
    el.innerHTML = head('Suppliers',
      '<a class="btn btn-primary" href="#suppliers/new">' + ICONS.plus + 'Add supplier</a>') +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>SUPPLIER NAME</th><th>CONTACT PERSON</th><th>CONTACT NUMBER</th><th>ADDRESS</th><th class="status-cell">STATUS</th><th>ACTIONS</th>' +
      '</tr></thead><tbody>' +
      S().suppliers.map(function (s2) {
        return '<tr>' +
          '<td><strong>' + esc(s2.supplier_name) + '</strong></td>' +
          '<td>' + esc(s2.contact_person) + '</td>' +
          '<td>' + esc(s2.contact_number) + '</td>' +
          '<td>' + esc(s2.address) + '</td>' +
          '<td class="status-cell">' + (s2.status === 'Active' ? chip('ok', 'Active') : chip('out', 'Inactive')) + '</td>' +
          '<td class="act-cell"><a class="btn btn-sm" href="#suppliers/' + s2.supplier_id + '/edit">' + ICONS.pencil + 'Edit</a> ' +
          '<button class="btn btn-sm ' + (s2.status === 'Active' ? 'btn-danger' : '') + '" data-stog="' + s2.supplier_id + '">' + (s2.status === 'Active' ? 'Deactivate' : 'Activate') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    $$('[data-stog]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s2 = G.supplierById(b.dataset.stog);
        G.confirmDialog({
          title: (s2.status === 'Active' ? 'Deactivate' : 'Activate') + ' supplier',
          body: (s2.status === 'Active' ? 'Deactivate <strong>' + esc(s2.supplier_name) + '</strong>?' : 'Reactivate <strong>' + esc(s2.supplier_name) + '</strong>?'),
          okLabel: s2.status === 'Active' ? 'Deactivate' : 'Activate', danger: s2.status === 'Active'
        }).then(function (yes) {
          if (!yes) return;
          s2.status = s2.status === 'Active' ? 'Inactive' : 'Active';
          G.save(); A().render(); G.toast(s2.supplier_name + ' ' + s2.status.toLowerCase());
        });
      });
    });
  }
  function supplierForm(el, s2) {
    var isNew = !s2;
    s2 = s2 || { supplier_id: null, supplier_name: '', contact_person: '', contact_number: '', address: '', status: 'Active' };
    el.innerHTML = head(isNew ? 'Add Supplier' : 'Edit — ' + s2.supplier_name) +
      '<div class="card" style="max-width:640px">' +
      '<div class="form-row"><label class="field">Supplier name<input type="text" id="sf-name" value="' + esc(s2.supplier_name) + '"></label>' +
      '<label class="field">Contact person<input type="text" id="sf-cp" value="' + esc(s2.contact_person) + '"></label></div>' +
      '<div class="form-row"><label class="field">Contact number<input type="text" id="sf-cn" value="' + esc(s2.contact_number) + '"></label>' +
      '<label class="field">Status<select id="sf-status">' +
      ['Active', 'Inactive'].map(function (x) { return '<option' + (s2.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') +
      '</select></label></div>' +
      '<label class="field">Address<input type="text" id="sf-addr" value="' + esc(s2.address) + '"></label>' +
      '<div class="field-err" id="sf-err"></div>' +
      '<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" id="sf-save">Save</button>' +
      '<a class="btn" href="#suppliers">Cancel</a></div></div>';
    $('#sf-save').addEventListener('click', function () {
      var name = $('#sf-name').value.trim();
      if (!name) { $('#sf-err').textContent = 'Supplier name is required.'; return; }
      s2.supplier_name = name;
      s2.contact_person = $('#sf-cp').value.trim();
      s2.contact_number = $('#sf-cn').value.trim();
      s2.address = $('#sf-addr').value.trim();
      s2.status = $('#sf-status').value;
      if (isNew) { s2.supplier_id = G.uid('sup'); S().suppliers.push(s2); }
      G.save();
      G.toast(name + ' saved');
      location.hash = '#suppliers';
    });
  }

  /* ================= REPORTS ================= */
  var RPT_TABS = [['Daily Sales', 'reports/daily'], ['Monthly Sales', 'reports/monthly'], ['Best Sellers', 'reports/best'], ['Stock Status', 'reports/stock']];
  var repDaily = null, repMonth = null, repLowOnly = false, repFrom = null, repTo = null;
  function rptActions(id) {
    return '<button class="btn btn-sm report-action" id="' + id + '-csv">' + ICONS.download + 'Export CSV</button>' +
      '<button class="btn btn-sm report-action" id="' + id + '-print">' + ICONS.printer + 'Print</button>';
  }
  function bindRpt(id, csvFn) {
    $('#' + id + '-csv').addEventListener('click', csvFn);
    $('#' + id + '-print').addEventListener('click', function () { window.print(); });
  }

  function scrReports(el, sub) {
    var which = ['daily', 'monthly', 'best', 'stock'].indexOf(sub) >= 0 ? sub : 'daily';
    if (which === 'daily') return scrRepDaily(el);
    if (which === 'monthly') return scrRepMonthly(el);
    if (which === 'best') return scrRepBest(el);
    return scrRepStock(el);
  }
  function repHead(t, active, actions) {
    return head(t, actions) + A().subtabs(RPT_TABS.map(function (t2) { return [t2[0], t2[1]]; }), active);
  }

  function scrRepDaily(el) {
    var d = repDaily || G.dayKey(Date.now());
    var report = G.v_daily_sales_report();
    var week = [];
    for (var i = 6; i >= 0; i--) {
      var day = new Date(new Date(d + 'T12:00:00').getTime() - i * 86400000);
      var k = G.dayKey(day.getTime());
      var row = report.filter(function (r) { return r.date === k; })[0];
      week.push({ date: k, orders: row ? row.orders : 0, sales: row ? row.sales : 0 });
    }
    var dayRow = week[6];
    var orders = G.orderGroups().filter(function (g) { return G.dayKey(g.order_date) === d; })
      .sort(function (a, b) { return a.order_date - b.order_date; });
    el.innerHTML = repHead('Daily Sales Report', 'Daily Sales',
      '<label class="field" style="min-width:150px">Date<input type="date" id="rd-date" value="' + d + '"></label>' + rptActions('rd')) +
      '<div class="kpis">' +
      '<div class="kpi"><div class="lbl">Sales</div><div class="val">' + peso(dayRow.sales) + '</div></div>' +
      '<div class="kpi"><div class="lbl">Orders</div><div class="val coffee">' + dayRow.orders + '</div></div>' +
      '<div class="kpi"><div class="lbl">Avg order</div><div class="val">' + peso(dayRow.orders ? dayRow.sales / dayRow.orders : 0) + '</div></div></div>' +
      '<div class="print-area"><h3 style="margin-bottom:.5rem">7 days ending ' + esc(d) + '</h3>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th class="num">Orders</th><th class="num">Sales</th></tr></thead><tbody>' +
      week.map(function (r) {
        return '<tr' + (r.date === d ? ' style="background:var(--card-2)"' : '') + '><td>' + r.date + '</td><td class="num">' + r.orders + '</td><td class="num">' + peso(r.sales) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<h3 style="margin:1rem 0 .5rem">Orders on ' + esc(d) + '</h3>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Queue</th><th>Time</th><th>Type</th><th class="status-cell">Status</th><th class="num">Total</th><th>Payment</th></tr></thead><tbody>' +
      (orders.map(function (g) {
        var pay = G.paymentFor(g.order_id);
        return '<tr class="cost-row" data-oid="' + esc(g.order_id) + '"><td class="num">' + esc(G.queueNo(g.order_id)) + '</td>' +
          '<td>' + G.fmtTime(g.order_date) + '</td><td>' + esc(g.order_type) + '</td><td class="status-cell">' + A().statusChip(g.status) + '</td>' +
          '<td class="num">' + peso(g.total) + '</td><td>' + (pay ? esc(pay.payment_method) : '—') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted">No orders on this date.</td></tr>') +
      '</tbody></table></div></div>';
    $('#rd-date').addEventListener('change', function () { repDaily = this.value; A().render(); });
    bindRpt('rd', function () {
      A().exportCSV('daily-sales-' + d + '.csv', ['Date', 'Orders', 'Sales'],
        week.map(function (r) { return [r.date, r.orders, r.sales.toFixed(2)]; }));
    });
    $$('[data-oid]').forEach(function (r) {
      r.addEventListener('click', function () { location.hash = '#orders/' + encodeURIComponent(r.dataset.oid); });
    });
  }

  function scrRepMonthly(el) {
    var m = repMonth || G.dayKey(Date.now()).slice(0, 7);
    var report = G.v_monthly_sales_report();
    // last 12 months ending m
    var months = [];
    var d0 = new Date(m + '-15T00:00:00');
    for (var i = 11; i >= 0; i--) {
      var d = new Date(d0.getFullYear(), d0.getMonth() - i, 15);
      var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var row = report.filter(function (r) { return r.month === k; })[0];
      months.push({ month: k, orders: row ? row.orders : 0, sales: row ? row.sales : 0 });
    }
    el.innerHTML = repHead('Monthly Sales Report', 'Monthly Sales',
      '<label class="field" style="min-width:150px">Month<input type="month" id="rm-month" value="' + m + '"></label>' + rptActions('rm')) +
      '<div class="chart-card print-area monthly-sales-chart"><h3>Sales — 12 months ending ' + esc(m) + '</h3>' +
      A().barChart(months.map(function (r) { return r.sales; }), months.map(function (r) { return r.month.slice(5); })) + '</div>' +
      '<div class="print-area" style="margin-top:.9rem"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="num">Orders</th><th class="num">Sales</th></tr></thead><tbody>' +
      months.map(function (r) {
        return '<tr' + (r.month === m ? ' style="background:var(--card-2)"' : '') + '><td>' + r.month + '</td><td class="num">' + r.orders + '</td><td class="num">' + peso(r.sales) + '</td></tr>';
      }).join('') + '</tbody></table></div></div></div>';
    $('#rm-month').addEventListener('change', function () { repMonth = this.value; A().render(); });
    bindRpt('rm', function () {
      A().exportCSV('monthly-sales-' + m + '.csv', ['Month', 'Orders', 'Sales'],
        months.map(function (r) { return [r.month, r.orders, r.sales.toFixed(2)]; }));
    });
  }

  function scrRepBest(el) {
    var to = repTo || G.dayKey(Date.now());
    var from = repFrom || G.dayKey(Date.now() - 6 * 86400000);
    var rows = G.v_best_sellers(from, to);
    var sampleRows = [
      { product: 'Salabat', qty: 46, sales: 3450 },
      { product: 'Tablea Hot Chocolate', qty: 45, sales: 5850 },
      { product: 'Cheese Pandesal (3 pcs)', qty: 41, sales: 2255 },
      { product: 'Iced Americano', qty: 39, sales: 4290 },
      { product: 'Longsilog', qty: 35, sales: 4900 },
      { product: 'Tapsilog', qty: 34, sales: 5100 },
      { product: 'Hot Cafe Latte', qty: 32, sales: 3840 },
      { product: 'Iced Hazelnut Latte', qty: 32, sales: 4800 },
      { product: 'Banana Bread', qty: 31, sales: 1860 },
      { product: 'Iced Ube Latte', qty: 31, sales: 4805 },
      { product: 'Ensaymada', qty: 29, sales: 2030 },
      { product: 'Chicken Adobo with Rice', qty: 24, sales: 3840 },
      { product: 'Iced Caramel Macchiato', qty: 24, sales: 3600 },
      { product: 'Iced Spanish Latte', qty: 23, sales: 3335 },
      { product: 'Kapeng Barako', qty: 22, sales: 1870 },
      { product: 'Cheese Bread', qty: 20, sales: 1000 }
    ];
    var displayRows = rows.length ? rows : sampleRows;
    var top5 = displayRows.slice(0, 5).map(function (r) { return { name: r.product, v: r.qty }; });
    el.innerHTML = repHead('Best Sellers Report', 'Best Sellers',
      '<label class="field" style="min-width:140px">From<input type="date" id="rb-from" value="' + from + '"></label>' +
      '<label class="field" style="min-width:140px">To<input type="date" id="rb-to" value="' + to + '"></label>' + rptActions('rb')) +
      (rows.length ? '' : '<p class="muted sample-preview-note">Sample preview only — not saved or included in CSV exports.</p>') +
      '<div class="charts"><div class="chart-card print-area best-sellers-chart"><h3>Top 5 — ' + esc(from) + ' to ' + esc(to) + '</h3>' +
      (top5.length ? A().hbarChart(top5) : '<p class="muted">No sales in range.</p>') + '</div>' +
      '<div class="print-area"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rank</th><th>Product</th><th class="num">Qty sold</th><th class="num">Sales</th></tr></thead><tbody>' +
      (displayRows.map(function (r, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(r.product) + '</td><td class="num">' + r.qty + '</td><td class="num">' + peso(r.sales) + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted">No sales in range.</td></tr>') +
      '</tbody></table></div></div></div>';
    $('#rb-from').addEventListener('change', function () { repFrom = this.value; A().render(); });
    $('#rb-to').addEventListener('change', function () { repTo = this.value; A().render(); });
    bindRpt('rb', function () {
      A().exportCSV('best-sellers-' + from + '_' + to + '.csv', ['Rank', 'Product', 'Qty sold', 'Sales'],
        rows.map(function (r, i) { return [i + 1, r.product, r.qty, r.sales.toFixed(2)]; }));
    });
  }

  function scrRepStock(el) {
    var rows = G.v_stock_status();
    var shown = repLowOnly ? rows.filter(function (r) { return r.k !== 'ok'; }) : rows;
    el.innerHTML = repHead('Stock Status Report', 'Stock Status',
      '<button class="opt" id="rs-low" aria-pressed="' + repLowOnly + '">Low stock only</button>' + rptActions('rs')) +
      '<div class="print-area"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ingredient</th><th>Unit</th><th class="num">Current stock</th><th class="num">Reorder level</th><th class="status-cell">Status</th></tr></thead><tbody>' +
      (shown.map(function (r) {
        return '<tr><td><strong>' + esc(r.ingredient) + '</strong></td><td>' + r.unit + '</td>' +
          '<td class="num">' + r.current_stock + '</td><td class="num">' + r.reorder_level + '</td>' +
          '<td class="status-cell">' + chip(r.k, r.status) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">Nothing low on stock.</td></tr>') +
      '</tbody></table></div></div>';
    $('#rs-low').addEventListener('click', function () { repLowOnly = !repLowOnly; A().render(); });
    bindRpt('rs', function () {
      A().exportCSV('stock-status-' + G.dayKey(Date.now()) + '.csv',
        ['Ingredient', 'Unit', 'Current stock', 'Reorder level', 'Status'],
        shown.map(function (r) { return [r.ingredient, r.unit, r.current_stock, r.reorder_level, r.status]; }));
    });
  }

  /* ================= USERS ================= */
  function scrUsers(el, sub) {
    var parts = sub.split('/');
    if (parts[0] === 'new') return userForm(el, null);
    if (parts[1] === 'edit') return userForm(el, G.userById(parts[0]));
    var me = A().currentUser();
    el.innerHTML = head('Users',
      '<a class="btn btn-primary" href="#users/new">' + ICONS.plus + 'Add user</a>') +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Full name</th><th>Username</th><th>Role</th><th>Status</th><th>Date created</th><th>Actions</th></tr></thead><tbody>' +
      S().users.map(function (u) {
        return '<tr><td><strong>' + esc(u.full_name) + '</strong>' + (u.user_id === me.user_id ? ' <span class="muted" style="font-size:.75rem">(you)</span>' : '') + '</td>' +
          '<td class="num">' + esc(u.username) + '</td><td>' + esc(u.role) + '</td>' +
          '<td>' + (u.status === 'Active' ? chip('ok', 'Active') : chip('out', 'Inactive')) + '</td>' +
          '<td>' + G.fmtDate(u.date_created) + '</td>' +
          '<td class="act-cell"><div class="users-actions"><a class="btn btn-sm" href="#users/' + u.user_id + '/edit">' + ICONS.pencil + 'Edit</a>' +
          (u.user_id !== me.user_id ? '<button class="btn btn-sm ' + (u.status === 'Active' ? 'btn-danger' : '') + '" data-utog="' + u.user_id + '">' + (u.status === 'Active' ? 'Deactivate' : 'Activate') + '</button>' : '') +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
    $$('[data-utog]').forEach(function (b) {
      b.addEventListener('click', function () {
        var u = G.userById(b.dataset.utog);
        var admins = S().users.filter(function (x) { return x.role === 'Owner' && x.status === 'Active'; });
        if (u.status === 'Active' && u.role === 'Owner' && admins.length <= 1) {
          G.toast('At least one active Admin must remain.', true); return;
        }
        G.confirmDialog({
          title: (u.status === 'Active' ? 'Deactivate' : 'Activate') + ' account',
          body: (u.status === 'Active' ? 'Deactivate <strong>' + esc(u.full_name) + '</strong>? They will not be able to sign in.' : 'Reactivate <strong>' + esc(u.full_name) + '</strong>?'),
          okLabel: u.status === 'Active' ? 'Deactivate' : 'Activate', danger: u.status === 'Active'
        }).then(function (yes) {
          if (!yes) return;
          u.status = u.status === 'Active' ? 'Inactive' : 'Active';
          G.save(); A().render(); G.toast(u.full_name + ' ' + u.status.toLowerCase());
        });
      });
    });
  }
  function userForm(el, u) {
    var isNew = !u;
    var me = A().currentUser();
    var isSelf = u && u.user_id === me.user_id;
    u = u || { user_id: null, username: '', password: '', full_name: '', role: 'Barista', status: 'Active' };
    el.innerHTML = head(isNew ? 'Add User' : 'Edit — ' + u.full_name) +
      '<div class="card" style="max-width:640px">' +
      '<div class="form-row"><label class="field">Full name<input type="text" id="uf-name" value="' + esc(u.full_name) + '"></label>' +
      '<label class="field">Username<input type="text" id="uf-user" value="' + esc(u.username) + '"' + (isNew ? '' : ' disabled') + '></label></div>' +
      '<div class="form-row"><label class="field">' + (isNew ? 'Password (min 6 chars)' : 'New password (blank = keep)') +
      '<input type="text" id="uf-pass" value="" placeholder="' + (isNew ? 'required' : 'leave blank to keep') + '"></label>' +
      '<label class="field">Role<select id="uf-role"' + (isSelf ? ' disabled' : '') + '>' +
      ['Owner', 'Barista'].map(function (r) { return '<option' + (u.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
      '</select>' + (isSelf ? '<span class="muted" style="font-size:.75rem">You cannot change your own role.</span>' : '') + '</label></div>' +
      '<div class="form-row"><label class="field">Status<select id="uf-status"' + (isSelf ? ' disabled' : '') + '>' +
      ['Active', 'Inactive'].map(function (x) { return '<option' + (u.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') +
      '</select></label></div>' +
      '<div class="field-err" id="uf-err"></div>' +
      '<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" id="uf-save">Save</button>' +
      '<a class="btn" href="#users">Cancel</a></div></div>';
    $('#uf-save').addEventListener('click', function () {
      var name = $('#uf-name').value.trim();
      var pw = $('#uf-pass').value;
      if (!name) { $('#uf-err').textContent = 'Full name is required.'; return; }
      var role = isSelf ? u.role : $('#uf-role').value;
      var status = isSelf ? u.status : $('#uf-status').value;
      if (isNew) {
        var un = $('#uf-user').value.trim();
        if (!un) { $('#uf-err').textContent = 'Username is required.'; return; }
        if (S().users.some(function (x) { return x.username === un; })) { $('#uf-err').textContent = 'Username already taken.'; return; }
        if (pw.length < 6) { $('#uf-err').textContent = 'Password must be at least 6 characters.'; return; }
        S().users.push({ user_id: G.uid('u'), username: un, password: pw, full_name: name,
          role: role, status: status, date_created: Date.now() });
      } else {
        // keep at least one active Admin
        var admins = S().users.filter(function (x) { return x.role === 'Owner' && x.status === 'Active'; });
        var wasActiveAdmin = u.role === 'Owner' && u.status === 'Active';
        if (wasActiveAdmin && (role !== 'Owner' || status !== 'Active') && admins.length <= 1) {
          $('#uf-err').textContent = 'At least one active Admin must remain.'; return;
        }
        u.full_name = name;
        if (pw) {
          if (pw.length < 6) { $('#uf-err').textContent = 'Password must be at least 6 characters.'; return; }
          u.password = pw;
        }
        u.role = role; u.status = status;
      }
      G.save();
      G.toast(name + ' saved');
      location.hash = '#users';
    });
  }

  window.GKAdmin = {
    products: scrProducts, inventory: scrInventory,
    suppliers: scrSuppliers, reports: scrReports, users: scrUsers,
    costing: function (el, sub) { location.hash = '#products/recipe'; }
  };
})();
