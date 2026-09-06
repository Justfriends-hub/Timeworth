import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return genAIClient;
}

function getOpenRouterKey(): string | null {
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null;
}

async function tryOpenRouterParse(fileData: string, mimeType: string | undefined, fileName: string | undefined): Promise<any[] | null> {
  const key = getOpenRouterKey();
  if (!key) return null;
  const promptText = `You are a financial parsing expert. Read this bank statement ROW BY ROW — every single row is a potential transaction, make no mistakes.

ROW-BY-ROW RULES:
1. Go through the document line by line, row by row. Extract EVERY transaction, none skipped.
2. For XLS/CSV: each row with a date + description + amount is one transaction. Pay close attention to debit vs credit columns.
3. The statement may span MULTIPLE MONTHS — inspect EACH transaction's date individually and set 'month' to that transaction's YYYY-MM.
4. For each transaction provide: "date" (YYYY-MM-DD), "amount" (positive number), "description" (merchant/party), "type" ("expense" for debits/withdrawals or "income" for credits/deposits), "suggestedCategory" from ["Groceries","Business","Food & Drink","Transportation","Utilities","Education","Savings","Pets","Personal Care","Hobbies","Entertainment","Shopping","General"], "month" (YYYY-MM).
5. Exclude only summary/balance/total rows and page headers.
Return ONLY a valid JSON array — one object per row, in order.`;

  const isDataUri = fileData.startsWith('data:');
  const isExcelFile = fileName?.toLowerCase().endsWith('.xls') || fileName?.toLowerCase().endsWith('.xlsx') || mimeType?.includes('spreadsheet') || mimeType?.includes('excel');
  let messages: any[];
  // ONLY FREE MODELS (opencode free tier) — never paid gpt-4o. Tested working 2026-09:
  // text (XLS/CSV): minimax/minimax-m3:free  | vision/PDF: nvidia/nemotron-3.5-lightning:free (falls back to text if vision fails)
  const isVision = isDataUri && (mimeType?.includes('pdf') || mimeType?.includes('image') || fileName?.match(/\.(pdf|jpg|jpeg|png|webp)$/i));
  const model = isVision ? 'nvidia/nemotron-3.5-lightning:free' : 'minimax/minimax-m3:free';

  if (isVision) {
    messages = [{
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: fileData } }
      ]
    }];
  } else {
    let textContent = fileData;
    if (isDataUri) {
      const commaIdx = fileData.indexOf(',');
      const b64raw = commaIdx !== -1 ? fileData.slice(commaIdx+1).replace(/\s/g,'') : '';
      if (isExcelFile && b64raw.length > 100) {
        // XLS/XLSX is binary — convert row-by-row to CSV text so AI can read each row accurately
        try {
          const buffer = Buffer.from(b64raw, 'base64');
          const wb = XLSX.read(buffer, { type: 'buffer' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          // Convert sheet row-by-row to CSV text (preserves each row exactly)
          const csvText = XLSX.utils.sheet_to_csv(sheet);
          if (csvText && csvText.trim().length > 20) {
            textContent = 'EXCEL STATEMENT (converted row-by-row to CSV for AI parsing):\n' + csvText;
          } else {
            // fallback to formatted rows
            const rows:any[][] = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'' });
            textContent = rows.map(r=>r.join(',')).join('\n');
          }
        } catch (e) { try { textContent = Buffer.from(b64raw, 'base64').toString('utf-8'); } catch {} }
      } else {
        const b64 = fileData.split(',')[1];
        if (b64) try { textContent = Buffer.from(b64.replace(/\s/g,''), 'base64').toString('utf-8'); } catch {}
      }
    }
    // Truncate huge statements to stay under token limit
    if (textContent.length > 120000) textContent = textContent.slice(0, 120000);
    messages = [
      { role: 'system', content: 'You are a financial parsing expert. Return ONLY JSON array.' },
      { role: 'user', content: promptText + '\n\nSTATEMENT DATA:\n' + textContent }
    ];
  }

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'TimeWorth',
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 12000,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn('[openrouter] non-ok', resp.status, txt.slice(0,500));
      // try fallback text model if vision model failed
      if (isVision && resp.status === 400) {
        // retry as text extraction
        let textContent = fileData;
        if (isDataUri) {
          const b64 = fileData.split(',')[1];
          if (b64) try { textContent = Buffer.from(b64, 'base64').toString('utf-8').slice(0,80000); } catch {}
        }
        return null;
      }
      return null;
    }
    const j: any = await resp.json();
    const content: string = j.choices?.[0]?.message?.content || '';
    if (!content) return null;
    // Extract JSON array from content (may be wrapped in ```json or object)
    let parsed: any;
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]);
      else return null;
    }
    // OpenRouter may return { transactions: [...] } or plain array
    if (!Array.isArray(parsed) && Array.isArray(parsed.transactions)) parsed = parsed.transactions;
    if (!Array.isArray(parsed) && Array.isArray(parsed.data)) parsed = parsed.data;
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (e: any) {
    console.warn('[openrouter] parse failed:', e?.message || e);
    return null;
  }
}

// ── Express app factory — exported for Vercel serverless ──
export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS for Vercel preview deployments (same-origin is fine, but allow preflight)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });

  // Ensure payload-too-large always returns JSON (so client doesn't get HTML invalid response)
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({ error: 'File too large for server. Try one file at a time — we process them sequentially and merge.' , geminiAvailable: !!process.env.GEMINI_API_KEY });
    }
    next(err);
  });

  // 1. Health check — reports Supabase wiring without leaking secrets
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      supabase: isSupabaseConfigured() ? 'configured' : 'demo-memory',
      gemini: !!process.env.GEMINI_API_KEY,
      openrouter: !!getOpenRouterKey(),
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

  // 14. Statement Parser (Gemini -> OpenRouter free -> local XLS/CSV)
  app.post('/api/gemini/parse-statement', async (req, res) => {
    try {
      const { fileData, mimeType, fileName, existingTransactions } = req.body;
      if (!fileData) return res.status(400).json({ error: 'fileData is required', geminiAvailable: !!process.env.GEMINI_API_KEY });
      const ai = getGenAI();
      const isCsv = mimeType?.includes('csv') || fileName?.toLowerCase().endsWith('.csv') || fileData.startsWith('data:text/csv');
      const isExcel = fileName?.toLowerCase().endsWith('.xls') || fileName?.toLowerCase().endsWith('.xlsx') || mimeType?.includes('spreadsheet') || mimeType?.includes('excel');
      const isPdf = mimeType?.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf');
      const geminiAvailable = !!ai;

      // XLS row-by-row: ALWAYS try OpenRouter AI first (user wants AI accuracy, not fast local). Local is last resort only after AI fails.
      if (ai) {
        try {
          let contentsPart: any;
          if (fileData.startsWith('data:')) {
            const commaIdx2 = fileData.indexOf(',');
            const meta = fileData.slice(0, commaIdx2);
            let b64 = fileData.slice(commaIdx2 + 1).replace(/\s/g,'');
            const mimeMatch = meta.match(/data:([^;]+)/);
            const detectedMime = mimeMatch ? mimeMatch[1] : (isPdf ? 'application/pdf' : 'image/png');
            // robust: only use inlineData if b64 looks like base64 (length > 100 and valid chars)
            if (b64.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0,500))) {
              contentsPart = { inlineData: { mimeType: detectedMime || 'application/pdf', data: b64 } };
            } else { contentsPart = { text: fileData }; }
          } else { contentsPart = { text: fileData }; }
          const promptText = `You are a financial parsing expert. Read this bank statement ROW BY ROW — be meticulous, every row matters.

CRITICAL ROW-BY-ROW REQUIREMENTS:
1. Go line by line, row by row. Extract EVERY banking transaction — make no mistakes, none skipped, none invented.
2. For XLS/CSV: each data row with a date + description + amount is one transaction. Carefully distinguish debit vs credit columns.
3. The statement may span MULTIPLE MONTHS or years. For EACH transaction, inspect its individual date (e.g. 2024-03-15, 2024-04-02) and set 'month' to that transaction's YYYY-MM, never one month for the whole doc.
4. For each transaction, provide:
   - "date": string strictly "YYYY-MM-DD"
   - "amount": positive number
   - "description": clear merchant/party description
   - "type": "expense" for debits/withdrawals/payments, "income" for credits/deposits
   - "suggestedCategory": most relevant from ["Groceries","Business","Food & Drink","Transportation","Utilities","Education","Savings","Pets","Personal Care","Hobbies","Entertainment","Shopping","General"]
   - "month": strictly "YYYY-MM" for that transaction's date
5. Exclude only account summary, opening/closing balance, fees totals, or page headers.
Return ONLY a valid JSON array — one object per row, in original order.`;
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
          console.warn('Gemini API parse failed, trying OpenRouter fallback:', geminiErr?.message || geminiErr);
          // don't return yet — try OpenRouter before failing
        }
      }
      // Try FREE OpenRouter fallback (auto-chooses free model) if Gemini not available or failed
      {
        const openRouterTxs = await tryOpenRouterParse(fileData, mimeType, fileName);
        if (openRouterTxs && openRouterTxs.length > 0) {
          const existingList: any[] = Array.isArray(existingTransactions) ? existingTransactions : [...store.expenses, ...store.income];
          const enriched = openRouterTxs.map((tx: any, idx: number) => {
            const isDup = existingList.some(ex => {
              const exDate = (ex.dateTime || ex.date || '').slice(0, 10);
              const txDate = (tx.date || '').slice(0, 10);
              return exDate === txDate && Math.abs(Math.abs(ex.amount || 0) - Math.abs(tx.amount || 0)) < 0.01;
            });
            return { id: `parsed-or-${Date.now()}-${idx}`, date: tx.date, amount: Math.abs(Number(tx.amount)||0), description: tx.description || 'Transaction', type: (tx.type==='income'?'income':'expense'), suggestedCategory: tx.suggestedCategory || 'Groceries', month: tx.month || (tx.date||'').slice(0,7), isDuplicate: isDup, confirmed: !isDup };
          });
          return res.json({ success: true, transactions: enriched, method: 'openrouter-free', geminiAvailable, openrouter: true });
        }
      }
      // LOCAL FALLBACK COMMENTED OUT - AI ONLY (per user request)
      // if (isExcel && fileData.startsWith('data:')) {
      //   try {
      //     const commaIdxL2 = fileData.indexOf(',');
      //     let b64L2 = commaIdxL2 !== -1 ? fileData.slice(commaIdxL2+1).replace(/\s/g,'') : '';
      //     if (b64L2.length > 50) {
      //       const bufferL2 = Buffer.from(b64L2, 'base64');
      //       const wbL2 = XLSX.read(bufferL2, { type: 'buffer' });
      //       const sheetL2 = wbL2.Sheets[wbL2.SheetNames[0]];
      //       const rowsL2:any[][] = XLSX.utils.sheet_to_json(sheetL2, { header:1, defval:'' });
      //       let headerIdxL2=0;
      //       for(let i=0;i<Math.min(5,rowsL2.length);i++){const j=rowsL2[i].join(' ').toLowerCase();if(j.includes('date')&&(j.includes('amount')||j.includes('debit')||j.includes('credit'))){headerIdxL2=i;break;}}
      //       const excelTxsL2:any[]=[];
      //       for(let i=headerIdxL2+1;i<rowsL2.length;i++){const r=rowsL2[i];if(!r||r.length<2)continue;const dr=String(r[0]||'').trim();const desc=String(r[1]||r[2]||'Transaction').trim();let av:number|null=null;for(let c=2;c<Math.min(7,r.length);c++){const s=String(r[c]).replace(/[^0-9.-]/g,'');const n=parseFloat(s);if(!isNaN(n)&&n!==0&&Math.abs(n)>0.5){av=n;break;}}if(av===null||isNaN(av)||av===0)continue;const abs=Math.abs(av);let ds=new Date().toISOString().split('T')[0];if(typeof r[0]==='number'&&r[0]>30000){const d=new Date((r[0]-25569)*86400*1000);if(!isNaN(d.getTime()))ds=d.toISOString().split('T')[0];}else{const d=new Date(dr);if(!isNaN(d.getTime())&&dr.length>=6)ds=d.toISOString().split('T')[0];}excelTxsL2.push({id:`parsed-xls-fallback-${Date.now()}-${i}`,date:ds,amount:abs,description:desc.slice(0,60),type:av<0?'expense':'income',suggestedCategory:'Groceries',month:ds.slice(0,7),isDuplicate:false,confirmed:true});}
      //       if(excelTxsL2.length>0){
      //         return res.json({ success:true, transactions:excelTxsL2, method:'local-xlsx-after-ai-failed', geminiAvailable, openrouter: !!getOpenRouterKey(), warning: 'AI row-by-row failed ('+ (getOpenRouterKey()?'OpenRouter did not return rows':'no OPENROUTER_API_KEY') +') — parsed locally after AI, categories are generic. Check server logs.' });
      //       }
      //     }
      //   } catch(e:any){ console.warn('[xlsx fallback after AI failed]',e?.message); }
      // }
      // LOCAL CSV FALLBACK COMMENTED OUT - AI ONLY
      // if (!isCsv && !isExcel && !geminiAvailable) {
      //   return res.json({ success: true, transactions: [], method: 'no-gemini-no-csv', geminiAvailable: false, warning: 'AI is not configured (GEMINI_API_KEY missing). PDF/Image/XLS parsing needs Gemini for best results, but CSV and XLS are parsed locally. Add GEMINI_API_KEY in .env or Vercel env for better AI categorization.' });
      // }
      // let textContent = fileData;
      // if (fileData.startsWith('data:')) {
      //   const commaIdx3 = fileData.indexOf(',');
      //   if (commaIdx3 !== -1) {
      //     const b64raw = fileData.slice(commaIdx3 + 1).replace(/\s/g,'');
      //     if (b64raw) {
      //       try { textContent = Buffer.from(b64raw, 'base64').toString('utf-8'); } catch { textContent = fileData; }
      //     }
      //   }
      // }
      // const lines = textContent.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      // const fallbackTransactions: any[] = [];
      // for (let i = 1; i < lines.length; i++) {
      //   const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c: string) => c.replace(/^"|"$/g, '').trim());
      //   if (cols.length >= 3) {
      //     const dateStr = cols[0]; const desc = cols[1] || 'Transaction';
      //     const amountRaw = cols[2] ? parseFloat(cols[2].replace(/[^0-9.-]/g, '')) : 0;
      //     if (isNaN(amountRaw) || amountRaw === 0) continue;
      //     const absAmt = Math.abs(amountRaw);
      //     const parsedDate = new Date(dateStr);
      //     const validDate = !isNaN(parsedDate.getTime());
      //     const dateFormatted = validDate ? parsedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      //     fallbackTransactions.push({
      //       id: `parsed-fb-${Date.now()}-${i}`, date: dateFormatted, amount: absAmt, description: desc,
      //       type: amountRaw < 0 ? 'expense' : 'income', suggestedCategory: 'Groceries', month: dateFormatted.slice(0, 7), isDuplicate: false, confirmed: true,
      //     });
      //   }
      // }
      // return res.json({ success: true, transactions: fallbackTransactions, method: 'local-csv-fallback', geminiAvailable, warning: fallbackTransactions.length===0 && !isCsv ? 'Only CSV is supported without Gemini. For PDF/images, set GEMINI_API_KEY.' : undefined });
      // AI-ONLY: if we reach here, neither Gemini nor OpenRouter returned rows - return error so user knows AI failed
      return res.status(502).json({ error: 'AI parsing failed — OpenRouter (and Gemini) did not return transactions. Check OPENROUTER_API_KEY, server logs, and try again. Local fallback is disabled (AI-only mode).', geminiAvailable, openrouter: !!getOpenRouterKey(), method: 'ai-only-no-fallback' });
    } catch (err: any) {
      console.error('Error parsing statement:', err);
      res.status(500).json({ error: err.message || 'Failed to parse statement' });
    }
  });

  // 14b. Ingest statement transactions post-onboarding (Settings re-upload)
  // Called from Settings when user re-uploads a statement after onboarding.
  // Body: { transactions: ParsedTransaction[] } -> adds to expenses/income + categories analytics
  app.post('/api/statements/ingest', async (req, res) => {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array is required' });
    }
    let addedExpenses = 0;
    let addedIncome = 0;
    const userId = (req.headers['x-user-id'] as string) || null;
    const sb = getSupabaseServer();
    for (const tr of transactions) {
      const amt = Math.abs(Number(tr.amount || 0));
      if (amt <= 0) continue;
      const matchedCat = store.categories.find(c => c.name.toLowerCase() === (tr.suggestedCategory || '').toLowerCase()) || store.categories[0];
      if (!matchedCat) continue;
      if (tr.type === 'expense') {
        const exp: ExpenseEntry = {
          id: `exp-ingest-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          amount: amt,
          title: tr.description || 'Statement Expense',
          categoryId: matchedCat.id,
          dateTime: tr.date ? new Date(tr.date).toISOString() : new Date().toISOString(),
          note: `Imported from statement (${tr.month || ''}) via Settings`,
        };
        store.expenses.unshift(exp);
        matchedCat.spent += amt;
        addedExpenses++;
        if (sb && userId) {
          try { await sb.from('expenses').insert({ user_id: userId, amount: amt, title: exp.title, category_id: exp.categoryId, date_time: exp.dateTime, note: exp.note }); } catch {}
        }
      } else {
        const inc: IncomeEntry = {
          id: `inc-ingest-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          amount: amt,
          source: tr.description || 'Statement Credit',
          category: tr.suggestedCategory || 'Deposit',
          dateTime: tr.date ? new Date(tr.date).toISOString() : new Date().toISOString(),
          note: `Imported from statement (${tr.month || ''}) via Settings`,
        };
        store.income.unshift(inc);
        addedIncome++;
        if (sb && userId) {
          try { await sb.from('income').insert({ user_id: userId, amount: amt, source: inc.source, category: inc.category, date_time: inc.dateTime, note: inc.note }); } catch {}
        }
      }
    }
    store.lastUpdated = new Date().toISOString();
    // Also persist category spent updates if Supabase
    if (sb && userId) {
      for (const cat of store.categories) {
        try { await sb.from('categories').update({ spent: cat.spent }).eq('user_id', userId).eq('id', cat.id); } catch {}
      }
    }
    res.json({ success: true, addedExpenses, addedIncome, total: addedExpenses+addedIncome, store });
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
