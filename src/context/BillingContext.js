import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loadBillingData,
  saveBillingData,
  addTransaction,
  deleteTransaction,
  upsertBudget,
  deleteBudget,
  addRecurringBill,
  deleteRecurringBill,
} from "../utils/billingStorage";
import { logger } from "../utils/logger";
import { eventBus } from "../behavior/eventBus";

const BillingContext = createContext(null);

const DEFAULT_BILLING = {
  transactions: [],
  budgets: [],
  recurringBills: [],
  currency: "₹",
};

export const BillingProvider = ({
  children,
  initialBillingData = DEFAULT_BILLING,
}) => {
  const [billingData, setBillingData] = useState(initialBillingData);

  useEffect(() => {
    if (initialBillingData && initialBillingData.transactions) {
      setBillingData(initialBillingData);
    }
  }, [initialBillingData]);

  const refreshBillingData = useCallback(async () => {
    try {
      const data = await loadBillingData();
      setBillingData(data);
      return data;
    } catch (err) {
      logger.error("❌ Failed to refresh billing data:", err);
      return DEFAULT_BILLING;
    }
  }, []);

  const addTransactionAction = useCallback(async (tx) => {
    try {
      const txWithId = { ...tx, id: tx.id || String(Date.now()) };
      const updated = await addTransaction(txWithId);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_PAID",
        entityId: String(txWithId.id),
        source: "app",
        payload: {
          amount: txWithId.amount,
          category: txWithId.category,
          date: txWithId.date,
        },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to add transaction:", err);
    }
  }, []);

  const deleteTransactionAction = useCallback(async (id) => {
    try {
      const updated = await deleteTransaction(id);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_DELETED",
        entityId: String(id),
        source: "app",
        payload: { subType: "transaction" },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to delete transaction:", err);
    }
  }, []);

  const upsertBudgetAction = useCallback(async (budget) => {
    try {
      const isExisting = Boolean(budget?.id && billingData?.budgets?.some((b) => b.id === budget.id));
      const updated = await upsertBudget(budget);
      setBillingData(updated);
      eventBus.emit({
        type: isExisting ? "BILL_UPDATED" : "BILL_CREATED",
        entityId: String(budget.id),
        source: "app",
        payload: {
          subType: "budget",
          category: budget.category,
          amount: budget.amount,
        },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to upsert budget:", err);
    }
  }, [billingData]);

  const deleteBudgetAction = useCallback(async (id) => {
    try {
      const updated = await deleteBudget(id);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_DELETED",
        entityId: String(id),
        source: "app",
        payload: { subType: "budget" },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to delete budget:", err);
    }
  }, []);

  const addRecurringBillAction = useCallback(async (bill) => {
    try {
      const billWithId = { ...bill, id: bill.id || String(Date.now()) };
      const updated = await addRecurringBill(billWithId);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_CREATED",
        entityId: String(billWithId.id),
        source: "app",
        payload: {
          amount: billWithId.amount,
          category: billWithId.category,
          dueDate: billWithId.dueDate,
        },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to add recurring bill:", err);
    }
  }, []);

  const deleteRecurringBillAction = useCallback(async (id) => {
    try {
      const updated = await deleteRecurringBill(id);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_DELETED",
        entityId: String(id),
        source: "app",
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to delete recurring bill:", err);
    }
  }, []);

  // CR-01: Compute next state inside pure updater, then persist outside updater with error handling
  const updateBillingDataState = useCallback(async (updater) => {
    let next;
    setBillingData((prev) => {
      next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    if (next !== undefined) {
      try {
        await saveBillingData(next);
      } catch (err) {
        logger.error("❌ Failed to persist billing data:", err);
      }
    }
  }, []);

  const value = {
    billingData,
    setBillingData: updateBillingDataState,
    refreshBillingData,
    addTransactionAction,
    deleteTransactionAction,
    upsertBudgetAction,
    deleteBudgetAction,
    addRecurringBillAction,
    deleteRecurringBillAction,
  };

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  return context;
};

export default BillingContext;
