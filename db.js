// ============================================================
//  db.js  —  Firebase init + Firestore CRUD
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1WzLhym2qi4kglIFz67Z1ak-g5gMdejI",
  authDomain: "stock-c74f0.firebaseapp.com",
  projectId: "stock-c74f0",
  storageBucket: "stock-c74f0.firebasestorage.app",
  messagingSenderId: "601838111299",
  appId: "1:601838111299:web:09b85dcfbbc7c69d0662f6",
  measurementId: "G-KWWVCWNW1N"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Collection refs ───────────────────────────────────────
const CUSTOMERS = "customers";
const ORDERS    = "orders";
const PRODUCTS  = "products";
const PAYMENTS  = "payments";

// ============================================================
//  MÜŞTƏRİLƏR
// ============================================================

/** Bütün müştəriləri gətir */
export async function getCustomers() {
  const snap = await getDocs(query(collection(db, CUSTOMERS), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Müştəri əlavə et */
export async function addCustomer(data) {
  return addDoc(collection(db, CUSTOMERS), {
    ...data,
    debt: 0,
    deposit: 0,
    createdAt: serverTimestamp()
  });
}

/** Müştəri yenilə */
export async function updateCustomer(id, data) {
  return updateDoc(doc(db, CUSTOMERS, id), data);
}

/** Müştəri sil */
export async function deleteCustomer(id) {
  return deleteDoc(doc(db, CUSTOMERS, id));
}

/** Tək müştəri gətir */
export async function getCustomer(id) {
  const snap = await getDoc(doc(db, CUSTOMERS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Müştərinin borcunu yenilə */
export async function updateCustomerDebt(customerId, delta) {
  const ref  = doc(db, CUSTOMERS, customerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cur = snap.data();
  const newDebt = (cur.debt || 0) + delta;
  await updateDoc(ref, { debt: newDebt });
}

// ============================================================
//  SİFARİŞLƏR
// ============================================================

/** Bütün sifarişlər */
export async function getOrders() {
  const snap = await getDocs(query(collection(db, ORDERS), orderBy("date", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Müştəriyə aid sifarişlər */
export async function getOrdersByCustomer(customerId) {
  const snap = await getDocs(
    query(collection(db, ORDERS), where("customerId", "==", customerId), orderBy("date", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Yeni sifariş əlavə et */
export async function addOrder(data) {
  const ref = await addDoc(collection(db, ORDERS), {
    ...data,
    createdAt: serverTimestamp()
  });

  // Əgər status "debt" dirsə müştərinin borcunu artır
  if (data.status === "debt") {
    await updateCustomerDebt(data.customerId, data.total);
  }

  // Müştərinin son sifariş tarixini yenilə
  await updateDoc(doc(db, CUSTOMERS, data.customerId), {
    lastOrderDate: data.date,
    lastOrderSpeed: data.speed || "medium"
  });

  return ref;
}

/** Sifariş statusunu dəyiş */
export async function updateOrderStatus(orderId, newStatus) {
  const ref  = doc(db, ORDERS, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const order = snap.data();
  const old   = order.status;

  await updateDoc(ref, { status: newStatus });

  // Borc düzəlişi
  if (old !== "debt" && newStatus === "debt") {
    await updateCustomerDebt(order.customerId, order.total);
  } else if (old === "debt" && newStatus !== "debt") {
    await updateCustomerDebt(order.customerId, -order.total);
  }
}

/** Sifarişi yenilə (tam) */
export async function updateOrder(id, data) {
  return updateDoc(doc(db, ORDERS, id), data);
}

/** Sifariş sil */
export async function deleteOrder(id) {
  const snap = await getDoc(doc(db, ORDERS, id));
  if (snap.exists()) {
    const o = snap.data();
    if (o.status === "debt") {
      await updateCustomerDebt(o.customerId, -o.total);
    }
  }
  return deleteDoc(doc(db, ORDERS, id));
}

// ============================================================
//  MƏHSULLAR (STOK)
// ============================================================

/** Bütün məhsullar */
export async function getProducts() {
  const snap = await getDocs(query(collection(db, PRODUCTS), orderBy("brand")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Məhsul əlavə et */
export async function addProduct(data) {
  return addDoc(collection(db, PRODUCTS), {
    ...data,
    createdAt: serverTimestamp()
  });
}

/** Məhsul yenilə */
export async function updateProduct(id, data) {
  return updateDoc(doc(db, PRODUCTS, id), data);
}

/** Məhsul sil */
export async function deleteProduct(id) {
  return deleteDoc(doc(db, PRODUCTS, id));
}

// ============================================================
//  ÖDƏNİŞLƏR / DEPOZİT
// ============================================================

/** Ödəniş əlavə et */
export async function addPayment(data) {
  const ref = await addDoc(collection(db, PAYMENTS), {
    ...data,
    createdAt: serverTimestamp()
  });

  // Borc / depozit hesablaması
  const customerRef = doc(db, CUSTOMERS, data.customerId);
  const snap = await getDoc(customerRef);
  if (!snap.exists()) return ref;
  const cur = snap.data();

  if (data.type === "payment") {
    // Borc azaldır
    const newDebt = Math.max(0, (cur.debt || 0) - data.amount);
    await updateDoc(customerRef, { debt: newDebt });
  } else if (data.type === "deposit") {
    // Depozit artırır
    await updateDoc(customerRef, { deposit: (cur.deposit || 0) + data.amount });
  }

  return ref;
}

/** Müştəriyə aid ödənişlər */
export async function getPaymentsByCustomer(customerId) {
  const snap = await getDocs(
    query(collection(db, PAYMENTS), where("customerId", "==", customerId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================================
//  AGREGASİYA — dashboard üçün
// ============================================================

export async function getDashboardStats() {
  const [customers, orders, products] = await Promise.all([
    getCustomers(),
    getOrders(),
    getProducts()
  ]);

  const totalDebt     = customers.reduce((s, c) => s + (c.debt || 0), 0);
  const activeOrders  = orders.filter(o => o.status === "pending").length;
  const totalProducts = products.reduce((s, p) => s + (p.qty || 0), 0);

  return {
    customerCount: customers.length,
    activeOrders,
    totalDebt,
    totalProducts,
    recentOrders: orders.slice(0, 5),
    topDebtors: [...customers]
      .filter(c => (c.debt || 0) > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5)
  };
}

// ============================================================
//  AĞILLI SİYAHI — dövriyyəyə görə sifariş ehtimalı
// ============================================================

export async function getSmartList() {
  const customers = await getCustomers();
  const today     = new Date();

  const speedDays = { fast: 7, medium: 14, slow: 21 };

  return customers
    .filter(c => {
      if (!c.lastOrderDate) return false;
      const last    = new Date(c.lastOrderDate);
      const days    = Math.floor((today - last) / 86400000);
      const thresh  = speedDays[c.lastOrderSpeed || "medium"];
      return days >= thresh * 0.8; // 80%-ə çatanda siyahıya düşür
    })
    .map(c => {
      const last   = new Date(c.lastOrderDate);
      const days   = Math.floor((today - last) / 86400000);
      return { ...c, daysSinceOrder: days };
    })
    .sort((a, b) => b.daysSinceOrder - a.daysSinceOrder);
}

export { db };
