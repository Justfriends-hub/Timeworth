import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { initialDataPayload } from './src/data/defaultData';
import type { AppDataPayload, BankAccount, Debtor, ExpenseEntry, Goal, IncomeEntry, UserProfile } from './src/types';
import { calculateHourlyRate } from './src/utils/timeConversion';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Supabase server helper (process.env only — no import.meta) ──
function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return null;
  if (!url.startsWith('http')) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function isSupabaseConfigured(): boolean {
  return !!getSupabaseServer();
}

// ── In-memory fallback (Vercel demo mode if Supabase not configured) ──
let store: AppDataPayload = JSON.parse(JSON.stringify(initialDataPayload));

// ── Gemini client ──
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[gemini] GEMINI_API_KEY not set - AI parsing disabled, using CSV fallback only');
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return genAIClient;
}

// ── Express app factory — exported for Vercel serverless ──
export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // CORS for Vercel preview deployments (same-origin is fine, but allow preflight)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });

  // 1. Health check — reports Supabase wiring without leaking secrets
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      supabase: isSupabaseConfigured() ? 'configured' : 'demo-memory',
      gemini: !!process.env.GEMINI_API_KEY,
      env: process.env.VERCEL ? 'vercel' : 'local',
    });
  });

  // 2. Full payload
  app.get('/api/data', async (req, res) => {
    // If Supabase configured and request carries auth, try to load user data from DB
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        // Attempt to fetch profile + related — if RLS denies, fallback to memory
        const { data: profile } = await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle();
        if (profile) {
          // For MVP: return DB profile merged with memory categories/expenses for now
          // Full DB hydration can be expanded after auth is wired fully on client.
          return res.json({ ...store, profile: {
            name: profile.name,
            monthlyIncome: Number(profile.monthly_income),
            workHoursPerDay: Number(profile.work_hours_per_day),
            workDaysPerWeek: Number(profile.work_days_per_week),
            currency: profile.currency,
            currencySymbol: profile.currency_symbol,
            hourlyRate: Number(profile.hourly_rate),
            dailyRate: Number(profile.daily_rate),
            showAmountsInTime: profile.show_amounts_in_time,
            timePrimary: profile.time_primary,
            onboardingCompleted: profile.onboarding_completed,
          }});
        }
      } catch (e) {
        console.warn('[supabase] /api/data fallback to memory:', e);
      }
    }
    res.json(store);
  });

  // 3. Update User Profile & calculate rates
  app.post('/api/profile', async (req, res) => {
    const updates: Partial<UserProfile> = req.body;
    const current = store.profile;
    const monthlyIncome = updates.monthlyIncome !== undefined ? Number(updates.monthlyIncome) : current.monthlyIncome;
    const workDaysPerWeek = updates.workDaysPerWeek !== undefined ? Number(updates.workDaysPerWeek) : current.workDaysPerWeek;
    const workHoursPerDay = updates.workHoursPerDay !== undefined ? Number(updates.workHoursPerDay) : current.workHoursPerDay;
    const { hourlyRate, dailyRate } = calculateHourlyRate(monthlyIncome, workDaysPerWeek, workHoursPerDay);
    store.profile = { ...current, ...updates, monthlyIncome, workDaysPerWeek, workHoursPerDay, hourlyRate, dailyRate } as UserProfile;
    store.lastUpdated = new Date().toISOString();

    // Persist to Supabase if configured
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        await sb.from('profiles').upsert({
          user_id: userId,
          name: store.profile.name,
          monthly_income: store.profile.monthlyIncome,
          work_hours_per_day: store.profile.workHoursPerDay,
          work_days_per_week: store.profile.workDaysPerWeek,
          currency: store.profile.currency,
          currency_symbol: store.profile.currencySymbol,
          hourly_rate: store.profile.hourlyRate,
          daily_rate: store.profile.dailyRate,
          show_amounts_in_time: store.profile.showAmountsInTime,
          time_primary: store.profile.timePrimary,
          onboarding_completed: store.profile.onboardingCompleted,
          updated_at: new Date().toISOString(),
        });
      } catch (e) { console.warn('[supabase] profile upsert failed:', e); }
    }

    res.json({ success: true, profile: store.profile });
  });

  // 4. Add Expense
  app.post('/api/expenses', async (req, res) => {
    const { amount, title, categoryId, note, dateTime } = req.body;
    if (!amount || !title || !categoryId) return res.status(400).json({ error: 'amount, title, and categoryId are required' });
    const numAmount = Number(amount);
    const newExpense: ExpenseEntry = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      amount: numAmount, title, categoryId,
      dateTime: dateTime || new Date().toISOString(), note: note || '',
    };
    store.expenses.unshift(newExpense);
    const cat = store.categories.find(c => c.id === categoryId);
    if (cat) cat.spent += numAmount;
    store.lastUpdated = new Date().toISOString();

    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        await sb.from('expenses').insert({
          id: newExpense.id.length === 36 ? newExpense.id : undefined,
          user_id: userId, amount: numAmount, title, category_id: categoryId,
          date_time: newExpense.dateTime, note: note || '',
        });
      } catch (e) { console.warn('[supabase] expense insert failed:', e); }
    }

    res.status(201).json({ success: true, expense: newExpense, store });
  });

  // 5. Delete Expense
  app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    const idx = store.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      const removed = store.expenses[idx];
      const cat = store.categories.find(c => c.id === removed.categoryId);
      if (cat) cat.spent = Math.max(0, cat.spent - removed.amount);
      store.expenses.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      const sb = getSupabaseServer();
      const userId = (req.headers['x-user-id'] as string) || null;
      if (sb && userId) { try { await sb.from('expenses').delete().eq('id', id).eq('user_id', userId); } catch {} }
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Expense not found' });
  });

  // 6. Add Income
  app.post('/api/income', async (req, res) => {
    const { amount, source, category, note, dateTime } = req.body;
    if (!amount || !source) return res.status(400).json({ error: 'amount and source are required' });
    const numAmount = Number(amount);
    const newIncome: IncomeEntry = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      amount: numAmount, source, category: category || 'Income',
      dateTime: dateTime || new Date().toISOString(), note: note || '',
    };
    store.income.unshift(newIncome);
    store.lastUpdated = new Date().toISOString();
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        await sb.from('income').insert({
          user_id: userId, amount: numAmount, source, category: category || 'Income',
          date_time: newIncome.dateTime, note: note || '',
        });
      } catch (e) { console.warn('[supabase] income insert failed:', e); }
    }
    res.status(201).json({ success: true, income: newIncome, store });
  });

  // 7. Delete Income
  app.delete('/api/income/:id', async (req, res) => {
    const { id } = req.params;
    const idx = store.income.findIndex(i => i.id === id);
    if (idx !== -1) {
      store.income.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      const sb = getSupabaseServer();
      const userId = (req.headers['x-user-id'] as string) || null;
      if (sb && userId) { try { await sb.from('income').delete().eq('id', id).eq('user_id', userId); } catch {} }
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Income not found' });
  });

  // 8. Add Goal
  app.post('/api/goals', async (req, res) => {
    const { title, targetAmount, savedAmount, icon, color, section, note } = req.body;
    if (!title || !targetAmount) return res.status(400).json({ error: 'title and targetAmount are required' });
    const newGoal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title, targetAmount: Number(targetAmount), savedAmount: Number(savedAmount || 0),
      icon: icon || 'Target', color: color || '#10B981', section: section || 'smart',
      createdAt: new Date().toISOString().split('T')[0], note: note || '',
    };
    store.goals.push(newGoal);
    store.lastUpdated = new Date().toISOString();
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        await sb.from('goals').insert({
          user_id: userId, title, target_amount: Number(targetAmount), saved_amount: Number(savedAmount || 0),
          icon: icon || 'Target', color: color || '#10B981', section: section || 'smart', note: note || '',
        });
      } catch (e) { console.warn('[supabase] goal insert failed:', e); }
    }
    res.status(201).json({ success: true, goal: newGoal });
  });

  // 9. Update Goal
  app.patch('/api/goals/:id', async (req, res) => {
    const { id } = req.params;
    const goal = store.goals.find(g => g.id === id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const { addAmount, savedAmount, targetAmount, title } = req.body;
    if (addAmount !== undefined) goal.savedAmount = Math.min(goal.targetAmount, goal.savedAmount + Number(addAmount));
    if (savedAmount !== undefined) goal.savedAmount = Number(savedAmount);
    if (targetAmount !== undefined) goal.targetAmount = Number(targetAmount);
    if (title !== undefined) goal.title = title;
    store.lastUpdated = new Date().toISOString();
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        const patch: Record<string, unknown> = {};
        if (addAmount !== undefined) patch.saved_amount = goal.savedAmount;
        if (savedAmount !== undefined) patch.saved_amount = Number(savedAmount);
        if (targetAmount !== undefined) patch.target_amount = Number(targetAmount);
        if (title !== undefined) patch.title = title;
        if (Object.keys(patch).length) await sb.from('goals').update(patch).eq('id', id).eq('user_id', userId);
      } catch {}
    }
    res.json({ success: true, goal });
  });

  // 10. Delete Goal
  app.delete('/api/goals/:id', async (req, res) => {
    const { id } = req.params;
    const idx = store.goals.findIndex(g => g.id === id);
    if (idx !== -1) {
      store.goals.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      const sb = getSupabaseServer();
      const userId = (req.headers['x-user-id'] as string) || null;
      if (sb && userId) { try { await sb.from('goals').delete().eq('id', id).eq('user_id', userId); } catch {} }
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Goal not found' });
  });

  // 11. Bank Accounts CRUD
  app.post('/api/banks', async (req, res) => {
    const { bankName, label, balance } = req.body;
    if (!bankName) return res.status(400).json({ error: 'bankName is required' });
    const newBank: BankAccount = {
      id: `bank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bankName: bankName.trim(), label: label?.trim() || '', balance: Number(balance || 0), lastUpdated: new Date().toISOString(),
    };
    if (!store.bankAccounts) store.bankAccounts = [];
    store.bankAccounts.push(newBank);
    store.lastUpdated = new Date().toISOString();
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try { await sb.from('bank_accounts').insert({ user_id: userId, bank_name: bankName.trim(), label: label?.trim() || '', balance: Number(balance || 0) }); } catch {}
    }
    res.status(201).json({ success: true, bankAccount: newBank });
  });
  app.put('/api/banks/:id', async (req, res) => {
    const { id } = req.params;
    const { bankName, label, balance } = req.body;
    if (!store.bankAccounts) store.bankAccounts = [];
    const bank = store.bankAccounts.find(b => b.id === id);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    if (bankName !== undefined) bank.bankName = bankName.trim();
    if (label !== undefined) bank.label = label.trim();
    if (balance !== undefined) bank.balance = Number(balance);
    bank.lastUpdated = new Date().toISOString();
    store.lastUpdated = new Date().toISOString();
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        const patch: Record<string, unknown> = { last_updated: new Date().toISOString() };
        if (bankName !== undefined) patch.bank_name = bankName.trim();
        if (label !== undefined) patch.label = label.trim();
        if (balance !== undefined) patch.balance = Number(balance);
        await sb.from('bank_accounts').update(patch).eq('id', id).eq('user_id', userId);
      } catch {}
    }
    res.json({ success: true, bankAccount: bank });
  });
  app.delete('/api/banks/:id', async (req, res) => {
    const { id } = req.params;
    if (!store.bankAccounts) store.bankAccounts = [];
    const idx = store.bankAccounts.findIndex(b => b.id === id);
    if (idx !== -1) {
      store.bankAccounts.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      const sb = getSupabaseServer();
      const userId = (req.headers['x-user-id'] as string) || null;
      if (sb && userId) { try { await sb.from('bank_accounts').delete().eq('id', id).eq('user_id', userId); } catch {} }
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Bank account not found' });
  });

  // 12. Debtors CRUD
  app.post('/api/debtors', async (req, res) => {
    const { name, amountOwed, dateLent, dueDate, status, note } = req.body;
    if (!name || amountOwed === undefined) return res.status(400).json({ error: 'name and amountOwed are required' });
    const newDebtor: Debtor = {
      id: `deb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), amountOwed: Number(amountOwed || 0),
      dateLent: dateLent || new Date().toISOString().split('T')[0], dueDate: dueDate || undefined,
      status: status === 'paid' ? 'paid' : 'owing', note: note?.trim() || '', createdAt: new Date().toISOString(),
    };
    if (!store.debtors) store.debtors = [];
    store.debtors.unshift(newDebtor);
    store.lastUpdated = new Date().toISOString();
    const sb = getSupabaseServer();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (sb && userId) {
      try {
        await sb.from('debtors').insert({
          user_id: userId, name: name.trim(), amount_owed: Number(amountOwed || 0),
          date_lent: newDebtor.dateLent, due_date: dueDate || null, status: newDebtor.status, note: note?.trim() || '',
        });
      } catch {}
    }
    res.status(201).json({ success: true, debtor: newDebtor });
  });
  app.put('/api/debtors/:id', async (req, res) => {
    const { id } = req.params;
    const { name, amountOwed, dateLent, dueDate, status, note } = req.body;
    if (!store.debtors) store.debtors = [];
    const debtor = store.debtors.find(d => d.id === id);
    if (!debtor) return res.status(404).json({ error: 'Debtor not found' });
    if (name !== undefined) debtor.name = name.trim();
    if (amountOwed !== undefined) debtor.amountOwed = Number(amountOwed);
    if (dateLent !== undefined) debtor.dateLent = dateLent;
    if (dueDate !== undefined) debtor.dueDate = dueDate;
    if (status !== undefined) debtor.status = status;
    if (note !== undefined) debtor.note = note.trim();
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, debtor });
  });
  app.patch('/api/debtors/:id/mark-paid', (req, res) => {
    const { id } = req.params;
    if (!store.debtors) store.debtors = [];
    const debtor = store.debtors.find(d => d.id === id);
    if (!debtor) return res.status(404).json({ error: 'Debtor not found' });
    debtor.status = debtor.status === 'owing' ? 'paid' : 'owing';
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, debtor });
  });
  app.delete('/api/debtors/:id', (req, res) => {
    const { id } = req.params;
    if (!store.debtors) store.debtors = [];
    const idx = store.debtors.findIndex(d => d.id === id);
    if (idx !== -1) {
      store.debtors.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Debtor not found' });
  });

  // 13. Complete Onboarding in Bulk
  app.post('/api/onboarding', (req, res) => {
    const { profile, catchUp, bankAccounts, debtors } = req.body;
    if (!profile) return res.status(400).json({ error: 'profile is required' });
    const monthlyIncome = Number(profile.monthlyIncome || 0);
    const workDaysPerWeek = Number(profile.workDaysPerWeek || 5);
    const workHoursPerDay = Number(profile.workHoursPerDay || 8);
    const { hourlyRate, dailyRate } = calculateHourlyRate(monthlyIncome, workDaysPerWeek, workHoursPerDay);
    store.profile = {
      ...store.profile,
      name: profile.name || 'User',
      currency: profile.currency || 'NGN',
      currencySymbol: profile.currencySymbol || (profile.currency === 'USD' ? '$' : profile.currency === 'EUR' ? '€' : profile.currency === 'GBP' ? '£' : '₦'),
      monthlyIncome, workDaysPerWeek, workHoursPerDay, hourlyRate, dailyRate,
      onboardingCompleted: true,
    };
    store.expenses = [];
    store.income = [];
    store.categories.forEach(c => { c.spent = 0; });
    if (catchUp) {
      if (catchUp.totalExpenses && Number(catchUp.totalExpenses) > 0) {
        const lumpExp: ExpenseEntry = {
          id: `exp-catchup-${Date.now()}`, amount: Number(catchUp.totalExpenses),
          title: 'Month-to-date Catch-up Expenses', categoryId: 'cat-groceries',
          dateTime: new Date().toISOString(), note: 'Consolidated catch-up balance from onboarding',
        };
        store.expenses.push(lumpExp);
        const cat = store.categories.find(c => c.id === 'cat-groceries');
        if (cat) cat.spent += lumpExp.amount;
      }
      if (catchUp.totalIncome && Number(catchUp.totalIncome) > 0) {
        const lumpInc: IncomeEntry = {
          id: `inc-catchup-${Date.now()}`, amount: Number(catchUp.totalIncome),
          source: 'Catch-up Income (1st of month to today)', category: 'Salary',
          dateTime: new Date().toISOString(), note: 'Consolidated catch-up income',
        };
        store.income.push(lumpInc);
      }
      if (Array.isArray(catchUp.itemizedExpenses)) {
        for (const item of catchUp.itemizedExpenses) {
          if (item.amount > 0) {
            const exp: ExpenseEntry = {
              id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              amount: Number(item.amount), title: item.title || 'Expense',
              categoryId: item.categoryId || 'cat-groceries',
              dateTime: item.dateTime || new Date().toISOString(), note: item.note || '',
            };
            store.expenses.push(exp);
            const cat = store.categories.find(c => c.id === exp.categoryId);
            if (cat) cat.spent += exp.amount;
          }
        }
      }
      if (Array.isArray(catchUp.itemizedIncome)) {
        for (const item of catchUp.itemizedIncome) {
          if (item.amount > 0) {
            const inc: IncomeEntry = {
              id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              amount: Number(item.amount), source: item.source || 'Income',
              category: item.category || 'Income', dateTime: item.dateTime || new Date().toISOString(), note: item.note || '',
            };
            store.income.push(inc);
          }
        }
      }
      if (Array.isArray(catchUp.importedTransactions)) {
        for (const tr of catchUp.importedTransactions) {
          const amt = Math.abs(Number(tr.amount || 0));
          if (amt <= 0) continue;
          const matchedCat = store.categories.find(c => c.name.toLowerCase() === (tr.suggestedCategory || '').toLowerCase()) || store.categories[0];
          if (tr.type === 'expense') {
            const exp: ExpenseEntry = {
              id: `exp-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              amount: amt, title: tr.description || 'Statement Expense', categoryId: matchedCat.id,
              dateTime: tr.date ? new Date(tr.date).toISOString() : new Date().toISOString(),
              note: `Imported from statement (${tr.month || ''})`,
            };
            store.expenses.push(exp);
            matchedCat.spent += amt;
          } else {
            const inc: IncomeEntry = {
              id: `inc-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              amount: amt, source: tr.description || 'Statement Credit', category: tr.suggestedCategory || 'Deposit',
              dateTime: tr.date ? new Date(tr.date).toISOString() : new Date().toISOString(),
              note: `Imported from statement (${tr.month || ''})`,
            };
            store.income.push(inc);
          }
        }
      }
    }
    if (Array.isArray(bankAccounts)) {
      store.bankAccounts = bankAccounts.map((b: any, index: number) => ({
        id: `bank-${Date.now()}-${index}`, bankName: b.bankName || 'Bank', label: b.label || '',
        balance: Number(b.balance || 0), lastUpdated: new Date().toISOString(),
      }));
    } else { store.bankAccounts = []; }
    if (Array.isArray(debtors)) {
      store.debtors = debtors.map((d: any, index: number) => ({
        id: `deb-${Date.now()}-${index}`, name: d.name || 'Debtor', amountOwed: Number(d.amountOwed || 0),
        dateLent: d.dateLent || new Date().toISOString().split('T')[0], dueDate: d.dueDate || undefined,
        status: 'owing', note: d.note || '', createdAt: new Date().toISOString(),
      }));
    } else { store.debtors = []; }
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, store });
  });

  // 14. Gemini Statement Parser
  app.post('/api/gemini/parse-statement', async (req, res) => {
    try {
      const { fileData, mimeType, fileName, existingTransactions } = req.body;
      if (!fileData) return res.status(400).json({ error: 'fileData is required', geminiAvailable: !!process.env.GEMINI_API_KEY });
      const ai = getGenAI();
      const isCsv = mimeType?.includes('csv') || fileName?.endsWith('.csv') || fileData.startsWith('data:text/csv');
      const geminiAvailable = !!ai;
      if (ai) {
        try {
          let contentsPart: any;
          if (fileData.startsWith('data:')) {
            const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              contentsPart = { inlineData: { mimeType: match[1] || 'application/pdf', data: match[2] } };
            } else { contentsPart = { text: fileData }; }
          } else { contentsPart = { text: fileData }; }
          const promptText = `You are a financial parsing expert. Analyze this bank statement document, CSV, or statement image.
CRITICAL REQUIREMENTS:
1. Extract ALL banking transactions.
2. The statement may span MULTIPLE MONTHS or multiple years. You MUST inspect each individual transaction's date (e.g. 2024-03-15, 2024-04-02) and file that transaction under its own correct month in 'YYYY-MM' format (e.g. '2024-03', '2024-04'), NEVER assuming one single month for the whole document.
3. For each transaction, provide:
   - "date": string formatted strictly as "YYYY-MM-DD"
   - "amount": positive number
   - "description": clear merchant or party description
   - "type": "expense" for debits/withdrawals/payments, or "income" for credits/deposits
   - "suggestedCategory": choose the most relevant from:
     ["Groceries", "Business", "Food & Drink", "Transportation", "Utilities", "Education", "Savings", "Pets", "Personal Care", "Hobbies", "Entertainment", "Shopping", "General"]
   - "month": string strictly in "YYYY-MM" format corresponding to the date of that specific transaction.
4. Exclude account summary lines, opening/closing balance rows, fees totals, or page headers.
Return ONLY a valid JSON array of these transaction objects.`;
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [contentsPart, { text: promptText }] },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING }, amount: { type: Type.NUMBER },
                    description: { type: Type.STRING }, type: { type: Type.STRING },
                    suggestedCategory: { type: Type.STRING }, month: { type: Type.STRING },
                  },
                  required: ['date', 'amount', 'description', 'type', 'suggestedCategory', 'month'],
                },
              },
            },
          });
          const rawText = (response as any).text || '[]';
          let parsedTransactions = JSON.parse(rawText);
          if (!Array.isArray(parsedTransactions)) parsedTransactions = [];
          const existingList: any[] = Array.isArray(existingTransactions) ? existingTransactions : [...store.expenses, ...store.income];
          const enriched = parsedTransactions.map((tx: any, idx: number) => {
            const isDup = existingList.some(ex => {
              const exDate = (ex.dateTime || ex.date || '').slice(0, 10);
              const txDate = (tx.date || '').slice(0, 10);
              return exDate === txDate && Math.abs(Math.abs(ex.amount || 0) - Math.abs(tx.amount || 0)) < 0.01;
            });
            return { id: `parsed-${Date.now()}-${idx}`, ...tx, amount: Math.abs(Number(tx.amount) || 0), isDuplicate: isDup, confirmed: !isDup };
          });
          return res.json({ success: true, transactions: enriched, method: 'gemini-2.0-flash', geminiAvailable: true });
        } catch (geminiErr: any) { 
          console.warn('Gemini API parse failed, checking fallback:', geminiErr?.message || geminiErr);
          // Return the actual gemini error to client so UI can show it
          if (String(geminiErr?.message || '').includes('API_KEY') || String(geminiErr?.message || '').includes('not found')) {
            return res.status(502).json({ error: 'Gemini AI error: ' + (geminiErr?.message || 'API key invalid'), geminiAvailable: false, method: 'gemini-error' });
          }
        }
      }
      // No Gemini or Gemini failed -> CSV fallback (only works for real CSV text)
      if (!isCsv && !geminiAvailable) {
        return res.json({ success: true, transactions: [], method: 'no-gemini-no-csv', geminiAvailable: false, warning: 'AI is not configured (GEMINI_API_KEY missing). PDF/Image parsing requires Gemini. Only CSV can be parsed without it. Add GEMINI_API_KEY in .env or Vercel env.' });
      }
      let textContent = fileData;
      if (fileData.startsWith('data:')) {
        const base64 = fileData.split(',')[1];
        if (base64) textContent = Buffer.from(base64, 'base64').toString('utf-8');
      }
      const lines = textContent.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      const fallbackTransactions: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c: string) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 3) {
          const dateStr = cols[0]; const desc = cols[1] || 'Transaction';
          const amountRaw = cols[2] ? parseFloat(cols[2].replace(/[^0-9.-]/g, '')) : 0;
          if (isNaN(amountRaw) || amountRaw === 0) continue;
          const absAmt = Math.abs(amountRaw);
          const parsedDate = new Date(dateStr);
          const validDate = !isNaN(parsedDate.getTime());
          const dateFormatted = validDate ? parsedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          fallbackTransactions.push({
            id: `parsed-fb-${Date.now()}-${i}`, date: dateFormatted, amount: absAmt, description: desc,
            type: amountRaw < 0 ? 'expense' : 'income', suggestedCategory: 'Groceries', month: dateFormatted.slice(0, 7), isDuplicate: false, confirmed: true,
          });
        }
      }
      return res.json({ success: true, transactions: fallbackTransactions, method: 'local-csv-fallback', geminiAvailable, warning: fallbackTransactions.length===0 && !isCsv ? 'Only CSV is supported without Gemini. For PDF/images, set GEMINI_API_KEY.' : undefined });
    } catch (err: any) {
      console.error('Error parsing statement:', err);
      res.status(500).json({ error: err.message || 'Failed to parse statement' });
    }
  });

  // 15. Update Category budget
  app.post('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const cat = store.categories.find(c => c.id === id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const { monthlyBudget } = req.body;
    if (monthlyBudget !== undefined) cat.monthlyBudget = Number(monthlyBudget);
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, category: cat });
  });

  // 16. Reset to default demo data
  app.post('/api/reset', (_req, res) => {
    store = JSON.parse(JSON.stringify(initialDataPayload));
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, store });
  });

  return app;
}

// ── Local dev + production standalone startup ──
// On Vercel, the file is imported via api/index.ts and should NOT listen.
export const app = createApp();

async function startWithVite() {
  const PORT = Number(process.env.PORT || 3000);
  if (process.env.NODE_ENV !== 'production') {
    try {
      // Dynamic import so production bundle (esbuild) can tree-shake vite
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('[dev] Vite middleware not available:', e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'), err => { if (err) next(); });
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`TimeWorth server running on http://0.0.0.0:${PORT} — supabase:${isSupabaseConfigured() ? 'configured' : 'demo-memory'}`);
    });
  }
}

// Only auto-start when executed directly (not imported as Vercel function)
if (!process.env.VERCEL) {
  startWithVite().catch(err => console.error('Failed to start server:', err));
}

export default app;
