import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppDataPayload, AppView, BankAccount, Category, Debtor, ExpenseEntry, Goal, IncomeEntry, UserProfile } from '../types';
import { initialDataPayload } from '../data/defaultData';
import { calculateHourlyRate } from '../utils/timeConversion';

interface AppContextType {
  data: AppDataPayload;
  profile: UserProfile;
  categories: Category[];
  expenses: ExpenseEntry[];
  income: IncomeEntry[];
  goals: Goal[];
  bankAccounts: BankAccount[];
  debtors: Debtor[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncCount: number;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  selectedGoalId: string | null;
  setSelectedGoalId: (id: string | null) => void;
  deviceMode: 'mobile' | 'desktop' | 'responsive';
  setDeviceMode: (mode: 'mobile' | 'desktop' | 'responsive') => void;
  
  // Actions
  addExpense: (expense: { amount: number; title: string; categoryId: string; note?: string; dateTime?: string }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addIncome: (income: { amount: number; source: string; category?: string; note?: string; dateTime?: string }) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => Promise<void>;
  contributeToGoal: (id: string, amount: number) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateCategoryBudget: (id: string, monthlyBudget: number) => Promise<void>;
  addBankAccount: (bank: { bankName: string; label?: string; balance: number }) => Promise<void>;
  updateBankAccount: (id: string, bank: { bankName?: string; label?: string; balance?: number }) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
  addDebtor: (debtor: { name: string; amountOwed: number; dateLent?: string; dueDate?: string; status?: 'owing' | 'paid'; note?: string }) => Promise<void>;
  updateDebtor: (id: string, debtor: Partial<Debtor>) => Promise<void>;
  toggleDebtorStatus: (id: string) => Promise<void>;
  deleteDebtor: (id: string) => Promise<void>;
  completeOnboarding: (onboardingData: any) => Promise<void>;
  resetData: () => Promise<void>;
  manualRefresh: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppDataPayload>(initialDataPayload);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState<number>(0);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>('cat-groceries');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop' | 'responsive'>('responsive');

  // Fetch from REST API
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsSyncing(true);
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const payload: AppDataPayload = await res.json();
        if (!payload.bankAccounts) payload.bankAccounts = [];
        if (!payload.debtors) payload.debtors = [];
        setData(payload);
        setLastSyncedAt(new Date());
        setSyncCount(prev => prev + 1);
      }
    } catch (err) {
      console.warn('REST API fetch error, using current state:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Poll REST API every 10 seconds
  useEffect(() => {
    fetchData(false);

    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // If onboarding is not completed, auto-route to onboarding
  useEffect(() => {
    if (!isLoading && !data.profile.onboardingCompleted) {
      setActiveView('onboarding');
    }
  }, [isLoading, data.profile.onboardingCompleted]);

  // Mutations
  const addExpense = async (expense: { amount: number; title: string; categoryId: string; note?: string; dateTime?: string }) => {
    const numAmount = Number(expense.amount);
    const tempId = `exp-${Date.now()}`;
    const newEntry: ExpenseEntry = {
      id: tempId,
      amount: numAmount,
      title: expense.title,
      categoryId: expense.categoryId,
      dateTime: expense.dateTime || new Date().toISOString(),
      note: expense.note,
    };

    // Optimistic UI update
    setData(prev => {
      const updatedCategories = prev.categories.map(c => 
        c.id === expense.categoryId ? { ...c, spent: c.spent + numAmount } : c
      );
      return {
        ...prev,
        categories: updatedCategories,
        expenses: [newEntry, ...prev.expenses],
        lastUpdated: new Date().toISOString(),
      };
    });

    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to post expense:', e);
    }
  };

  const deleteExpense = async (id: string) => {
    const expenseToDelete = data.expenses.find(e => e.id === id);
    if (!expenseToDelete) return;

    // Optimistic update
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.id === expenseToDelete.categoryId ? { ...c, spent: Math.max(0, c.spent - expenseToDelete.amount) } : c
      ),
      expenses: prev.expenses.filter(e => e.id !== id),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      fetchData(true);
    } catch (e) {
      console.error('Failed to delete expense:', e);
    }
  };

  const addIncome = async (income: { amount: number; source: string; category?: string; note?: string; dateTime?: string }) => {
    const numAmount = Number(income.amount);
    const tempId = `inc-${Date.now()}`;
    const newEntry: IncomeEntry = {
      id: tempId,
      amount: numAmount,
      source: income.source,
      category: income.category || 'Income',
      dateTime: income.dateTime || new Date().toISOString(),
      note: income.note,
    };

    setData(prev => ({
      ...prev,
      income: [newEntry, ...prev.income],
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(income),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to post income:', e);
    }
  };

  const deleteIncome = async (id: string) => {
    setData(prev => ({
      ...prev,
      income: prev.income.filter(i => i.id !== id),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/income/${id}`, { method: 'DELETE' });
      fetchData(true);
    } catch (e) {
      console.error('Failed to delete income:', e);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const current = data.profile;
    const monthlyIncome = updates.monthlyIncome !== undefined ? Number(updates.monthlyIncome) : current.monthlyIncome;
    const workDaysPerWeek = updates.workDaysPerWeek !== undefined ? Number(updates.workDaysPerWeek) : current.workDaysPerWeek;
    const workHoursPerDay = updates.workHoursPerDay !== undefined ? Number(updates.workHoursPerDay) : current.workHoursPerDay;

    const { hourlyRate, dailyRate } = calculateHourlyRate(monthlyIncome, workDaysPerWeek, workHoursPerDay);

    const newProfile: UserProfile = {
      ...current,
      ...updates,
      monthlyIncome,
      workDaysPerWeek,
      workHoursPerDay,
      hourlyRate,
      dailyRate,
    };

    setData(prev => ({
      ...prev,
      profile: newProfile,
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to update profile:', e);
    }
  };

  const addGoal = async (goal: Omit<Goal, 'id' | 'createdAt'>) => {
    const newGoal: Goal = {
      ...goal,
      id: `goal-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setData(prev => ({
      ...prev,
      goals: [...prev.goals, newGoal],
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to add goal:', e);
    }
  };

  const contributeToGoal = async (id: string, amount: number) => {
    setData(prev => ({
      ...prev,
      goals: prev.goals.map(g =>
        g.id === id ? { ...g, savedAmount: Math.min(g.targetAmount, g.savedAmount + amount) } : g
      ),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAmount: amount }),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to contribute to goal:', e);
    }
  };

  const deleteGoal = async (id: string) => {
    setData(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== id),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      fetchData(true);
    } catch (e) {
      console.error('Failed to delete goal:', e);
    }
  };

  const updateCategoryBudget = async (id: string, monthlyBudget: number) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.id === id ? { ...c, monthlyBudget } : c
      ),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/categories/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudget }),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to update category budget:', e);
    }
  };

  const addBankAccount = async (bank: { bankName: string; label?: string; balance: number }) => {
    const tempBank: BankAccount = {
      id: `bank-${Date.now()}`,
      bankName: bank.bankName.trim(),
      label: bank.label?.trim() || '',
      balance: Number(bank.balance || 0),
      lastUpdated: new Date().toISOString(),
    };

    setData(prev => ({
      ...prev,
      bankAccounts: [...(prev.bankAccounts || []), tempBank],
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bank),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to add bank account:', e);
    }
  };

  const updateBankAccount = async (id: string, bank: { bankName?: string; label?: string; balance?: number }) => {
    setData(prev => ({
      ...prev,
      bankAccounts: (prev.bankAccounts || []).map(b =>
        b.id === id ? { ...b, ...bank, lastUpdated: new Date().toISOString() } : b
      ),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/banks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bank),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to update bank account:', e);
    }
  };

  const deleteBankAccount = async (id: string) => {
    setData(prev => ({
      ...prev,
      bankAccounts: (prev.bankAccounts || []).filter(b => b.id !== id),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/banks/${id}`, { method: 'DELETE' });
      fetchData(true);
    } catch (e) {
      console.error('Failed to delete bank account:', e);
    }
  };

  const addDebtor = async (debtor: { name: string; amountOwed: number; dateLent?: string; dueDate?: string; status?: 'owing' | 'paid'; note?: string }) => {
    const tempDebtor: Debtor = {
      id: `deb-${Date.now()}`,
      name: debtor.name.trim(),
      amountOwed: Number(debtor.amountOwed || 0),
      dateLent: debtor.dateLent || new Date().toISOString().split('T')[0],
      dueDate: debtor.dueDate || undefined,
      status: debtor.status || 'owing',
      note: debtor.note?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    setData(prev => ({
      ...prev,
      debtors: [tempDebtor, ...(prev.debtors || [])],
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch('/api/debtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debtor),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to add debtor:', e);
    }
  };

  const updateDebtor = async (id: string, debtorUpdates: Partial<Debtor>) => {
    setData(prev => ({
      ...prev,
      debtors: (prev.debtors || []).map(d =>
        d.id === id ? { ...d, ...debtorUpdates } : d
      ),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/debtors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debtorUpdates),
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to update debtor:', e);
    }
  };

  const toggleDebtorStatus = async (id: string) => {
    setData(prev => ({
      ...prev,
      debtors: (prev.debtors || []).map(d =>
        d.id === id ? { ...d, status: d.status === 'owing' ? 'paid' : 'owing' } : d
      ),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/debtors/${id}/mark-paid`, {
        method: 'PATCH',
      });
      fetchData(true);
    } catch (e) {
      console.error('Failed to toggle debtor status:', e);
    }
  };

  const deleteDebtor = async (id: string) => {
    setData(prev => ({
      ...prev,
      debtors: (prev.debtors || []).filter(d => d.id !== id),
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await fetch(`/api/debtors/${id}`, { method: 'DELETE' });
      fetchData(true);
    } catch (e) {
      console.error('Failed to delete debtor:', e);
    }
  };

  const completeOnboarding = async (onboardingData: any) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardingData),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.store) {
          setData(result.store);
        } else {
          await fetchData(false);
        }
      }
      setActiveView('dashboard');
    } catch (e) {
      console.error('Failed to complete onboarding:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const resetData = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      await fetchData(false);
      setActiveView('onboarding');
    } catch (e) {
      console.error('Failed to reset:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const manualRefresh = async () => {
    await fetchData(false);
  };

  return (
    <AppContext.Provider
      value={{
        data,
        profile: data.profile,
        categories: data.categories,
        expenses: data.expenses,
        income: data.income,
        goals: data.goals,
        bankAccounts: data.bankAccounts || [],
        debtors: data.debtors || [],
        isLoading,
        isSyncing,
        lastSyncedAt,
        syncCount,
        activeView,
        setActiveView,
        selectedCategoryId,
        setSelectedCategoryId,
        selectedGoalId,
        setSelectedGoalId,
        deviceMode,
        setDeviceMode,
        addExpense,
        deleteExpense,
        addIncome,
        deleteIncome,
        updateProfile,
        addGoal,
        contributeToGoal,
        deleteGoal,
        updateCategoryBudget,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        addDebtor,
        updateDebtor,
        toggleDebtorStatus,
        deleteDebtor,
        completeOnboarding,
        resetData,
        manualRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
