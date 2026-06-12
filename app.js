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
  dashboard:  "İcmal",
  customers:  "Müştərilər",
  orders:     "Sifarişlər",
  stock:      "Stok",
  debts:      "Borclar",
  "smart-list": "Ağıllı Siyahı",
  reports:    "Hesabat / Export",
  settings:   "Parametrlər"
};

function navigateTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");

  document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add("active"));
  document.getElementById("topbarTitle").textContent = pageTitles[page] || page;

  // Hər səhifə yükləndikdə məlumatları refresh et
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
    // Mobile sidebar bağla
    document.getElementById("sidebar").classList.remove("open");
  });
});

// Sidebar toggle (mobile)
document.getElementById("sidebarToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// Topbar "Yeni Sifariş" düyməsi
document.getElementById("quickAddBtn").addEventListener("click", () => openOrderModal());

// ============================================================
//  TOAST
// ============================================================
export function showToast(msg, duration = 2800) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

// ============================================================
//  MODAL helpers
// ============================================================
export function openModal(id)  { document.getElementById(id).classList.add("open"); }
export function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll(".modal-close, [data-modal]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.modal;
    if (id) closeModal(id);
  });
});

// Overlay-ə klikdə bağla
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
          <td>${o.customerName || "—"}</td>
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
          <span>${c.name} ${c.surname || ""}</span>
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
  populateRegionFilter();
}

function renderCustomers() {
  const search  = (document.getElementById("customerSearch")?.value || "").toLowerCase();
  const region  = document.getElementById("customerRegionFilter")?.value || "";
  const sortBy  = document.getElementById("customerSortBy")?.value || "name";

  let list = [...window._customers];

  if (search) list = list.filter(c =>
    (`${c.name} ${c.surname} ${c.region} ${c.phone} ${c.business}`).toLowerCase().includes(search)
  );
  if (region) list = list.filter(c => c.region === region);

  list.sort((a, b) => {
    if (sortBy === "name")   return (`${a.name} ${a.surname}`).localeCompare(`${b.name} ${b.surname}`);
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
      <td><strong>${c.name} ${c.surname || ""}</strong></td>
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

function populateRegionFilter() {
  const sel    = document.getElementById("customerRegionFilter");
  const cur    = sel.value;
  const regions = [...new Set(window._customers.map(c => c.region).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">Bütün rayonlar</option>` +
    regions.map(r => `<option value="${r}" ${r === cur ? "selected" : ""}>${r}</option>`).join("");
}

// Search / filter / sort listeners
document.getElementById("customerSearch")?.addEventListener("input", renderCustomers);
document.getElementById("customerRegionFilter")?.addEventListener("change", renderCustomers);
document.getElementById("customerSortBy")?.addEventListener("change", renderCustomers);

// Müştəri əlavə et düyməsi
document.getElementById("addCustomerBtn")?.addEventListener("click", () => {
  window._editingCustomerId = null;
  document.getElementById("customerModalTitle").textContent = "Yeni Müştəri";
  ["c-name","c-surname","c-phone","c-region","c-business","c-note"].forEach(id => {
    document.getElementById(id).value = "";
  });
  openModal("customerModal");
});

// Müştəri saxla
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

// Global funksiyalar (onclick üçün)
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
  document.getElementById("pay-customer-name").value  = `${c.name} ${c.surname || ""}`;
  document.getElementById("pay-current-debt").value   = (c.debt || 0).toFixed(2) + " ₼";
  document.getElementById("pay-amount").value         = "";
  document.getElementById("pay-note").value           = "";
  openModal("paymentModal");
};

// Ödəniş saxla
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
  const tbody = document.querySelector("#stock-table tbody");
  if (!tbody) return;

  if (window._products.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Məhsul yoxdur</td></tr>`;
    return;
  }

  tbody.innerHTML = window._products.map(p => `
    <tr>
      <td><strong>${p.brand}</strong></td>
      <td>${p.type || "—"}</td>
      <td>${p.volume || "—"} L</td>
      <td>${(p.price || 0).toFixed(2)} ₼</td>
      <td>${p.qty || 0} ədəd</td>
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

document.getElementById("addStockBtn")?.addEventListener("click", () => {
  window._editingProductId = null;
  document.getElementById("stockModalTitle").textContent = "Yeni Məhsul";
  ["s-brand","s-type","s-volume","s-price","s-qty"].forEach(id => {
    document.getElementById(id).value = "";
  });
  openModal("stockModal");
});

document.getElementById("saveStockBtn")?.addEventListener("click", async () => {
  const brand = document.getElementById("s-brand").value.trim();
  if (!brand) { showToast("Marka daxil edin"); return; }

  const data = {
    brand,
    type:   document.getElementById("s-type").value.trim(),
    volume: parseFloat(document.getElementById("s-volume").value) || 0,
    price:  parseFloat(document.getElementById("s-price").value) || 0,
    qty:    parseInt(document.getElementById("s-qty").value) || 0
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

window.editProduct = (id) => {
  const p = window._products.find(x => x.id === id);
  if (!p) return;
  window._editingProductId = id;
  document.getElementById("stockModalTitle").textContent = "Məhsulu düzəlt";
  document.getElementById("s-brand").value  = p.brand || "";
  document.getElementById("s-type").value   = p.type || "";
  document.getElementById("s-volume").value = p.volume || "";
  document.getElementById("s-price").value  = p.price || "";
  document.getElementById("s-qty").value    = p.qty || "";
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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Sifariş tapılmadı</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td>${o.customerName || "—"}</td>
      <td>${o.itemsSummary || "—"}</td>
      <td>${o.date || "—"}</td>
      <td>${(o.total || 0).toFixed(2)} ₼</td>
      <td>
        <span class="badge ${statusBadge(o.status)}">${statusLabel(o.status)}</span>
      </td>
      <td>
        <select class="status-change-sel" onchange="changeOrderStatus('${o.id}', this.value)" style="font-size:12px;padding:4px 6px">
          <option value="">Status dəyiş...</option>
          <option value="pending">Alındı</option>
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

  // Müştəri select doldur
  const sel = document.getElementById("o-customer");
  sel.innerHTML = `<option value="">Müştəri seç...</option>` +
    window._customers.map(c => `<option value="${c.id}">${c.name} ${c.surname || ""} — ${c.region || ""}</option>`).join("");

  // Tarix bugün
  document.getElementById("o-date").value = new Date().toISOString().split("T")[0];

  // İtem sıfırla
  document.getElementById("orderItems").innerHTML = "";
  addOrderItemRow();
  updateOrderTotal();

  document.getElementById("o-status").value = "pending";
  document.getElementById("o-speed").value  = "medium";
  document.getElementById("o-note").value   = "";

  openModal("orderModal");
}

function addOrderItemRow() {
  const container = document.getElementById("orderItems");
  const idx       = container.children.length;

  const productOptions = window._products.map(p =>
    `<option value="${p.id}" data-price="${p.price}">${p.brand} ${p.type || ""} ${p.volume}L — ${p.price} ₼</option>`
  ).join("");

  const row = document.createElement("div");
  row.className   = "order-item-row";
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
      <label>Miqdar</label>
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

  // Məhsul seçildikdə qiyməti avtomatik hesabla
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

  // Məhsul sətirləri
  const items = [];
  document.querySelectorAll(".order-item-row").forEach(row => {
    const sel   = row.querySelector(".o-product");
    const pid   = sel?.value;
    const qty   = parseFloat(row.querySelector(".o-qty")?.value) || 0;
    const price = parseFloat(row.querySelector(".o-line-price")?.value) || 0;
    if (pid && qty > 0) {
      const p = window._products.find(x => x.id === pid);
      items.push({ productId: pid, productName: `${p?.brand} ${p?.type || ""} ${p?.volume}L`, qty, price });
    }
  });

  if (items.length === 0) { showToast("Ən azı 1 məhsul seçin"); return; }

  const customer     = window._customers.find(c => c.id === customerId);
  const total        = items.reduce((s, i) => s + i.price, 0);
  const itemsSummary = items.map(i => `${i.productName} x${i.qty}`).join(", ");

  const data = {
    customerId,
    customerName: `${customer?.name} ${customer?.surname || ""}`,
    date,
    items,
    itemsSummary,
    total,
    status: document.getElementById("o-status").value,
    speed:  document.getElementById("o-speed").value,
    note:   document.getElementById("o-note").value.trim()
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
  const debtors   = customers.filter(c => (c.debt || 0) > 0)
                              .sort((a, b) => b.debt - a.debt);

  const tbody = document.querySelector("#debts-table tbody");
  if (!tbody) return;

  if (debtors.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Borc yoxdur</td></tr>`;
    return;
  }

  tbody.innerHTML = debtors.map(c => `
    <tr>
      <td><strong>${c.name} ${c.surname || ""}</strong></td>
      <td>${c.region || "—"}</td>
      <td>${c.phone || "—"}</td>
      <td class="debt-amount">${(c.debt || 0).toFixed(2)} ₼</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openPayment('${c.id}')">
          <i class="ti ti-wallet"></i> Ödəniş
        </button>
      </td>
    </tr>
  `).join("");
}

// ============================================================
//  AĞILLI SİYAHI
// ============================================================
async function loadSmartList() {
  const list = await getSmartList();
  const tbody = document.querySelector("#smart-table tbody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Hələ məlumat yoxdur</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><strong>${c.name} ${c.surname || ""}</strong></td>
      <td>${c.region || "—"}</td>
      <td>${c.lastOrderDate || "—"}</td>
      <td>${c.daysSinceOrder} gün</td>
      <td><span class="badge badge-yellow">${speedLabel(c.lastOrderSpeed)}</span></td>
    </tr>
  `).join("");
}

// ============================================================
//  HESABAT / EXPORT
// ============================================================
function loadReports() {
  // Export düymələri ayrı export.js-də olacaq
}

// ============================================================
//  KÖMƏKÇI FUNKSİYALAR
// ============================================================
function statusBadge(s) {
  return { pending: "badge-yellow", delivered: "badge-green", debt: "badge-red" }[s] || "badge-gray";
}

function statusLabel(s) {
  return { pending: "Alındı", delivered: "Çatdırıldı", debt: "Borcludur" }[s] || s;
}

function speedLabel(s) {
  return { fast: "Sürətli", medium: "Orta", slow: "Yavaş" }[s] || "Orta";
}

// ============================================================
//  INIT
// ============================================================
async function init() {
  // Bütün data-ları əvvəlcədən yüklə
  try {
    [window._customers, window._products, window._orders] = await Promise.all([
      getCustomers(),
      getProducts(),
      getOrders()
    ]);
  } catch(e) {
    console.error("İlkin yükləmə xətası:", e);
  }

  navigateTo("dashboard");
}

init();
