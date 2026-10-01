import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_VERSION } from "./storage";
import { logger } from "./logger";

const BILLING_KEY = `kwestup_billing_${STORAGE_VERSION}`;

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_BILLING = {
  transactions: [],
  budgets: [],
  recurringBills: [],
  currency: "₹",
};

// ─── Core Load / Save ─────────────────────────────────────────────────────────

export const loadBillingData = async () => {
  try {
    const raw = await AsyncStorage.getItem(BILLING_KEY);
    if (!raw) return { ...DEFAULT_BILLING };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_BILLING };
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      recurringBills: Array.isArray(parsed.recurringBills) ? parsed.recurringBills : [],
      currency: typeof parsed.currency === 'string' ? parsed.currency : DEFAULT_BILLING.currency,
    };
  } catch (err) {
    logger.error("billingStorage: loadBillingData failed", { error: err });
    return { ...DEFAULT_BILLING };
  }
};

export const saveBillingData = async (billingState) => {
  try {
    await AsyncStorage.setItem(BILLING_KEY, JSON.stringify(billingState));
  } catch (err) {
    logger.error("billingStorage: saveBillingData failed", { error: err });
  }
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const addTransaction = async (tx) => {
  const data = await loadBillingData();
  const updated = { ...data, transactions: [tx, ...data.transactions] };
  await saveBillingData(updated);
  return updated;
};

export const deleteTransaction = async (id) => {
  const data = await loadBillingData();
  const updated = { ...data, transactions: data.transactions.filter((t) => t.id !== id) };
  await saveBillingData(updated);
  return updated;
};

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const upsertBudget = async (budget) => {
  if (!budget || typeof budget.id !== 'string' || !budget.id) throw new Error('upsertBudget: budget.id is required');
  const data = await loadBillingData();
  const idx = data.budgets.findIndex((b) => b.id === budget.id);
  const updatedBudgets = idx >= 0
    ? data.budgets.map((b, i) => (i === idx ? { ...b, ...budget, id: b.id } : b))
    : [...data.budgets, budget];
  const updated = { ...data, budgets: updatedBudgets };
  await saveBillingData(updated);
  return updated;
};

export const deleteBudget = async (id) => {
  const data = await loadBillingData();
  const updated = { ...data, budgets: data.budgets.filter((b) => b.id !== id) };
  await saveBillingData(updated);
  return updated;
};

// ─── Analytics Helpers ────────────────────────────────────────────────────────

const toAmount = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Returns { category: totalSpent } map for expense transactions in a given month.
 * @param {Array} transactions
 * @param {string} month - "YYYY-MM"
 */
export const getSpendingByCategory = (transactions, month) => {
  const result = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!tx.date || !tx.date.startsWith(month)) continue;
    const cat = typeof tx.category === 'string' && tx.category ? tx.category : 'uncategorized';
    result[cat] = (result[cat] || 0) + toAmount(tx.amount);
  }
  return result;
};

/**
 * Returns { income, expenses, net } totals for a given month.
 * @param {Array} transactions
 * @param {string} month - "YYYY-MM"
 */
export const getMonthlyTotals = (transactions, month) => {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    if (!tx.date || !tx.date.startsWith(month)) continue;
    if (tx.type === "income") income += toAmount(tx.amount);
    if (tx.type === "expense") expenses += toAmount(tx.amount);
  }
  return { income, expenses, net: income - expenses };
};

// ─── Recurring Bills ──────────────────────────────────────────────────────────

export const addRecurringBill = async (bill) => {
  const data = await loadBillingData();
  const updated = { ...data, recurringBills: [...data.recurringBills, bill] };
  await saveBillingData(updated);
  return updated;
};

export const deleteRecurringBill = async (id) => {
  const data = await loadBillingData();
  const updated = { ...data, recurringBills: data.recurringBills.filter((b) => b.id !== id) };
  await saveBillingData(updated);
  return updated;
};

export const markBillPaid = async (id, paidDate) => {
  const data = await loadBillingData();
  const updated = {
    ...data,
    recurringBills: data.recurringBills.map((b) =>
      b.id === id ? { ...b, lastPaidDate: paidDate } : b
    ),
  };
  await saveBillingData(updated);
  return updated;
};

export const updateBillNotificationIds = async (id, notificationIds) => {
  const data = await loadBillingData();
  const updated = {
    ...data,
    recurringBills: data.recurringBills.map((b) =>
      b.id === id ? { ...b, notificationIds } : b
    ),
  };
  await saveBillingData(updated);
  return updated;
};
