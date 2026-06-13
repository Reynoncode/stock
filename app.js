// ============================================================
//  app.js  —  Navigation · Modal · Toast · Global init
// ============================================================

import {
  getDashboardStats,
  getSmartList,
  addCustomer, getCustomers, updateCustomer, deleteCustomer,
  addProduct,  getProducts,  updateProduct,  deleteProduct,
  addOrder,    getOrders,    updateOrderStatus, deleteOrder,
  addPayment
} from "./db.js";

// ─── Global state ───────────────────────────────────────────
window._customers = [];
window._products  = [];
window._orders    = [];
window._editingCustomerId = null;
window._editingProductId  = null;
window._editingOrderId    = null;
window._paymentCustomerId = null;

// ============================================================
//  NAVIGATION
// ============================================================
const pageTitles = {
  dashboard:    "İcmal",
  customers:    "Müştərilər",
  orders:       "Sifarişlər",
  stock:        "Stok",
  debts:        "Borclar",
  "smart-list": "Ağıllı Siyahı",
  reports:      "Hesabat / Export",
  settings:     "Parametrlər"
};

function navigateTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");

  document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add("active"));
  document.getElementById("topbarTitle").textContent = pageTitles[page] || page;

  if (page === "dashboard")    loadDashboard();
  if (page === "customers")    loadCustomers();
  if (page === "orders")       loadOrders();
  if (page === "stock")        loadStock();
  if (page === "debts")        loadDebts();
  if (page === "smart-list")   loadSmartList();
  if (page === "reports")      loadReports();
}

document.querySelectorAll("[data-page]").forEach(el => {
  el.addEventListener("click", e => {
    e.preventDefault();
    navigateTo(el.dataset.page);
    document.getElementById("sidebar").classList.remove("open");
  });
});

document.getElementById("sidebarToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("quickAddBtn").addEventListener("click", () => openOrderModal());

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, duration = 2800) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

// ============================================================
//  MODAL helpers
// ============================================================
function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll(".modal-close, [data-modal]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.modal;
    if (id) closeModal(id);
  });
});

document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// ============================================================
//  DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const stats = await getDashboardStats();

    document.getElementById("stat-customers").textContent = stats.customerCount;
    document.getElementById("stat-orders").textContent    = stats.activeOrders;
    document.getElementById("stat-debt").textContent      = stats.totalDebt.toFixed(2) + " ₼";
    document.getElementById("stat-stock").textContent     = stats.totalProducts;

    // Son sifarişlər
    const tbody = document.querySelector("#dash-orders-table tbody");
    if (stats.recentOrders.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Hələ sifariş yoxdur</td></tr>`;
    } else {
      tbody.innerHTML = stats.recentOrders.map(o => `
        <tr>
          <td><span class="customer-link" onclick="openCustomerProfile('${o.customerId}')">${o.customerName || "—"}</span></td>
          <td>${o.itemsSummary || "—"}</td>
          <td>${o.date || "—"}</td>
          <td><span class="badge ${statusBadge(o.status)}">${statusLabel(o.status)}</span></td>
        </tr>
      `).join("");
    }

    // Yüksək borclar
    const debtList = document.getElementById("dash-debts-list");
    if (stats.topDebtors.length === 0) {
      debtList.innerHTML = `<li class="empty-row">Məlumat yoxdur</li>`;
    } else {
      debtList.innerHTML = stats.topDebtors.map(c => `
        <li>
          <span class="customer-link" onclick="openCustomerProfile('${c.id}')">${c.name} ${c.surname || ""}</span>
          <span class="debt-amount">${(c.debt || 0).toFixed(2)} ₼</span>
        </li>
      `).join("");
    }

    // Ağıllı siyahı preview
    const smartList = await getSmartList();
    const smartEl   = document.getElementById("dash-smart-list");
    if (smartList.length === 0) {
      smartEl.innerHTML = `<li class="empty-row">Hələ məlumat yoxdur</li>`;
    } else {
      smartEl.innerHTML = smartList.slice(0, 5).map(c => `
        <li>
          <i class="ti ti-bell" style="color:var(--yellow)"></i>
          <span><strong>${c.name} ${c.surname || ""}</strong> — ${c.daysSinceOrder} gün öncə sifariş</span>
          <span class="badge badge-yellow">${speedLabel(c.lastOrderSpeed)}</span>
        </li>
      `).join("");
    }

  } catch(err) {
    console.error("Dashboard yüklənmədi:", err);
  }
}

// ============================================================
//  MÜŞTƏRİLƏR
// ============================================================
async function loadCustomers() {
  window._customers = await getCustomers();
  renderCustomers();
  populateRegionFilters();
}

function renderCustomers() {
  const search = (document.getElementById("customerSearch")?.value || "").toLowerCase();
  const region = document.getElementById("customerRegionFilter")?.value || "";
  const sortBy = document.getElementById("customerSortBy")?.value || "name";

  let list = [...window._customers];

  if (search) list = list.filter(c =>
    (`${c.name} ${c.surname} ${c.region} ${c.phone} ${c.business}`).toLowerCase().includes(search)
  );
  if (region) list = list.filter(c => c.region === region);

  list.sort((a, b) => {
    if (sortBy === "name")   return (`${a.name} ${a.surname||""}`).localeCompare(`${b.name} ${b.surname||""}`);
    if (sortBy === "region") return (a.region || "").localeCompare(b.region || "");
    if (sortBy === "debt")   return (b.debt || 0) - (a.debt || 0);
    return 0;
  });

  const tbody = document.querySelector("#customers-table tbody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Müştəri tapılmadı</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><span class="customer-link" onclick="openCustomerProfile('${c.id}')">${c.name} ${c.surname || ""}</span></td>
      <td>${c.phone || "—"}</td>
      <td>${c.region || "—"}</td>
      <td>${c.business || "—"}</td>
      <td class="${(c.debt||0) > 0 ? "debt-amount" : ""}">${(c.debt || 0).toFixed(2)} ₼</td>
      <td>${c.lastOrderDate || "—"}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editCustomer('${c.id}')">
          <i class="ti ti-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline" onclick="openPayment('${c.id}')" style="margin-left:4px">
          <i class="ti ti-wallet"></i>
        </button>
        <button class="btn btn-sm btn-ghost" onclick="removeCustomer('${c.id}')" style="color:var(--red);margin-left:4px">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

function populateRegionFilters() {
  const regions = [...new Set(window._customers.map(c => c.region).filter(Boolean))].sort();
  const opts = `<option value="">Bütün rayonlar</option>` +
    regions.map(r => `<option value="${r}">${r}</option>`).join("");

  ["customerRegionFilter", "smartRegionFilter", "exportRegionFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = opts;
    if (cur) el.value = cur;
  });
}

document.getElementById("customerSearch")?.addEventListener("input", renderCustomers);
document.getElementById("customerRegionFilter")?.addEventListener("change", renderCustomers);
document.getElementById("customerSortBy")?.addEventListener("change", renderCustomers);

document.getElementById("addCustomerBtn")?.addEventListener("click", () => {
  window._editingCustomerId = null;
  document.getElementById("customerModalTitle").textContent = "Yeni Müştəri";
  ["c-name","c-surname","c-phone","c-region","c-business","c-note"].forEach(id => {
    document.getElementById(id).value = "";
  });
  openModal("customerModal");
});

document.getElementById("saveCustomerBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("c-name").value.trim();
  if (!name) { showToast("Ad daxil edin"); return; }

  const data = {
    name,
    surname:  document.getElementById("c-surname").value.trim(),
    phone:    document.getElementById("c-phone").value.trim(),
    region:   document.getElementById("c-region").value.trim(),
    business: document.getElementById("c-business").value.trim(),
    note:     document.getElementById("c-note").value.trim()
  };

  try {
    if (window._editingCustomerId) {
      await updateCustomer(window._editingCustomerId, data);
      showToast("Müştəri yeniləndi ✓");
    } else {
      await addCustomer(data);
      showToast("Müştəri əlavə edildi ✓");
    }
    closeModal("customerModal");
    loadCustomers();
  } catch(e) {
    showToast("Xəta: " + e.message);
  }
});

window.editCustomer = (id) => {
  const c = window._customers.find(x => x.id === id);
  if (!c) return;
  window._editingCustomerId = id;
  document.getElementById("customerModalTitle").textContent = "Müştərini düzəlt";
  document.getElementById("c-name").value     = c.name || "";
  document.getElementById("c-surname").value  = c.surname || "";
  document.getElementById("c-phone").value    = c.phone || "";
  document.getElementById("c-region").value   = c.region || "";
  document.getElementById("c-business").value = c.business || "";
  document.getElementById("c-note").value     = c.note || "";
  openModal("customerModal");
};

window.removeCustomer = async (id) => {
  if (!confirm("Bu müştərini silmək istəyirsiniz?")) return;
  await deleteCustomer(id);
  showToast("Müştəri silindi");
  loadCustomers();
};

window.openPayment = (id) => {
  const c = window._customers.find(x => x.id === id);
  if (!c) return;
  window._paymentCustomerId = id;
  document.getElementById("pay-customer-name").value = `${c.name} ${c.surname || ""}`;
  document.getElementById("pay-current-debt").value  = (c.debt || 0).toFixed(2) + " ₼";
  document.getElementById("pay-amount").value        = "";
  document.getElementById("pay-note").value          = "";
  openModal("paymentModal");
};

document.getElementById("savePaymentBtn")?.addEventListener("click", async () => {
  const amount = parseFloat(document.getElementById("pay-amount").value);
  if (!amount || amount <= 0) { showToast("Məbləğ daxil edin"); return; }

  const data = {
    customerId: window._paymentCustomerId,
    type:       document.getElementById("pay-type").value,
    amount,
    note:       document.getElementById("pay-note").value.trim(),
    date:       new Date().toISOString().split("T")[0]
  };

  try {
    await addPayment(data);
    showToast("Ödəniş qeyd edildi ✓");
    closeModal("paymentModal");
    loadCustomers();
    loadDebts();
  } catch(e) {
    showToast("Xəta: " + e.message);
  }
});

// ============================================================
//  STOK
// ============================================================
async function loadStock() {
  window._products = await getProducts();
  renderStock();
}

function renderStock() {
  const search = (document.getElementById("stockSearch")?.value || "").toLowerCase();
  let list = [...window._products];
  if (search) list = list.filter(p =>
    (`${p.brand} ${p.type}`).toLowerCase().includes(search)
  );

  const tbody = document.querySelector("#stock-table tbody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Məhsul yoxdur</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td><strong>${p.brand}</strong></td>
      <td>${p.type || "—"}</td>
      <td>${p.volume || "—"} L</td>
      <td>${(p.price || 0).toFixed(2)} ₼</td>
      <td>
        <label class="toggle" title="${p.isActive !== false ? 'Aktiv' : 'Deaktiv'}">
          <input type="checkbox" ${p.isActive !== false ? "checked" : ""}
            onchange="toggleProductActive('${p.id}', this.checked)" />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">
          <i class="ti ti-edit"></i>
        </button>
        <button class="btn btn-sm btn-ghost" onclick="removeProduct('${p.id}')" style="color:var(--red);margin-left:4px">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("stockSearch")?.addEventListener("input", renderStock);

document.getElementById("addStockBtn")?.addEventListener("click", () => {
  window._editingProductId = null;
  document.getElementById("stockModalTitle").textContent = "Yeni Məhsul";
  ["s-brand","s-type","s-volume","s-price"].forEach(id => {
    document.getElementById(id).value = "";
  });
  const activeEl = document.getElementById("s-isActive");
  if (activeEl) activeEl.checked = true;
  const labelEl = document.getElementById("s-isActive-label");
  if (labelEl) labelEl.textContent = "Aktiv";
  openModal("stockModal");
});

document.getElementById("s-isActive")?.addEventListener("change", function() {
  document.getElementById("s-isActive-label").textContent = this.checked ? "Aktiv" : "Deaktiv";
});

document.getElementById("saveStockBtn")?.addEventListener("click", async () => {
  const brand = document.getElementById("s-brand").value.trim();
  if (!brand) { showToast("Marka daxil edin"); return; }

  const data = {
    brand,
    type:     document.getElementById("s-type").value.trim(),
    volume:   parseFloat(document.getElementById("s-volume").value) || 0,
    price:    parseFloat(document.getElementById("s-price").value) || 0,
    isActive: document.getElementById("s-isActive").checked
  };

  try {
    if (window._editingProductId) {
      await updateProduct(window._editingProductId, data);
      showToast("Məhsul yeniləndi ✓");
    } else {
      await addProduct(data);
      showToast("Məhsul əlavə edildi ✓");
    }
    closeModal("stockModal");
    loadStock();
  } catch(e) {
    showToast("Xəta: " + e.message);
  }
});

window.toggleProductActive = async (id, isActive) => {
  await updateProduct(id, { isActive });
  showToast(isActive ? "Məhsul aktivləşdirildi ✓" : "Məhsul deaktiv edildi");
  loadStock();
};

window.editProduct = (id) => {
  const p = window._products.find(x => x.id === id);
  if (!p) return;
  window._editingProductId = id;
  document.getElementById("stockModalTitle").textContent = "Məhsulu düzəlt";
  document.getElementById("s-brand").value  = p.brand || "";
  document.getElementById("s-type").value   = p.type || "";
  document.getElementById("s-volume").value = p.volume || "";
  document.getElementById("s-price").value  = p.price || "";
  document.getElementById("s-isActive").checked = p.isActive !== false;
  document.getElementById("s-isActive-label").textContent = p.isActive !== false ? "Aktiv" : "Deaktiv";
  openModal("stockModal");
};

window.removeProduct = async (id) => {
  if (!confirm("Bu məhsulu silmək istəyirsiniz?")) return;
  await deleteProduct(id);
  showToast("Məhsul silindi");
  loadStock();
};

// ============================================================
//  SİFARİŞLƏR
// ============================================================
async function loadOrders() {
  window._orders = await getOrders();
  renderOrders();
}

function renderOrders() {
  const search = (document.getElementById("orderSearch")?.value || "").toLowerCase();
  const status = document.getElementById("orderStatusFilter")?.value || "";

  let list = [...window._orders];
  if (search) list = list.filter(o =>
    (`${o.customerName} ${o.itemsSummary}`).toLowerCase().includes(search)
  );
  if (status) list = list.filter(o => o.status === status);

  const tbody = document.querySelector("#orders-table tbody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Sifariş tapılmadı</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td><span class="customer-link" onclick="openCustomerProfile('${o.customerId}')">${o.customerName || "—"}</span></td>
      <td>${o.itemsSummary || "—"}</td>
      <td>${o.totalQty ? o.totalQty + " L" : "—"}</td>
      <td>
        <div>${(o.total || 0).toFixed(2)} ₼</div>
        ${o.paidAmount > 0 ? `<small style="color:var(--green)">+${o.paidAmount.toFixed(2)} ₼ ödənilib</small>` : ""}
        ${o.status === "partial" ? `<small style="color:var(--red)">${Math.max(0,(o.total||0)-(o.paidAmount||0)).toFixed(2)} ₼ qalıq</small>` : ""}
      </td>
      <td>${o.date || "—"}</td>
      <td><span class="badge ${statusBadge(o.status)}">${statusLabel(o.status)}</span></td>
      <td>
        <select class="status-change-sel" onchange="changeOrderStatus('${o.id}', this.value)" style="font-size:12px;padding:4px 6px">
          <option value="">Status dəyiş...</option>
          <option value="pending">Alındı</option>
          <option value="paid">Ödənilib</option>
          <option value="partial">Qismən</option>
          <option value="delivered">Çatdırıldı</option>
          <option value="debt">Borcludur</option>
        </select>
        <button class="btn btn-sm btn-ghost" onclick="removeOrder('${o.id}')" style="color:var(--red);margin-left:4px">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("orderSearch")?.addEventListener("input", renderOrders);
document.getElementById("orderStatusFilter")?.addEventListener("change", renderOrders);
document.getElementById("addOrderBtn")?.addEventListener("click", () => openOrderModal());

window.changeOrderStatus = async (id, newStatus) => {
  if (!newStatus) return;
  await updateOrderStatus(id, newStatus);
  showToast("Status yeniləndi ✓");
  loadOrders();
  loadDashboard();
};

window.removeOrder = async (id) => {
  if (!confirm("Bu sifarişi silmək istəyirsiniz?")) return;
  await deleteOrder(id);
  showToast("Sifariş silindi");
  loadOrders();
  loadDashboard();
};

// ─── Sifariş modal ──────────────────────────────────────────
function openOrderModal() {
  window._editingOrderId = null;
  document.getElementById("orderModalTitle").textContent = "Yeni Sifariş";

  const sel = document.getElementById("o-customer");
  sel.innerHTML = `<option value="">Müştəri seç...</option>` +
    window._customers.map(c =>
      `<option value="${c.id}">${c.name} ${c.surname || ""} — ${c.region || ""}</option>`
    ).join("");

  document.getElementById("o-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("orderItems").innerHTML = "";
  addOrderItemRow();
  updateOrderTotal();
  document.getElementById("o-status").value = "pending";
  document.getElementById("o-speed").value  = "medium";
  document.getElementById("o-note").value   = "";

  // Ödəniş detail sətirini sıfırla
  const payRow = document.getElementById("paymentDetailRow");
  if (payRow) payRow.style.display = "none";
  const paidAmountEl = document.getElementById("o-paid-amount");
  const payNoteEl    = document.getElementById("o-payment-note");
  if (paidAmountEl) paidAmountEl.value = "";
  if (payNoteEl)    payNoteEl.value    = "";

  // Status dəyişdikdə ödəniş sətirini göstər/gizlət
  const oStatus = document.getElementById("o-status");
  oStatus.onchange = () => {
    if (payRow) {
      payRow.style.display = ["partial", "paid"].includes(oStatus.value) ? "flex" : "none";
    }
  };

  openModal("orderModal");
}

function addOrderItemRow() {
  const container = document.getElementById("orderItems");
  const idx = container.children.length;

  // Yalnız aktiv məhsullar
  const productOptions = window._products
    .filter(p => p.isActive !== false)
    .map(p =>
      `<option value="${p.id}" data-price="${p.price}" data-volume="${p.volume}">${p.brand} ${p.type || ""} ${p.volume}L — ${p.price} ₼</option>`
    ).join("");

  const row = document.createElement("div");
  row.className = "order-item-row";
  row.dataset.index = idx;
  row.innerHTML = `
    <div class="form-group flex-2">
      <label>Məhsul</label>
      <select class="o-product" data-index="${idx}">
        <option value="">Məhsul seç...</option>
        ${productOptions}
      </select>
    </div>
    <div class="form-group flex-1">
      <label>Miqdar (ədəd)</label>
      <input type="number" class="o-qty" data-index="${idx}" placeholder="0" min="1" value="1" />
    </div>
    <div class="form-group flex-1">
      <label>Qiymət (₼)</label>
      <input type="text" class="o-line-price" data-index="${idx}" placeholder="0.00" readonly />
    </div>
    <button class="btn-remove-item" onclick="this.parentElement.remove(); updateOrderTotal()">
      <i class="ti ti-trash"></i>
    </button>
  `;

  row.querySelector(".o-product").addEventListener("change", function() {
    const opt   = this.options[this.selectedIndex];
    const price = parseFloat(opt.dataset.price) || 0;
    const qty   = parseFloat(row.querySelector(".o-qty").value) || 1;
    row.querySelector(".o-line-price").value = (price * qty).toFixed(2);
    updateOrderTotal();
  });

  row.querySelector(".o-qty").addEventListener("input", function() {
    const sel   = row.querySelector(".o-product");
    const opt   = sel.options[sel.selectedIndex];
    const price = parseFloat(opt?.dataset.price) || 0;
    row.querySelector(".o-line-price").value = (price * (parseFloat(this.value) || 0)).toFixed(2);
    updateOrderTotal();
  });

  container.appendChild(row);
}

window.updateOrderTotal = function() {
  let total = 0;
  document.querySelectorAll(".o-line-price").forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  document.getElementById("o-total").textContent = total.toFixed(2) + " ₼";
};

document.getElementById("addOrderItemBtn")?.addEventListener("click", addOrderItemRow);

document.getElementById("saveOrderBtn")?.addEventListener("click", async () => {
  const customerId = document.getElementById("o-customer").value;
  const date       = document.getElementById("o-date").value;
  if (!customerId) { showToast("Müştəri seçin"); return; }
  if (!date)       { showToast("Tarix daxil edin"); return; }

  const items = [];
  let totalQty = 0;
  document.querySelectorAll(".order-item-row").forEach(row => {
    const sel   = row.querySelector(".o-product");
    const pid   = sel?.value;
    const qty   = parseFloat(row.querySelector(".o-qty")?.value) || 0;
    const price = parseFloat(row.querySelector(".o-line-price")?.value) || 0;
    if (pid && qty > 0) {
      const p = window._products.find(x => x.id === pid);
      const vol = (p?.volume || 0) * qty;
      totalQty += vol;
      items.push({
        productId:   pid,
        productName: `${p?.brand} ${p?.type || ""} ${p?.volume}L`,
        qty,
        volume:      vol,
        price
      });
    }
  });

  if (items.length === 0) { showToast("Ən azı 1 məhsul seçin"); return; }

  const customer     = window._customers.find(c => c.id === customerId);
  const total        = items.reduce((s, i) => s + i.price, 0);
  const itemsSummary = items.map(i => `${i.productName} x${i.qty}`).join(", ");
  const status       = document.getElementById("o-status").value;
  const paidAmount   = parseFloat(document.getElementById("o-paid-amount")?.value) || 0;
  const paymentNote  = document.getElementById("o-payment-note")?.value.trim() || "";

  // Qismən ödənişdə məbləğ yoxlanışı
  if (status === "partial" && paidAmount <= 0) {
    showToast("Ödənilən məbləği daxil edin"); return;
  }
  if (status === "partial" && paidAmount >= total) {
    showToast("Qismən ödənişdə məbləğ ümumi məbləğdən az olmalıdır"); return;
  }

  const data = {
    customerId,
    customerName: `${customer?.name} ${customer?.surname || ""}`,
    date,
    items,
    itemsSummary,
    total,
    totalQty,
    status,
    speed:        document.getElementById("o-speed").value,
    note:         document.getElementById("o-note").value.trim(),
    paidAmount:   ["partial","paid"].includes(status) ? paidAmount : 0,
    paymentNote
  };

  try {
    await addOrder(data);
    showToast("Sifariş əlavə edildi ✓");
    closeModal("orderModal");
    loadOrders();
    loadDashboard();
  } catch(e) {
    showToast("Xəta: " + e.message);
  }
});

// ============================================================
//  BORCLAR
// ============================================================
async function loadDebts() {
  const customers = window._customers.length ? window._customers : await getCustomers();
  const orders    = window._orders.length    ? window._orders    : await getOrders();

  // Filterlər
  const region     = document.getElementById("debtRegionFilter")?.value    || "";
  const customerId = document.getElementById("debtCustomerFilter")?.value  || "";
  const productF   = document.getElementById("debtProductFilter")?.value   || "";
  const dateFrom   = document.getElementById("debtDateFrom")?.value        || "";
  const dateTo     = document.getElementById("debtDateTo")?.value          || "";

  // Filter dropdownları doldur
  _populateDebtFilters(customers, orders);

  // Sifarişləri filtrele
  let filteredOrders = [...orders];
  if (dateFrom)   filteredOrders = filteredOrders.filter(o => o.date >= dateFrom);
  if (dateTo)     filteredOrders = filteredOrders.filter(o => o.date <= dateTo);
  if (productF)   filteredOrders = filteredOrders.filter(o =>
    (o.items || []).some(i => i.productId === productF)
  );
  if (customerId) filteredOrders = filteredOrders.filter(o => o.customerId === customerId);
  if (region)     filteredOrders = filteredOrders.filter(o => {
    const c = customers.find(x => x.id === o.customerId);
    return c?.region === region;
  });

  // Qazanc hesabla
  const totalSales = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalDebtFromOrders = filteredOrders
    .filter(o => ["debt", "partial"].includes(o.status))
    .reduce((s, o) => {
      if (o.status === "debt")    return s + (o.total || 0);
      if (o.status === "partial") return s + Math.max(0, (o.total || 0) - (o.paidAmount || 0));
      return s;
    }, 0);
  const totalCollected = totalSales - totalDebtFromOrders;

  const earnTotal     = document.getElementById("earn-total");
  const earnCollected = document.getElementById("earn-collected");
  const earnDebt      = document.getElementById("earn-debt");
  if (earnTotal)     earnTotal.textContent     = totalSales.toFixed(2) + " ₼";
  if (earnCollected) earnCollected.textContent = totalCollected.toFixed(2) + " ₼";
  if (earnDebt)      earnDebt.textContent      = totalDebtFromOrders.toFixed(2) + " ₼";

  // Müştəri borc siyahısı
  let list = customers.filter(c => (c.debt || 0) > 0 || (c.deposit || 0) > 0);
  if (region)     list = list.filter(c => c.region === region);
  if (customerId) list = list.filter(c => c.id === customerId);
  list.sort((a, b) => (b.debt || 0) - (a.debt || 0));

  // Ümumi stat kartları
  const allDebt    = customers.reduce((s, c) => s + (c.debt || 0), 0);
  const allDeposit = customers.reduce((s, c) => s + (c.deposit || 0), 0);
  const totalDebtEl    = document.getElementById("total-debt-val");
  const totalDepositEl = document.getElementById("total-deposit-val");
  if (totalDebtEl)    totalDebtEl.textContent    = allDebt.toFixed(2) + " ₼";
  if (totalDepositEl) totalDepositEl.textContent = allDeposit.toFixed(2) + " ₼";

  const tbody = document.querySelector("#debts-table tbody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Borc / depozit yoxdur</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const debt    = c.debt || 0;
    const deposit = c.deposit || 0;
    const balance = deposit - debt;
    return `
    <tr>
      <td>
        <span class="customer-link" onclick="openCustomerProfile('${c.id}')">${c.name} ${c.surname || ""}</span><br>
        <small style="color:var(--gray-50)">${c.phone || ""}</small>
      </td>
      <td>${c.region || "—"}</td>
      <td class="${debt > 0 ? "debt-amount" : ""}">${debt.toFixed(2)} ₼</td>
      <td style="color:var(--green)">${deposit.toFixed(2)} ₼</td>
      <td class="${balance < 0 ? "debt-amount" : ""}" style="${balance >= 0 ? "color:var(--green)" : ""}">
        ${balance.toFixed(2)} ₼
      </td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openPayment('${c.id}')">
          <i class="ti ti-wallet"></i> Ödəniş
        </button>
      </td>
    </tr>
  `}).join("");
}

// Filter dropdownlarını doldur (təkrar doldurmamaq üçün yoxlama)
function _populateDebtFilters(customers, orders) {
  // Rayon
  const regionEl = document.getElementById("debtRegionFilter");
  if (regionEl && regionEl.options.length <= 1) {
    const regions = [...new Set(customers.map(c => c.region).filter(Boolean))].sort();
    regions.forEach(r => {
      const o = document.createElement("option");
      o.value = r; o.textContent = r;
      regionEl.appendChild(o);
    });
  }

  // Müştəri
  const custEl = document.getElementById("debtCustomerFilter");
  if (custEl && custEl.options.length <= 1) {
    customers.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.name} ${c.surname || ""}`;
      custEl.appendChild(o);
    });
  }

  // Məhsul
  const prodEl = document.getElementById("debtProductFilter");
  if (prodEl && prodEl.options.length <= 1) {
    window._products.forEach(p => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.brand} ${p.type || ""} ${p.volume}L`;
      prodEl.appendChild(o);
    });
  }
}

// Filter event listener-ləri
["debtRegionFilter","debtCustomerFilter","debtProductFilter",
 "debtDateFrom","debtDateTo"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", loadDebts);
});

document.getElementById("debtFilterReset")?.addEventListener("click", () => {
  ["debtDateFrom","debtDateTo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["debtRegionFilter","debtCustomerFilter","debtProductFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  // Dropdown-ları sıfırla ki yenidən dolsun
  ["debtRegionFilter","debtCustomerFilter","debtProductFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">${
      id === "debtRegionFilter"   ? "Bütün rayonlar"   :
      id === "debtCustomerFilter" ? "Bütün müştərilər" :
                                    "Bütün məhsullar"
    }</option>`;
  });
  loadDebts();
});

// ============================================================
//  AĞILLI SİYAHI
// ============================================================
async function loadSmartList() {
  const allList  = await getSmartList();
  const regionF  = document.getElementById("smartRegionFilter")?.value || "";
  const speedF   = document.getElementById("smartSpeedFilter")?.value || "";

  let list = [...allList];
  if (regionF) list = list.filter(c => c.region === regionF);
  if (speedF)  list = list.filter(c => (c.lastOrderSpeed || "medium") === speedF);

  const countEl = document.getElementById("smart-count");
  if (countEl) countEl.textContent = list.length + " müştəri";

  const tbody = document.querySelector("#smart-table tbody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Hələ məlumat yoxdur</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const speed    = c.lastOrderSpeed || "medium";
    const thresh   = { fast: 7, medium: 14, slow: 21 }[speed];
    const pct      = Math.min(100, Math.round((c.daysSinceOrder / thresh) * 100));
    const urgency  = pct >= 100 ? "badge-red" : pct >= 80 ? "badge-yellow" : "badge-green";
    const urgLabel = pct >= 100 ? "Təcili" : pct >= 80 ? "Yaxın" : "Normal";

    return `
    <tr>
      <td>
        <span class="customer-link" onclick="openCustomerProfile('${c.id}')">${c.name} ${c.surname || ""}</span><br>
        <small style="color:var(--gray-50)">${c.phone || ""}</small>
      </td>
      <td>${c.region || "—"}</td>
      <td>${c.lastProduct || "—"}</td>
      <td>${c.lastOrderDate || "—"}<br><small style="color:var(--gray-50)">${c.daysSinceOrder} gün öncə</small></td>
      <td><span class="badge badge-gray">${speedLabel(speed)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="background:var(--gray-10);border-radius:4px;height:6px;width:60px;overflow:hidden">
            <div style="background:${pct>=100?"var(--red)":pct>=80?"var(--yellow)":"var(--green)"};height:100%;width:${pct}%"></div>
          </div>
          <span class="badge ${urgency}">${urgLabel} ${pct}%</span>
        </div>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openOrderModalForCustomer('${c.id}')">
          <i class="ti ti-plus"></i> Sifariş
        </button>
        <a href="https://wa.me/${(c.phone||"").replace(/\D/g,"")}" target="_blank" class="btn btn-sm btn-outline" style="margin-left:4px">
          <i class="ti ti-brand-whatsapp"></i>
        </a>
      </td>
    </tr>
  `}).join("");
}

document.getElementById("smartRegionFilter")?.addEventListener("change", loadSmartList);
document.getElementById("smartSpeedFilter")?.addEventListener("change", loadSmartList);

document.getElementById("exportSmartListBtn")?.addEventListener("click", () => {
  showToast("Export funksiyası tezliklə əlavə olunacaq");
});

window.openOrderModalForCustomer = (customerId) => {
  openOrderModal();
  setTimeout(() => {
    const sel = document.getElementById("o-customer");
    if (sel) sel.value = customerId;
  }, 50);
};

// ============================================================
//  HESABAT / EXPORT
// ============================================================
function loadReports() {
  populateRegionFilters();

  const exportRegionEl = document.getElementById("exportRegionFilter");
  if (exportRegionEl) {
    const regions = [...new Set(window._customers.map(c => c.region).filter(Boolean))].sort();
    exportRegionEl.innerHTML = `<option value="">Bütün rayonlar</option>` +
      regions.map(r => `<option value="${r}">${r}</option>`).join("");
  }

  const fromEl = document.getElementById("reportDateFrom");
  const toEl   = document.getElementById("reportDateTo");
  const today  = new Date().toISOString().split("T")[0];
  if (fromEl && !fromEl.value) {
    const d = new Date(); d.setMonth(d.getMonth()-1);
    fromEl.value = d.toISOString().split("T")[0];
  }
  if (toEl && !toEl.value) toEl.value = today;
}

document.getElementById("exportCustomersDocx")?.addEventListener("click", () => {
  if (window.exportCustomersDocx) window.exportCustomersDocx();
  else showToast("export.js hələ yüklənməyib");
});
document.getElementById("exportCustomersExcel")?.addEventListener("click", () => {
  if (window.exportCustomersExcel) window.exportCustomersExcel();
  else showToast("export.js hələ yüklənməyib");
});
document.getElementById("exportDebtsDocx")?.addEventListener("click", () => {
  if (window.exportDebtsDocx) window.exportDebtsDocx();
  else showToast("export.js hələ yüklənməyib");
});
document.getElementById("exportDebtsExcel")?.addEventListener("click", () => {
  if (window.exportDebtsExcel) window.exportDebtsExcel();
  else showToast("export.js hələ yüklənməyib");
});
document.getElementById("exportOrdersExcel")?.addEventListener("click", () => {
  if (window.exportOrdersExcel) window.exportOrdersExcel();
  else showToast("export.js hələ yüklənməyib");
});

// ============================================================
//  KÖMƏKÇI FUNKSİYALAR
// ============================================================
function statusBadge(s) {
  return {
    pending:   "badge-yellow",
    delivered: "badge-green",
    paid:      "badge-green",
    partial:   "badge-blue",
    debt:      "badge-red",
    deposit:   "badge-blue"
  }[s] || "badge-gray";
}

function statusLabel(s) {
  return {
    pending:   "Alındı",
    delivered: "Çatdırıldı",
    paid:      "Ödənilib",
    partial:   "Qismən",
    debt:      "Borcludur",
    deposit:   "Depozit"
  }[s] || s;
}

function speedLabel(s) {
  return { fast: "Sürətli", medium: "Orta", slow: "Yavaş" }[s] || "Orta";
}

// ============================================================
//  MÜŞTƏRİ PROFİL MODAL
// ============================================================
window.openCustomerProfile = function(customerId) {
  const c = window._customers.find(x => x.id === customerId);
  if (!c) return;

  document.getElementById("profileModalName").textContent = `${c.name} ${c.surname || ""}`;

  // Tab-ları sıfırla
  document.querySelectorAll(".profile-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".profile-tab-content").forEach(t => t.classList.remove("active"));
  document.querySelector(".profile-tab[data-tab='info']").classList.add("active");
  document.getElementById("profileTab-info").classList.add("active");

  // Müştəriyə aid sifarişlər
  const custOrders = (window._orders || [])
    .filter(o => o.customerId === customerId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const activeOrders = custOrders.filter(o => !["delivered","paid"].includes(o.status));

  const phone      = c.phone || "";
  const phoneClean = phone.replace(/\D/g, "");

  const orderCardsHtml = activeOrders.slice(0, 3).map(o => `
    <div class="profile-order-card">
      <div class="profile-order-card-top">
        <span><strong>${o.date || "—"}</strong></span>
        <span class="badge ${statusBadge(o.status)}">${statusLabel(o.status)}</span>
      </div>
      <div class="profile-order-card-desc">${o.itemsSummary || "—"}</div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--gray-70)">
        <span>${o.totalQty ? o.totalQty + " L" : ""}</span>
        <strong>${(o.total || 0).toFixed(2)} ₼</strong>
      </div>
      ${o.paidAmount > 0 ? `<div style="font-size:11px;color:var(--green);margin-top:2px">+${o.paidAmount.toFixed(2)} ₼ ödənilib</div>` : ""}
    </div>
  `).join("");

  const moreNote = activeOrders.length > 3
    ? `<p class="profile-more-note">+${activeOrders.length - 3} sifariş daha var — Sifarişlər bölümündən baxın</p>`
    : "";

  document.getElementById("profileTab-info").innerHTML = `
    <div class="profile-info-grid">
      <div class="profile-info-item">
        <span class="profile-info-label">Telefon</span>
        <span class="profile-info-value">${phone || "—"}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">Rayon</span>
        <span class="profile-info-value">${c.region || "—"}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">Obyekt</span>
        <span class="profile-info-value">${c.business || "—"}</span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">Borc</span>
        <span class="profile-info-value" style="color:${(c.debt||0)>0?"var(--red)":"var(--green)"}">
          ${(c.debt || 0).toFixed(2)} ₼
        </span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">Depozit</span>
        <span class="profile-info-value" style="color:var(--green)">
          ${(c.deposit || 0).toFixed(2)} ₼
        </span>
      </div>
      <div class="profile-info-item">
        <span class="profile-info-label">Son sifariş</span>
        <span class="profile-info-value">${c.lastOrderDate || "—"}</span>
      </div>
    </div>

    ${phone ? `
    <div class="profile-actions">
      <a href="tel:${phoneClean}">
        <i class="ti ti-phone"></i> Zəng et
      </a>
      <a href="https://wa.me/${phoneClean}" target="_blank" class="whatsapp">
        <i class="ti ti-brand-whatsapp"></i> WhatsApp
      </a>
    </div>` : ""}

    ${activeOrders.length > 0 ? `
      <div class="profile-orders-title">Aktiv sifarişlər (${activeOrders.length})</div>
      ${orderCardsHtml}
      ${moreNote}
    ` : `<p style="color:var(--gray-50);font-size:13px">Aktiv sifariş yoxdur</p>`}

    ${c.note ? `
      <div style="margin-top:12px;padding:10px;background:var(--gray-05);border-radius:var(--radius);font-size:13px;color:var(--gray-70)">
        <i class="ti ti-note"></i> ${c.note}
      </div>` : ""}
  `;

  // Tab 2: Sifariş tarixi
  document.getElementById("profileTab-history").innerHTML = custOrders.length === 0
    ? `<p style="color:var(--gray-50);font-size:13px;padding:8px 0">Hələ sifariş yoxdur</p>`
    : custOrders.map(o => `
        <div class="profile-order-card">
          <div class="profile-order-card-top">
            <span><strong>${o.date || "—"}</strong></span>
            <span class="badge ${statusBadge(o.status)}">${statusLabel(o.status)}</span>
          </div>
          <div class="profile-order-card-desc">${o.itemsSummary || "—"}</div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--gray-70)">
            <span>${o.totalQty ? o.totalQty + " L" : ""}</span>
            <strong>${(o.total || 0).toFixed(2)} ₼</strong>
          </div>
          ${o.paidAmount > 0 ? `<div style="font-size:11px;color:var(--green);margin-top:2px">+${o.paidAmount.toFixed(2)} ₼ ödənilib</div>` : ""}
          ${o.status === "partial" ? `<div style="font-size:11px;color:var(--red);margin-top:2px">${Math.max(0,(o.total||0)-(o.paidAmount||0)).toFixed(2)} ₼ qalıq borc</div>` : ""}
        </div>
      `).join("");

  openModal("customerProfileModal");
};

// Tab keçidi
document.querySelectorAll(".profile-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".profile-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".profile-tab-content").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("profileTab-" + tab.dataset.tab).classList.add("active");
  });
});

// ============================================================
//  INIT
// ============================================================
async function init() {
  try {
    [window._customers, window._products, window._orders] = await Promise.all([
      getCustomers(),
      getProducts(),
      getOrders()
    ]);
  } catch(e) {
    console.error("İlkin yükləmə xətası:", e);
    showToast("Firebase bağlantısı yoxlanılır...");
  }
  navigateTo("dashboard");
}

window.__initApp = init;
document.dispatchEvent(new Event("app:ready"));
