/* Gunita Kopi — shared store v3: ERD-shaped state, seeds, business rules,
   view functions (v_*), and UI utilities. Exposes window.GKStore.
   Tables: USERS, SUPPLIERS, INGREDIENTS, STOCK_TRANSACTIONS, PRODUCTS,
   PRODUCT_INGREDIENTS, PRODUCT_COSTING, ORDERS (one row per item), PAYMENTS. */
(function () {
  'use strict';
  var LS_KEY = 'gunita-kopi-v6';
  var SS_KEY = 'gk-session-' + (window.GK_ROLE || 'shared');

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var peso = function (n) {
    return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var uid = function (p) { return (p || 'x') + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); };
  function fmtTime(ts) {
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function fmtDateTime(ts) { return fmtDate(ts) + ' ' + fmtTime(ts); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dayCompact(ts) { var d = new Date(ts); return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
  function sameDay(a, b) { return dayKey(a) === dayKey(b); }
  function elapsed(ts) {
    var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm ago';
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var ICONS = {
    cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M7 2v2M11 2v2M15 2v2"/></svg>',
    iced: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14l-1.5 13a2 2 0 0 1-2 1.8h-7A2 2 0 0 1 6.5 20Z"/><path d="M12 7V3m0 0-2 1.5M12 3l2 1.5"/><path d="M8 12l8 4M8 16l8-4"/></svg>',
    rice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M7 12c0-3 2.2-5 5-5s5 2 5 5"/><path d="M15 3l4 3M17 2l3 4"/></svg>',
    pastry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.6 13.1 14.8-6.4a1 1 0 0 1 1.3 1.2c-.7 3-3.4 5.1-6.5 5.1H6a1.4 1.4 0 0 1-1.4.1Z"/><path d="M4 17c3-1 13-1 16 0"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h3l2.6 12.5a2 2 0 0 0 2 1.5h8.7a2 2 0 0 0 2-1.6L22 7H6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.1M6.6 6.6C3.6 8.3 2 12 2 12s3.5 8 10 8a10 10 0 0 0 4.3-.9"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
    wifiOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 2 20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.9M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 3.6-2.3M14.5 10.4a10 10 0 0 1 4.5 2.5"/><path d="M12 20h.01"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 8h13v9H1z"/><path d="M14 11h4l4 3v3h-8"/><circle cx="6" cy="19" r="1.6"/><circle cx="18" cy="19" r="1.6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 8.5a3 3 0 1 0-1.4-5.7M21.5 20c0-2.8-1.9-4.6-4.6-5.3"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  };

  var CATS = ['Iced Coffee Drinks', 'Hot Beverages', 'Pastries & Snacks', 'Rice Meals'];
  var CAT_ICONS = { 'Iced Coffee Drinks': 'iced', 'Hot Beverages': 'cup', 'Pastries & Snacks': 'pastry', 'Rice Meals': 'rice' };

  /* Add-on catalogue (business rule, not a table — add-ons are ingredients). */
  var ADDONS = [
    { ingredient_id: 'i-beans', label: 'Extra shot', qty: 18, price: 25, cats: ['Iced Coffee Drinks', 'Hot Beverages'], needsBeans: true },
    { ingredient_id: 'i-caramel', label: 'Caramel syrup', qty: 15, price: 15, cats: ['Iced Coffee Drinks'] },
    { ingredient_id: 'i-vanilla', label: 'Vanilla syrup', qty: 15, price: 15, cats: ['Iced Coffee Drinks'] },
    { ingredient_id: 'i-hazelnut', label: 'Hazelnut syrup', qty: 15, price: 15, cats: ['Iced Coffee Drinks'] },
    { ingredient_id: 'i-milk', label: 'Extra milk', qty: 60, price: 15, cats: ['Iced Coffee Drinks', 'Hot Beverages'] },
    { ingredient_id: 'i-rice', label: 'Extra rice', qty: 150, price: 20, cats: ['Rice Meals'] },
    { ingredient_id: 'i-egg', label: 'Extra egg', qty: 1, price: 15, cats: ['Rice Meals'] }
  ];

  /* ---------- seed data ---------- */
  function seedUsers() {
    var t0 = Date.now() - 90 * 86400000;
    return [
      { user_id: 'u-owner', username: 'owner', password: 'owner123', full_name: 'Eric Espedilion', role: 'Owner', status: 'Active', date_created: t0 },
      { user_id: 'u-juan', username: 'barista', password: 'barista123', full_name: 'Juan Dela Cruz', role: 'Barista', status: 'Active', date_created: t0 },
      { user_id: 'u-maria', username: 'barista2', password: 'barista123', full_name: 'Maria Santos', role: 'Barista', status: 'Active', date_created: t0 }
    ];
  }
  function seedSuppliers() {
    return [
      { supplier_id: 'sup-unisilver', supplier_name: 'Unisilver PH', contact_person: 'Ramon Mercado', contact_number: '0917 555 0101', address: 'Manila City', status: 'Active' },
      { supplier_id: 'sup-syrups', supplier_name: 'Sweet Syrups PH', contact_person: 'Paolo Reyes', contact_number: '0919 555 0103', address: 'Mandaluyong City', status: 'Active' },
      { supplier_id: 'sup-everstock', supplier_name: 'Everstock PH', contact_person: 'Liza Aquino', contact_number: '0918 555 0102', address: 'Laguna BelAir, Sta. Rosa', status: 'Active' },
      { supplier_id: 'sup-nova', supplier_name: 'Nova Supply', contact_person: 'Jenny Lim', contact_number: '0920 555 0104', address: 'Quezon City', status: 'Active' },
      { supplier_id: 'sup-panaderia', supplier_name: 'Panaderia ni Aling Rosa', contact_person: 'Rosa Villanueva', contact_number: '0921 555 0105', address: 'Brgy. Poblacion, nearby', status: 'Inactive' },
      { supplier_id: 'sup-palengke', supplier_name: 'Palengke Fresh Meats & Produce', contact_person: 'Domingo Cruz', contact_number: '0922 555 0106', address: 'Public Market, Stall 14', status: 'Active' }
    ];
  }
  function seedIngredients() {
    var t0 = Date.now() - 2 * 86400000;
    return [
      { ingredient_id: 'i-beans', id_num: 7, supplier_id: 'sup-unisilver', ingredient_name: 'Coffee beans', unit: 'g',
        current_stock: 2900, reorder_level: 800, unit_cost: 0.90, status: 'Active', status_label: 'In Stock', status_k: 'ok', date_updated: t0 },
      { ingredient_id: 'i-caramel', id_num: 6, supplier_id: 'sup-syrups', ingredient_name: 'Caramel syrup', unit: 'mL',
        current_stock: 650, reorder_level: 300, unit_cost: 0.50, status: 'Active', status_label: 'In Stock', status_k: 'ok', date_updated: t0 },
      { ingredient_id: 'i-vanilla', id_num: 5, supplier_id: 'sup-syrups', ingredient_name: 'Vanilla syrup', unit: 'mL',
        current_stock: 600, reorder_level: 300, unit_cost: 0.50, status: 'Active', status_label: 'In Stock', status_k: 'ok', date_updated: t0 },
      { ingredient_id: 'i-hazelnut', id_num: 4, supplier_id: 'sup-syrups', ingredient_name: 'Hazelnut syrup', unit: 'mL',
        current_stock: 0, reorder_level: 250, unit_cost: 0.50, status: 'Active', status_label: 'Out of Stock', status_k: 'out', date_updated: t0 },
      { ingredient_id: 'i-cup22', id_num: 3, supplier_id: 'sup-everstock', ingredient_name: '22oz iced cups', unit: 'pcs',
        current_stock: 120, reorder_level: 100, unit_cost: 6.00, status: 'Active', status_label: 'In Stock', status_k: 'ok', date_updated: t0 },
      { ingredient_id: 'i-choc-syrup', id_num: 2, supplier_id: 'sup-nova', ingredient_name: 'Chocolate syrup', unit: 'pcs',
        current_stock: 140, reorder_level: 80, unit_cost: 4.00, status: 'Active', status_label: 'In Stock', status_k: 'ok', date_updated: t0 },
      { ingredient_id: 'i-lid', id_num: 1, supplier_id: 'sup-nova', ingredient_name: 'Cup lids', unit: 'pcs',
        current_stock: 140, reorder_level: 150, unit_cost: 2.00, status: 'Active', status_label: 'Out of Stock', status_k: 'out', date_updated: t0 }
    ];
  }
  function seedProductDefs() {
    // [id, name, cat, price, desc, recipe[[ingId,qty]...], packaging₱]
    var icedPack = [['i-cup16', 1], ['i-lid', 1], ['i-straw', 1]];
    var hotPack = [['i-cup8', 1], ['i-lid', 1]];
    function iced(id, name, price, extra, tag) { return [id, name, 'Iced Coffee Drinks', price, tag, extra.concat(icedPack), 8]; }
    function hot(id, name, price, extra, tag) { return [id, name, 'Hot Beverages', price, tag, extra.concat(hotPack), 6]; }
    function pastry(id, name, price, invId, qty, tag) { return [id, name, 'Pastries & Snacks', price, tag, [[invId, qty]], 3]; }
    function rice(id, name, price, invId, qty, tag) { return [id, name, 'Rice Meals', price, tag, [['i-rice', 200], ['i-egg', 1], [invId, qty]], 10]; }
    return [
      iced('p-iced-spanish-latte', 'Iced Spanish Latte', 145, [['i-beans', 18], ['i-milk', 150], ['i-condensed', 15]], 'Condensed-milk classic, 16oz'),
      iced('p-iced-caramel-macchiato', 'Iced Caramel Macchiato', 150, [['i-beans', 18], ['i-milk', 150], ['i-caramel', 30]], 'Caramel drizzle over milk, 16oz'),
      iced('p-iced-ube-latte', 'Iced Ube Latte', 155, [['i-beans', 18], ['i-milk', 150], ['i-ube', 30]], 'Ube halaya + espresso, 16oz'),
      iced('p-iced-americano', 'Iced Americano', 110, [['i-beans', 18]], 'Straight espresso over ice, 16oz'),
      iced('p-iced-hazelnut-latte', 'Iced Hazelnut Latte', 150, [['i-beans', 18], ['i-milk', 150], ['i-hazelnut', 30]], 'Hazelnut syrup latte, 16oz'),
      hot('p-kapeng-barako', 'Kapeng Barako', 85, [['i-beans', 20]], 'Batangas bold brew, 8oz'),
      hot('p-hot-caf-latte', 'Hot Café Latte', 120, [['i-beans', 18], ['i-milk', 180]], 'Smooth milk espresso, 8oz'),
      hot('p-tablea-hot-chocolate', 'Tablea Hot Chocolate', 130, [['i-tablea', 40], ['i-milk', 150]], 'Thick tsokolate, 8oz'),
      hot('p-salabat', 'Salabat', 75, [['i-ginger', 30]], 'Warming ginger tea, 8oz'),
      pastry('p-ensaymada', 'Ensaymada', 70, 'i-ensaymada', 1, 'Cheesy brioche'),
      pastry('p-cheese-pandesal-3-pcs', 'Cheese Pandesal (3 pcs)', 55, 'i-pandesal', 3, 'Fresh-baked, melty cheese'),
      pastry('p-banana-bread', 'Banana Bread', 60, 'i-bananabread', 1, 'Moist loaf slice'),
      rice('p-tapsilog', 'Tapsilog', 150, 'i-tapa', 120, 'Beef tapa, garlic rice, egg'),
      rice('p-longsilog', 'Longsilog', 140, 'i-longganisa', 120, 'Longganisa, garlic rice, egg'),
      rice('p-chicken-adobo-with-rice', 'Chicken Adobo with Rice', 160, 'i-chicken', 180, 'Classic adobo, rice')
    ];
  }
  function buildProducts(defs) {
    var t0 = Date.now() - 90 * 86400000;
    return defs.map(function (d, idx) {
      return { product_id: d[0], id_num: idx + 1, product_name: d[1], description: d[4], category: d[2], price: d[3],
        is_available: true, image: null, date_created: t0, created_by: 'u-owner' };
    });
  }
  function buildRecipes(defs) {
    var rows = [];
    defs.forEach(function (d) {
      d[5].forEach(function (r, i) {
        rows.push({ product_ingredient_id: d[0] + '-pi-' + i, product_id: d[0], ingredient_id: r[0], quantity_needed: r[1] });
      });
    });
    return rows;
  }
  function buildCosting(defs, ingredients) {
    var cost = {};
    ingredients.forEach(function (i) { cost[i.ingredient_id] = i.unit_cost; });
    return defs.map(function (d) {
      var ic = d[5].reduce(function (s, r) { return s + r[1] * (cost[r[0]] || 0); }, 0);
      return { costing_id: 'c-' + d[0], product_id: d[0], ingredient_cost: ic,
        packaging_cost: d[6], total_cost: ic + d[6], date_updated: Date.now() - 90 * 86400000 };
    });
  }
  /* Exact stock transactions matching the Stock History mockup */
  function buildSeedTx(ingredients, users) {
    return [
      { stock_trans_id: 'stx-9', id_num: 9, ingredient_id: 'i-caramel', ingredient_name: 'Caramel syrup', unit: 'mL',
        user_id: 'u-juan', by_name: 'Juan Dela Cruz', type: 'IN', quantity: 100, remaining_stock: 772, date_time: new Date(2026, 10, 4, 17, 29, 0).getTime(), remarks: 'Delivery' },
      { stock_trans_id: 'stx-8', id_num: 8, ingredient_id: 'i-caramel', ingredient_name: 'Caramel syrup', unit: 'mL',
        user_id: 'u-juan', by_name: 'Juan Dela Cruz', type: 'IN', quantity: 22, remaining_stock: 672, date_time: new Date(2026, 10, 4, 17, 28, 0).getTime(), remarks: 'Delivery' },
      { stock_trans_id: 'stx-7', id_num: 7, ingredient_id: 'i-vanilla', ingredient_name: 'Vanilla syrup', unit: 'mL',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 120, remaining_stock: 600, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' },
      { stock_trans_id: 'stx-6', id_num: 6, ingredient_id: 'i-cup8', ingredient_name: '8oz hot cups', unit: 'pcs',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 28, remaining_stock: 140, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' },
      { stock_trans_id: 'stx-5', id_num: 5, ingredient_id: 'i-milk', ingredient_name: 'Fresh milk', unit: 'mL',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 500, remaining_stock: 2800, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' },
      { stock_trans_id: 'stx-4', id_num: 4, ingredient_id: 'i-tablea', ingredient_name: 'Tablea', unit: 'g',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 160, remaining_stock: 800, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' },
      { stock_trans_id: 'stx-3', id_num: 3, ingredient_id: 'i-egg', ingredient_name: 'Eggs', unit: 'pcs',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 6, remaining_stock: 32, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' },
      { stock_trans_id: 'stx-2', id_num: 2, ingredient_id: 'i-longganisa', ingredient_name: 'Longganisa', unit: 'g',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 140, remaining_stock: 700, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' },
      { stock_trans_id: 'stx-1', id_num: 1, ingredient_id: 'i-ube', ingredient_name: 'Ube halaya', unit: 'g',
        user_id: 'u-owner', by_name: 'Eric Espedilion', type: 'OUT', quantity: 100, remaining_stock: 500, date_time: new Date(2026, 10, 2, 16, 55, 0).getTime(), remarks: 'Weekly usage' }
    ];
  }
  /* Exact sample orders matching the Order Board mockup */
  function buildSeedOrders(products, productIng, users) {
    var orders = [
      // Queue 012 — Dine-in — Preparing — Juan Dela Cruz — Nov 3, 2026 2:22 PM
      { order_line_id: 'ol-101', line_no: 101, order_id: '20261103-A-012', user_id: 'u-juan',
        order_type: 'Dine-in', order_date: new Date(2026, 10, 3, 14, 22, 0).getTime(), status: 'Preparing',
        product_id: 'p-iced-spanish-latte', ingredient_id: null, is_addon: 0, quantity: 1, unit_price: 145,
        customization: 'Sugar 50%', special_instructions: 'No lid' },
      { order_line_id: 'ol-102', line_no: 102, order_id: '20261103-A-012', user_id: 'u-juan',
        order_type: 'Dine-in', order_date: new Date(2026, 10, 3, 14, 22, 0).getTime(), status: 'Preparing',
        product_id: 'p-iced-spanish-latte', ingredient_id: 'i-hazelnut', is_addon: 1, quantity: 1, unit_price: 15,
        customization: '', special_instructions: '' },

      // Queue 011 — Take-out — Pending — Juan Dela Cruz — Nov 3, 2026 12:59 PM
      { order_line_id: 'ol-99', line_no: 99, order_id: '20261103-A-011', user_id: 'u-juan',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 59, 0).getTime(), status: 'Pending',
        product_id: 'p-longsilog', ingredient_id: null, is_addon: 0, quantity: 2, unit_price: 140,
        customization: 'Scrambled egg', special_instructions: '' },
      { order_line_id: 'ol-100', line_no: 100, order_id: '20261103-A-011', user_id: 'u-juan',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 59, 0).getTime(), status: 'Pending',
        product_id: 'p-ensaymada', ingredient_id: null, is_addon: 0, quantity: 2, unit_price: 70,
        customization: 'Heated', special_instructions: '' },

      // Queue 010 — Take-out — Pending — Juan Dela Cruz — Nov 3, 2026 12:47 PM
      { order_line_id: 'ol-97', line_no: 97, order_id: '20261103-A-010', user_id: 'u-juan',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 47, 0).getTime(), status: 'Pending',
        product_id: 'p-iced-americano', ingredient_id: null, is_addon: 0, quantity: 1, unit_price: 110,
        customization: 'Less ice', special_instructions: '' },
      { order_line_id: 'ol-98', line_no: 98, order_id: '20261103-A-010', user_id: 'u-juan',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 47, 0).getTime(), status: 'Pending',
        product_id: 'p-iced-spanish-latte', ingredient_id: null, is_addon: 0, quantity: 1, unit_price: 145,
        customization: 'Sugar 25%', special_instructions: 'Serve last' },

      // Queue 009 — Take-out — Completed — Maria Santos — Nov 3, 2026 12:16 PM
      { order_line_id: 'ol-94', line_no: 94, order_id: '20261103-A-009', user_id: 'u-maria',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 16, 0).getTime(), status: 'Completed',
        product_id: 'p-tapsilog', ingredient_id: null, is_addon: 0, quantity: 1, unit_price: 150,
        customization: 'Sunny side up', special_instructions: '' },
      { order_line_id: 'ol-95', line_no: 95, order_id: '20261103-A-009', user_id: 'u-maria',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 16, 0).getTime(), status: 'Completed',
        product_id: 'p-kapeng-barako', ingredient_id: null, is_addon: 0, quantity: 1, unit_price: 85,
        customization: 'Extra hot', special_instructions: '' },
      { order_line_id: 'ol-96', line_no: 96, order_id: '20261103-A-009', user_id: 'u-maria',
        order_type: 'Take-out', order_date: new Date(2026, 10, 3, 12, 16, 0).getTime(), status: 'Completed',
        product_id: 'p-banana-bread', ingredient_id: null, is_addon: 0, quantity: 1, unit_price: 60,
        customization: '', special_instructions: '' }
    ];

    var payments = [
      { payment_id: 'pay-20261103-A-012', order_id: '20261103-A-012', amount_paid: 200,
        payment_method: 'Cash', date_time: new Date(2026, 10, 3, 14, 23, 0).getTime(), received_by: 'u-juan', change_amount: 40 },
      { payment_id: 'pay-20261103-A-011', order_id: '20261103-A-011', amount_paid: 500,
        payment_method: 'Cash', date_time: new Date(2026, 10, 3, 13, 0, 0).getTime(), received_by: 'u-juan', change_amount: 80 },
      { payment_id: 'pay-20261103-A-010', order_id: '20261103-A-010', amount_paid: 300,
        payment_method: 'Cash', date_time: new Date(2026, 10, 3, 12, 48, 0).getTime(), received_by: 'u-juan', change_amount: 45 },
      { payment_id: 'pay-20261103-A-009', order_id: '20261103-A-009', amount_paid: 300,
        payment_method: 'Cash', date_time: new Date(2026, 10, 3, 12, 17, 0).getTime(), received_by: 'u-maria', change_amount: 5 }
    ];

    return { orders: orders, payments: payments, todayCount: 12 };
  }

  /* ---------- state ---------- */
  var state = null;
  function freshState() {
    var users = seedUsers();
    var suppliers = seedSuppliers();
    var ingredients = seedIngredients();
    var defs = seedProductDefs();
    var products = buildProducts(defs);
    var prodIng = buildRecipes(defs);
    var costing = buildCosting(defs, ingredients);
    var seed = buildSeedOrders(products, prodIng, users);
    return {
      v: 5,
      last_prod_id: 16,
      last_ing_id: 7,
      last_tx_id: 9,
      users: users,
      suppliers: suppliers,
      ingredients: ingredients,
      stock_transactions: buildSeedTx(ingredients, users),
      products: products,
      product_ingredients: prodIng,
      product_costing: costing,
      orders: seed.orders,
      payments: seed.payments,
      last_line_no: 102,
      settings: {
        shopName: 'Gunita Kopi', receiptFooter: 'Salamat po! Come again.',
        queuePrefix: 'A', seq: seed.todayCount, seqDay: '20261103', autoLogoutMin: 5
      }
    };
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function dropProduct(s, pid) {
    var gone = function (r) { return r.product_id !== pid; };
    ['products', 'product_ingredients', 'product_costing'].forEach(function (k) {
      if (Array.isArray(s[k])) s[k] = s[k].filter(gone);
    });
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.v === 5 && s.products) {
          var t0 = Date.now() - 90 * 86400000;
          s.products.forEach(function (p, idx) {
            if (p.id_num == null) p.id_num = idx + 1;
            if (!p.date_created) p.date_created = t0;
            if (!p.created_by) p.created_by = 'u-owner';
          });
          dropProduct(s, 'p-cheese-bread');
          state = s;
          return;
        }
      }
    } catch (e) {}
    state = freshState();
    save();
  }
  load();
  function reloadFromStorage() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.v === 5) state = s; }
    } catch (e) {}
  }

  /* ---------- accessors ---------- */
  function prodById(id) { return state.products.filter(function (p) { return p.product_id === id; })[0]; }
  function ingById(id) { return state.ingredients.filter(function (i) { return i.ingredient_id === id; })[0]; }
  function userById(id) { return state.users.filter(function (u) { return u.user_id === id; })[0]; }
  function supplierById(id) { return state.suppliers.filter(function (s) { return s.supplier_id === id; })[0]; }
  function recipeOf(productId) { return state.product_ingredients.filter(function (r) { return r.product_id === productId; }); }
  function costingOf(productId) { return state.product_costing.filter(function (c) { return c.product_id === productId; })[0]; }

  function ingredientStatus(ing) {
    if (ing.status_label) {
      var isOut = ing.status_label.toLowerCase().indexOf('out') >= 0;
      var isLow = ing.status_label.toLowerCase().indexOf('low') >= 0;
      return { k: ing.status_k || (isOut ? 'out' : isLow ? 'low' : 'ok'), label: ing.status_label };
    }
    if (ing.current_stock <= 0) return { k: 'out', label: 'Out of Stock' };
    if (ing.current_stock <= ing.reorder_level) return { k: 'low', label: 'Low Stock' };
    return { k: 'ok', label: 'In Stock' };
  }
  function v_stock_status() {
    return state.ingredients.map(function (i) {
      var st = ingredientStatus(i);
      return { ingredient_id: i.ingredient_id, ingredient: i.ingredient_name, unit: i.unit,
        current_stock: i.current_stock, reorder_level: i.reorder_level, status: st.label, k: st.k };
    });
  }
  function lowStockItems() { return v_stock_status().filter(function (r) { return r.k !== 'ok'; }); }

  function productOrderable(p) {
    if (!p.is_available) return false;
    return recipeOf(p.product_id).every(function (r) {
      var ing = ingById(r.ingredient_id);
      return ing ? ing.current_stock >= r.quantity_needed : true;
    });
  }
  function recomputeCosting(productId) {
    var c = costingOf(productId);
    if (!c) {
      c = { costing_id: uid('c'), product_id: productId, ingredient_cost: 0, packaging_cost: 0, total_cost: 0, date_updated: Date.now() };
      state.product_costing.push(c);
    }
    var ic = recipeOf(productId).reduce(function (s, r) {
      var ing = ingById(r.ingredient_id);
      return s + r.quantity_needed * (ing ? ing.unit_cost : 0);
    }, 0);
    c.ingredient_cost = ic;
    c.total_cost = ic + c.packaging_cost;
    c.date_updated = Date.now();
    return c;
  }
  function recomputeAllCosting() { state.products.forEach(function (p) { recomputeCosting(p.product_id); }); }
  function margin(p) {
    var c = costingOf(p.product_id);
    var tc = c ? c.total_cost : 0;
    var m = p.price - tc;
    return { total_cost: tc, margin: m, pct: p.price ? m / p.price * 100 : 0 };
  }
  /* Add-ons applicable to a product; disabled when stock < add-on qty. */
  function addonsFor(p) {
    var hasBeans = recipeOf(p.product_id).some(function (r) { return r.ingredient_id === 'i-beans'; });
    return ADDONS.filter(function (a) {
      return a.cats.indexOf(p.category) >= 0 && (!a.needsBeans || hasBeans);
    }).map(function (a) {
      var ing = ingById(a.ingredient_id);
      var out = !ing || ing.current_stock < a.qty;
      return { ingredient_id: a.ingredient_id, label: a.label, qty: a.qty, price: a.price, out: out };
    });
  }

  /* ---------- orders (item-level rows) ---------- */
  function queueNo(orderId) {
    var parts = String(orderId).split('-'), last = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last.padStart(3, '0') : parts.slice(1).join('-');
  }
  function orderRows(orderId) { return state.orders.filter(function (o) { return o.order_id === orderId; }); }
  /* One row per order: meta + total. */
  function orderGroups() {
    var map = {}, list = [];
    state.orders.forEach(function (r) {
      var g = map[r.order_id];
      if (!g) {
        g = map[r.order_id] = { order_id: r.order_id, order_type: r.order_type, order_date: r.order_date,
          status: r.status, user_id: r.user_id, total: 0 };
        list.push(g);
      }
      g.total += r.quantity * r.unit_price;
    });
    return list;
  }
  function orderTotal(orderId) {
    return orderRows(orderId).reduce(function (s, r) { return s + r.quantity * r.unit_price; }, 0);
  }
  function paymentFor(orderId) { return state.payments.filter(function (p) { return p.order_id === orderId; })[0]; }
  /* Grouped lines: parent + its add-ons, with names and line totals. */
  function v_order_lines(orderId) {
    var rows = orderRows(orderId);
    var groups = [];
    rows.forEach(function (r) {
      if (r.is_addon) {
        var g = groups[groups.length - 1];
        if (g) g.addons.push(r);
      } else {
        groups.push({ row: r, addons: [], product: prodById(r.product_id), total: 0 });
      }
    });
    groups.forEach(function (g) {
      g.total = g.row.quantity * g.row.unit_price +
        g.addons.reduce(function (s, a) { return s + a.quantity * a.unit_price; }, 0);
      g.product_name = g.product ? g.product.product_name : g.row.product_id;
      g.addons.forEach(function (a) {
        var ing = ingById(a.ingredient_id);
        a.ingredient_name = ing ? ing.ingredient_name : a.ingredient_id;
        a.addon_label = (ADDONS.filter(function (x) { return x.ingredient_id === a.ingredient_id; })[0] || {}).label || a.ingredient_name;
      });
    });
    return groups;
  }
  /* Orders that have a payment and are not Cancelled = sales. */
  function v_sales() {
    return orderGroups().filter(function (g) {
      return g.status !== 'Cancelled' && !!paymentFor(g.order_id);
    }).sort(function (a, b) { return a.order_date - b.order_date; });
  }
  function v_daily_sales_report() {
    var by = {};
    v_sales().forEach(function (g) {
      var k = dayKey(g.order_date);
      var d = by[k] = by[k] || { date: k, orders: 0, sales: 0 };
      d.orders++; d.sales += g.total;
    });
    return Object.keys(by).sort().map(function (k) { return by[k]; });
  }
  function v_monthly_sales_report() {
    var by = {};
    v_sales().forEach(function (g) {
      var k = dayKey(g.order_date).slice(0, 7);
      var d = by[k] = by[k] || { month: k, orders: 0, sales: 0 };
      d.orders++; d.sales += g.total;
    });
    return Object.keys(by).sort().map(function (k) { return by[k]; });
  }
  function v_best_sellers(from, to) {
    var ok = {};
    v_sales().forEach(function (g) {
      var k = dayKey(g.order_date);
      if (k >= from && k <= to) ok[g.order_id] = 1;
    });
    var qty = {}, sales = {};
    state.orders.forEach(function (r) {
      if (r.is_addon || !ok[r.order_id]) return;
      var p = prodById(r.product_id);
      var name = p ? p.product_name : r.product_id;
      qty[name] = (qty[name] || 0) + r.quantity;
      sales[name] = (sales[name] || 0) + r.quantity * r.unit_price;
    });
    return Object.keys(qty).map(function (n) {
      return { product: n, qty: qty[n], sales: sales[n] };
    }).sort(function (a, b) { return b.qty - a.qty; });
  }

  function nextOrderId() {
    var dk = dayCompact(Date.now());
    if (state.settings.seqDay !== dk) { state.settings.seqDay = dk; state.settings.seq = 0; }
    state.settings.seq += 1;
    return dk + '-' + state.settings.queuePrefix + '-' + String(state.settings.seq).padStart(3, '0');
  }
  function touchIngredient(ing) { ing.date_updated = Date.now(); }
  /* Write one tx row and apply it to current_stock. type 'IN'|'OUT'. */
  function stockTx(ingredientId, userId, type, qty, remarks) {
    var ing = ingById(ingredientId);
    if (!ing) return null;
    if (type === 'OUT') ing.current_stock = Math.max(0, ing.current_stock - qty);
    else ing.current_stock += qty;
    touchIngredient(ing);
    state.last_tx_id = (state.last_tx_id || 9) + 1;
    var u = userById(userId);
    var tx = {
      stock_trans_id: uid('stx'),
      id_num: state.last_tx_id,
      ingredient_id: ingredientId,
      ingredient_name: ing.ingredient_name,
      unit: ing.unit,
      user_id: userId,
      by_name: u ? u.full_name : '',
      type: type,
      quantity: qty,
      remaining_stock: ing.current_stock,
      date_time: Date.now(),
      remarks: remarks || ''
    };
    state.stock_transactions.push(tx);
    return tx;
  }
  /* Order lines arg: [{product_id, quantity, unit_price, customization,
     special_instructions, addons:[{ingredient_id, unit_price}]}] */
  function placeOrder(o) {
    var orderId = nextOrderId();
    var ts = Date.now(), n = 0;
    state.last_line_no = state.last_line_no || 102;
    o.lines.forEach(function (l) {
      var lineNo = ++state.last_line_no;
      state.orders.push({ order_line_id: 'ol-' + lineNo, line_no: lineNo, order_id: orderId, user_id: o.user_id,
        order_type: o.order_type, order_date: ts, status: 'Pending', product_id: l.product_id,
        ingredient_id: null, is_addon: 0, quantity: l.quantity, unit_price: l.unit_price,
        customization: l.customization || '', special_instructions: l.special_instructions || '' });
      (l.addons || []).forEach(function (a) {
        var aLineNo = ++state.last_line_no;
        state.orders.push({ order_line_id: 'ol-' + aLineNo, line_no: aLineNo, order_id: orderId, user_id: o.user_id,
          order_type: o.order_type, order_date: ts, status: 'Pending', product_id: l.product_id,
          ingredient_id: a.ingredient_id, is_addon: 1, quantity: l.quantity, unit_price: a.unit_price,
          customization: '', special_instructions: '' });
      });
      // stock OUT: recipe × qty + add-on qty × line qty
      var need = {};
      recipeOf(l.product_id).forEach(function (r) { need[r.ingredient_id] = (need[r.ingredient_id] || 0) + r.quantity_needed * l.quantity; });
      (l.addons || []).forEach(function (a) {
        var cat = ADDONS.filter(function (x) { return x.ingredient_id === a.ingredient_id; })[0];
        var per = cat ? cat.qty : 1;
        need[a.ingredient_id] = (need[a.ingredient_id] || 0) + per * l.quantity;
      });
      Object.keys(need).forEach(function (ingId) { stockTx(ingId, o.user_id, 'OUT', need[ingId], 'Order ' + queueNo(orderId)); });
    });
    var total = orderTotal(orderId);
    var pay = { payment_id: uid('pay'), order_id: orderId, amount_paid: o.amount_paid,
      payment_method: o.payment_method, date_time: ts, received_by: o.user_id, change_amount: o.amount_paid - total };
    state.payments.push(pay);
    save();
    return { order_id: orderId, payment: pay, total: total };
  }
  function setOrderStatus(orderId, status) {
    orderRows(orderId).forEach(function (r) { r.status = status; });
    save();
  }
  function cancelOrder(orderId, userId) {
    var rows = orderRows(orderId);
    if (!rows.length || rows[0].status === 'Completed') return false;
    var restore = {};
    rows.forEach(function (r) {
      if (r.is_addon) {
        var cat = ADDONS.filter(function (x) { return x.ingredient_id === r.ingredient_id; })[0];
        restore[r.ingredient_id] = (restore[r.ingredient_id] || 0) + (cat ? cat.qty : 1) * r.quantity;
      } else {
        recipeOf(r.product_id).forEach(function (rc) {
          restore[rc.ingredient_id] = (restore[rc.ingredient_id] || 0) + rc.quantity_needed * r.quantity;
        });
      }
    });
    rows.forEach(function (r) { r.status = 'Cancelled'; });
    Object.keys(restore).forEach(function (ingId) { stockTx(ingId, userId, 'IN', restore[ingId], 'Cancelled ' + queueNo(orderId)); });
    save();
    return true;
  }

  /* ---------- session ---------- */
  function session() { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || 'null'); } catch (e) { return null; } }
  function currentUser() { var s = session(); return s ? userById(s.userId) : null; }
  function login(user) { sessionStorage.setItem(SS_KEY, JSON.stringify({ userId: user.user_id, loginAt: Date.now() })); }
  function logout() { sessionStorage.removeItem(SS_KEY); }

  /* ---------- toasts ---------- */
  function toast(msg, isErr) {
    var region = $('#toast-region');
    if (!region) return;
    var t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : '');
    t.innerHTML = (isErr ? ICONS.alert : ICONS.check) + '<span>' + esc(msg) + '</span>';
    region.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }

  /* ---------- modal / confirm ---------- */
  var lastFocus = null;
  function openModal(html, opts) {
    opts = opts || {};
    lastFocus = document.activeElement;
    var root = $('#modal-root');
    root.innerHTML =
      '<div class="modal-backdrop">' +
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.label || 'Dialog') + '">' +
      html + '</div></div>';
    var bd = root.firstElementChild;
    if (!opts.sticky) bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeModal(); });
    document.addEventListener('keydown', escHandler);
    var first = $('.modal input, .modal select, .modal textarea, .modal button:not(.close-x)');
    if (first) first.focus();
    return bd;
  }
  function escHandler(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    var r = $('#modal-root');
    if (r) r.innerHTML = '';
    document.removeEventListener('keydown', escHandler);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function modalTitle(t) {
    return '<h2>' + esc(t) + '<button type="button" class="close-x" aria-label="Close dialog" data-close>' + ICONS.x + '</button></h2>';
  }
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      openModal(modalTitle(opts.title || 'Please confirm') +
        '<div class="confirm-body">' + (opts.body || '') + '</div>' +
        '<div class="modal-actions"><button class="btn" data-no>Cancel</button>' +
        '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + esc(opts.okLabel || 'Confirm') + '</button></div>',
        { label: opts.title || 'Confirm' });
      $('[data-no]').addEventListener('click', function () { closeModal(); resolve(false); });
      $('[data-yes]').addEventListener('click', function () { closeModal(); resolve(true); });
      $('[data-close]').addEventListener('click', function () { resolve(false); });
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });

  /* ---------- offline banner ---------- */
  function offlineBanner() {
    var b = $('#offline-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'offline-banner';
      b.className = 'offline-banner';
      b.setAttribute('role', 'status');
      b.innerHTML = ICONS.wifiOff + '<span>Offline — orders are saved on this device</span>';
      document.body.prepend(b);
    }
    b.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', offlineBanner);
  window.addEventListener('offline', offlineBanner);

  /* ---------- exports ---------- */
  window.GKStore = {
    $: $, $$: $$, peso: peso, esc: esc, uid: uid, ICONS: ICONS,
    fmtTime: fmtTime, fmtDate: fmtDate, fmtDateTime: fmtDateTime, dayKey: dayKey, dayCompact: dayCompact,
    sameDay: sameDay, elapsed: elapsed,
    CATS: CATS, CAT_ICONS: CAT_ICONS, ADDONS: ADDONS,
    state: function () { return state; },
    save: save, reloadFromStorage: reloadFromStorage, LS_KEY: LS_KEY,
    prodById: prodById, ingById: ingById, userById: userById, supplierById: supplierById,
    recipeOf: recipeOf, costingOf: costingOf, recomputeCosting: recomputeCosting, recomputeAllCosting: recomputeAllCosting,
    margin: margin, ingredientStatus: ingredientStatus, productOrderable: productOrderable, addonsFor: addonsFor,
    queueNo: queueNo, orderRows: orderRows, orderGroups: orderGroups, orderTotal: orderTotal,
    paymentFor: paymentFor, v_order_lines: v_order_lines, v_sales: v_sales,
    v_daily_sales_report: v_daily_sales_report, v_monthly_sales_report: v_monthly_sales_report,
    v_best_sellers: v_best_sellers, v_stock_status: v_stock_status, lowStockItems: lowStockItems,
    placeOrder: placeOrder, setOrderStatus: setOrderStatus, cancelOrder: cancelOrder, stockTx: stockTx,
    session: session, currentUser: currentUser, login: login, logout: logout,
    toast: toast, openModal: openModal, closeModal: closeModal, modalTitle: modalTitle,
    confirmDialog: confirmDialog, offlineBanner: offlineBanner, seedData: freshState
  };
  document.addEventListener('DOMContentLoaded', offlineBanner);
})();
