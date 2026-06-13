// ============================================================
//  db.js  —  Firebase init + Auth + Firestore CRUD
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
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1WzLhym2qi4kglIFz67Z1ak-g5gMdejI",
  authDomain: "stock-c74f0.firebaseapp.com",
  projectId: "stock-c74f0",
  storageBucket: "stock-c74f0.firebasestorage.app",
  messagingSenderId: "601838111299",
  appId: "1:601838111299:web:09b85dcfbbc7c69d0662f6",
  measurementId: "G-KWWVCWNW1N"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── Auth helpers ──────────────────────────────────────────

/** Cari istifadəçinin UID-ini qaytar, yoxdursa xəta at */
function uid() {
  const user = auth.currentUser;
  if (!user) throw new Error("İstifadəçi giriş etməyib");
  return user.uid;
}

/** users/{uid}/{col} — hər user üçün ayrıca kolleksiya */
function userCol(col) {
  return collection(db, "users", uid(), col);
}

/** users/{uid}/{col}/{id} — tək sənəd */
function userDoc(col, id) {
  return doc(db, "users", uid(), col, id);
}

// ─── Collection adları ─────────────────────────────────────
const CUSTOMERS = "customers";
const ORDERS    = "orders";
const PRODUCTS  = "products";
const PAYMENTS  = "payments";

// ============================================================
//  AUTH
// ============================================================

/** Google ilə giriş */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

/** Çıxış */
export async function logout() {
  return signOut(auth);
}

/** Auth vəziyyəti dəyişdikdə callback çağır */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth };

// ============================================================
//  MÜŞTƏRİLƏR
// ============================================================

export async function getCustomers() {
  const snap = await getDocs(query(userCol(CUSTOMERS), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCustomer(data) {
  return addDoc(userCol(CUSTOMERS), {
    ...data,
    debt: 0,
    deposit: 0,
    createdAt: serverTimestamp()
  });
}

export async function updateCustomer(id, data) {
  return updateDoc(userDoc(CUSTOMERS, id), data);
}

export async function deleteCustomer(id) {
  return deleteDoc(userDoc(CUSTOMERS, id));
}

export async function getCustomer(id) {
  const snap = await getDoc(userDoc(CUSTOMERS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateCustomerDebt(customerId, delta) {
  const ref  = userDoc(CUSTOMERS, customerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cur     = snap.data();
  const newDebt = (cur.debt || 0) + delta;
  await updateDoc(ref, { debt: newDebt });
}

// ============================================================
//  SİFARİŞLƏR
// ============================================================

export async function getOrders() {
  const snap = await getDocs(query(userCol(ORDERS), orderBy("date", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getOrdersByCustomer(customerId) {
  const snap = await getDocs(
    query(userCol(ORDERS), where("customerId", "==", customerId), orderBy("date", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addOrder(data) {
  const ref = await addDoc(userCol(ORDERS), {
    ...data,
    createdAt: serverTimestamp()
  });

  const customer = await getDoc(userDoc(CUSTOMERS, data.customerId));
  if (!customer.exists()) return ref;
  const cur = customer.data();

  const total      = data.total || 0;
  const paidAmount = data.paidAmount || 0;

  if (data.status === 'debt') {
    // Tam borc
    await updateCustomerDebt(data.customerId, total);

  } else if (data.status === 'partial') {
    // Qismən ödənilib — fərq borc olur
    const remaining = Math.max(0, total - paidAmount);
    if (remaining > 0) await updateCustomerDebt(data.customerId, remaining);
    // Ödənilən hissəni payment kimi qeyd et
    if (paidAmount > 0) {
      await addDoc(userCol(PAYMENTS), {
        customerId: data.customerId,
        orderId: ref.id,
        type: 'payment',
        amount: paidAmount,
        note: data.paymentNote || 'Qismən ödəniş',
        date: data.date,
        createdAt: serverTimestamp()
      });
    }

  } else if (data.status === 'deposit') {
    // Depozitdən silinir
    const newDeposit = Math.max(0, (cur.deposit || 0) - total);
    await updateDoc(userDoc(CUSTOMERS, data.customerId), { deposit: newDeposit });

  } else if (data.status === 'paid') {
    // Tam ödənilib — heç bir borc əlavə olunmur
    await addDoc(userCol(PAYMENTS), {
      customerId: data.customerId,
      orderId: ref.id,
      type: 'payment',
      amount: total,
      note: data.paymentNote || 'Tam ödəniş',
      date: data.date,
      createdAt: serverTimestamp()
    });
  }
  // pending — ödəniş sonra olacaq, borc da qeyd olunmur hələlik

  await updateDoc(userDoc(CUSTOMERS, data.customerId), {
    lastOrderDate:  data.date,
    lastOrderSpeed: data.speed || 'medium'
  });

  return ref;
}

export async function updateOrderStatus(orderId, newStatus) {
  const ref  = userDoc(ORDERS, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const order = snap.data();
  const old   = order.status;

  await updateDoc(ref, { status: newStatus });

  // Köhnə statusdan yeni statusa keçid — borc fərqini hesabla
  const debtStatuses = ['debt'];
  const wasDebt = debtStatuses.includes(old);
  const isDebt  = debtStatuses.includes(newStatus);

  if (!wasDebt && isDebt) {
    await updateCustomerDebt(order.customerId, order.total);
  } else if (wasDebt && !isDebt) {
    await updateCustomerDebt(order.customerId, -order.total);
  }
}

export async function updateOrder(id, data) {
  return updateDoc(userDoc(ORDERS, id), data);
}

export async function deleteOrder(id) {
  const snap = await getDoc(userDoc(ORDERS, id));
  if (snap.exists()) {
    const o = snap.data();
    if (o.status === "debt") {
      await updateCustomerDebt(o.customerId, -o.total);
    }
  }
  return deleteDoc(userDoc(ORDERS, id));
}

// ============================================================
//  MƏHSULLAR (STOK)
// ============================================================

export async function getProducts() {
  const snap = await getDocs(query(userCol(PRODUCTS), orderBy("brand")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addProduct(data) {
  return addDoc(userCol(PRODUCTS), {
    ...data,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: serverTimestamp()
  });
}

export async function updateProduct(id, data) {
  return updateDoc(userDoc(PRODUCTS, id), data);
}

export async function deleteProduct(id) {
  return deleteDoc(userDoc(PRODUCTS, id));
}

// ============================================================
//  ÖDƏNİŞLƏR / DEPOZİT
// ============================================================

export async function addPayment(data) {
  const ref = await addDoc(userCol(PAYMENTS), {
    ...data,
    createdAt: serverTimestamp()
  });

  const customerRef = userDoc(CUSTOMERS, data.customerId);
  const snap        = await getDoc(customerRef);
  if (!snap.exists()) return ref;
  const cur = snap.data();

  if (data.type === "payment") {
    const newDebt = Math.max(0, (cur.debt || 0) - data.amount);
    await updateDoc(customerRef, { debt: newDebt });
  } else if (data.type === "deposit") {
    await updateDoc(customerRef, { deposit: (cur.deposit || 0) + data.amount });
  }

  return ref;
}

export async function getPaymentsByCustomer(customerId) {
  const snap = await getDocs(
    query(userCol(PAYMENTS), where("customerId", "==", customerId), orderBy("createdAt", "desc"))
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
  const totalProducts = products.filter(p => p.isActive !== false).length;


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
//  AĞILLI SİYAHI
// ============================================================

export async function getSmartList() {
  const customers = await getCustomers();
  const today     = new Date();
  const speedDays = { fast: 7, medium: 14, slow: 21 };

  return customers
    .filter(c => {
      if (!c.lastOrderDate) return false;
      const last   = new Date(c.lastOrderDate);
      const days   = Math.floor((today - last) / 86400000);
      const thresh = speedDays[c.lastOrderSpeed || "medium"];
      return days >= thresh * 0.8;
    })
    .map(c => {
      const last = new Date(c.lastOrderDate);
      const days = Math.floor((today - last) / 86400000);
      return { ...c, daysSinceOrder: days };
    })
    .sort((a, b) => b.daysSinceOrder - a.daysSinceOrder);
}

export { db };
