import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initialDataPayload } from './src/data/defaultData';
import { AppDataPayload, BankAccount, Debtor, ExpenseEntry, Goal, IncomeEntry, UserProfile } from './src/types';
import { calculateHourlyRate } from './src/utils/timeConversion';

// In-memory data store with persistent initial state
let store: AppDataPayload = JSON.parse(JSON.stringify(initialDataPayload));

// Lazy-initialized Gemini AI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // REST API Endpoints
  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 2. Full application payload (queried by frontend every 10 seconds)
  app.get('/api/data', (req, res) => {
    res.json(store);
  });

  // 3. Update User Profile & calculate rates
  app.post('/api/profile', (req, res) => {
    const updates: Partial<UserProfile> = req.body;
    const current = store.profile;

    const monthlyIncome = updates.monthlyIncome !== undefined ? Number(updates.monthlyIncome) : current.monthlyIncome;
    const workDaysPerWeek = updates.workDaysPerWeek !== undefined ? Number(updates.workDaysPerWeek) : current.workDaysPerWeek;
    const workHoursPerDay = updates.workHoursPerDay !== undefined ? Number(updates.workHoursPerDay) : current.workHoursPerDay;

    const { hourlyRate, dailyRate } = calculateHourlyRate(monthlyIncome, workDaysPerWeek, workHoursPerDay);

    store.profile = {
      ...current,
      ...updates,
      monthlyIncome,
      workDaysPerWeek,
      workHoursPerDay,
      hourlyRate,
      dailyRate,
    };
    store.lastUpdated = new Date().toISOString();

    res.json({ success: true, profile: store.profile });
  });

  // 4. Add Expense
  app.post('/api/expenses', (req, res) => {
    const { amount, title, categoryId, note, dateTime } = req.body;
    if (!amount || !title || !categoryId) {
      return res.status(400).json({ error: 'amount, title, and categoryId are required' });
    }

    const numAmount = Number(amount);
    const newExpense: ExpenseEntry = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      amount: numAmount,
      title,
      categoryId,
      dateTime: dateTime || new Date().toISOString(),
      note: note || '',
    };

    store.expenses.unshift(newExpense);

    // Update category spent total
    const cat = store.categories.find(c => c.id === categoryId);
    if (cat) {
      cat.spent += numAmount;
    }

    store.lastUpdated = new Date().toISOString();
    res.status(201).json({ success: true, expense: newExpense, store });
  });

  // 5. Delete Expense
  app.delete('/api/expenses/:id', (req, res) => {
    const { id } = req.params;
    const idx = store.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      const removed = store.expenses[idx];
      const cat = store.categories.find(c => c.id === removed.categoryId);
      if (cat) {
        cat.spent = Math.max(0, cat.spent - removed.amount);
      }
      store.expenses.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Expense not found' });
  });

  // 6. Add Income
  app.post('/api/income', (req, res) => {
    const { amount, source, category, note, dateTime } = req.body;
    if (!amount || !source) {
      return res.status(400).json({ error: 'amount and source are required' });
    }

    const numAmount = Number(amount);
    const newIncome: IncomeEntry = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      amount: numAmount,
      source,
      category: category || 'Income',
      dateTime: dateTime || new Date().toISOString(),
      note: note || '',
    };

    store.income.unshift(newIncome);
    store.lastUpdated = new Date().toISOString();
    res.status(201).json({ success: true, income: newIncome, store });
  });

  // 7. Delete Income
  app.delete('/api/income/:id', (req, res) => {
    const { id } = req.params;
    const idx = store.income.findIndex(i => i.id === id);
    if (idx !== -1) {
      store.income.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Income not found' });
  });

  // 8. Add Goal
  app.post('/api/goals', (req, res) => {
    const { title, targetAmount, savedAmount, icon, color, section, note } = req.body;
    if (!title || !targetAmount) {
      return res.status(400).json({ error: 'title and targetAmount are required' });
    }

    const newGoal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      targetAmount: Number(targetAmount),
      savedAmount: Number(savedAmount || 0),
      icon: icon || 'Target',
      color: color || '#10B981',
      section: section || 'smart',
      createdAt: new Date().toISOString().split('T')[0],
      note: note || '',
    };

    store.goals.push(newGoal);
    store.lastUpdated = new Date().toISOString();
    res.status(201).json({ success: true, goal: newGoal });
  });

  // 9. Update Goal (contribution or edits)
  app.patch('/api/goals/:id', (req, res) => {
    const { id } = req.params;
    const goal = store.goals.find(g => g.id === id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const { addAmount, savedAmount, targetAmount, title } = req.body;
    if (addAmount !== undefined) {
      goal.savedAmount = Math.min(goal.targetAmount, goal.savedAmount + Number(addAmount));
    }
    if (savedAmount !== undefined) {
      goal.savedAmount = Number(savedAmount);
    }
    if (targetAmount !== undefined) {
      goal.targetAmount = Number(targetAmount);
    }
    if (title !== undefined) {
      goal.title = title;
    }

    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, goal });
  });

  // 10. Delete Goal
  app.delete('/api/goals/:id', (req, res) => {
    const { id } = req.params;
    const idx = store.goals.findIndex(g => g.id === id);
    if (idx !== -1) {
      store.goals.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Goal not found' });
  });

  // 11. Bank Accounts CRUD
  app.post('/api/banks', (req, res) => {
    const { bankName, label, balance } = req.body;
    if (!bankName) {
      return res.status(400).json({ error: 'bankName is required' });
    }

    const newBank: BankAccount = {
      id: `bank-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      bankName: bankName.trim(),
      label: label?.trim() || '',
      balance: Number(balance || 0),
      lastUpdated: new Date().toISOString(),
    };

    if (!store.bankAccounts) store.bankAccounts = [];
    store.bankAccounts.push(newBank);
    store.lastUpdated = new Date().toISOString();

    res.status(201).json({ success: true, bankAccount: newBank });
  });

  app.put('/api/banks/:id', (req, res) => {
    const { id } = req.params;
    const { bankName, label, balance } = req.body;
    if (!store.bankAccounts) store.bankAccounts = [];

    const bank = store.bankAccounts.find(b => b.id === id);
    if (!bank) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    if (bankName !== undefined) bank.bankName = bankName.trim();
    if (label !== undefined) bank.label = label.trim();
    if (balance !== undefined) bank.balance = Number(balance);
    bank.lastUpdated = new Date().toISOString();

    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, bankAccount: bank });
  });

  app.delete('/api/banks/:id', (req, res) => {
    const { id } = req.params;
    if (!store.bankAccounts) store.bankAccounts = [];
    const idx = store.bankAccounts.findIndex(b => b.id === id);
    if (idx !== -1) {
      store.bankAccounts.splice(idx, 1);
      store.lastUpdated = new Date().toISOString();
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Bank account not found' });
  });

  // 12. Debtors CRUD ("People Who Owe You")
  app.post('/api/debtors', (req, res) => {
    const { name, amountOwed, dateLent, dueDate, status, note } = req.body;
    if (!name || amountOwed === undefined) {
      return res.status(400).json({ error: 'name and amountOwed are required' });
    }

    const newDebtor: Debtor = {
      id: `deb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      amountOwed: Number(amountOwed || 0),
      dateLent: dateLent || new Date().toISOString().split('T')[0],
      dueDate: dueDate || undefined,
      status: status === 'paid' ? 'paid' : 'owing',
      note: note?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    if (!store.debtors) store.debtors = [];
    store.debtors.unshift(newDebtor);
    store.lastUpdated = new Date().toISOString();

    res.status(201).json({ success: true, debtor: newDebtor });
  });

  app.put('/api/debtors/:id', (req, res) => {
    const { id } = req.params;
    const { name, amountOwed, dateLent, dueDate, status, note } = req.body;
    if (!store.debtors) store.debtors = [];

    const debtor = store.debtors.find(d => d.id === id);
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

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
    if (!debtor) {
      return res.status(404).json({ error: 'Debtor not found' });
    }

    // Toggle or mark paid
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
    if (!profile) {
      return res.status(400).json({ error: 'profile is required' });
    }

    // Compute rates
    const monthlyIncome = Number(profile.monthlyIncome || 0);
    const workDaysPerWeek = Number(profile.workDaysPerWeek || 5);
    const workHoursPerDay = Number(profile.workHoursPerDay || 8);
    const { hourlyRate, dailyRate } = calculateHourlyRate(monthlyIncome, workDaysPerWeek, workHoursPerDay);

    store.profile = {
      ...store.profile,
      name: profile.name || 'User',
      currency: profile.currency || 'NGN',
      currencySymbol: profile.currencySymbol || (profile.currency === 'USD' ? '$' : profile.currency === 'EUR' ? '€' : profile.currency === 'GBP' ? '£' : '₦'),
      monthlyIncome,
      workDaysPerWeek,
      workHoursPerDay,
      hourlyRate,
      dailyRate,
      onboardingCompleted: true,
    };

    // Reset expenses and income for fresh real user input
    store.expenses = [];
    store.income = [];
    store.categories.forEach(c => { c.spent = 0; });

    // Process Catch-up data if provided
    if (catchUp) {
      // 1. Lump sums (if provided and > 0)
      if (catchUp.totalExpenses && Number(catchUp.totalExpenses) > 0) {
        const lumpExp: ExpenseEntry = {
          id: `exp-catchup-${Date.now()}`,
          amount: Number(catchUp.totalExpenses),
          title: 'Month-to-date Catch-up Expenses',
          categoryId: 'cat-groceries',
          dateTime: new Date().toISOString(),
          note: 'Consolidated catch-up balance from onboarding',
        };
        store.expenses.push(lumpExp);
        const cat = store.categories.find(c => c.id === 'cat-groceries');
        if (cat) cat.spent += lumpExp.amount;
      }

      if (catchUp.totalIncome && Number(catchUp.totalIncome) > 0) {
        const lumpInc: IncomeEntry = {
          id: `inc-catchup-${Date.now()}`,
          amount: Number(catchUp.totalIncome),
          source: 'Catch-up Income (1st of month to today)',
          category: 'Salary',
          dateTime: new Date().toISOString(),
          note: 'Consolidated catch-up income',
        };
        store.income.push(lumpInc);
      }

      // 2. Itemized line items
      if (Array.isArray(catchUp.itemizedExpenses)) {
        for (const item of catchUp.itemizedExpenses) {
          if (item.amount > 0) {
            const exp: ExpenseEntry = {
              id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              amount: Number(item.amount),
              title: item.title || 'Expense',
              categoryId: item.categoryId || 'cat-groceries',
              dateTime: item.dateTime || new Date().toISOString(),
              note: item.note || '',
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
              id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              amount: Number(item.amount),
              source: item.source || 'Income',
              category: item.category || 'Income',
              dateTime: item.dateTime || new Date().toISOString(),
              note: item.note || '',
            };
            store.income.push(inc);
          }
        }
      }

      // 3. Imported statement confirmed transactions
      if (Array.isArray(catchUp.importedTransactions)) {
        for (const tr of catchUp.importedTransactions) {
          const amt = Math.abs(Number(tr.amount || 0));
          if (amt <= 0) continue;

          // Find or match category
          const matchedCat = store.categories.find(c => 
            c.name.toLowerCase() === (tr.suggestedCategory || '').toLowerCase()
          ) || store.categories[0];

          if (tr.type === 'expense') {
            const exp: ExpenseEntry = {
              id: `exp-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              amount: amt,
              title: tr.description || 'Statement Expense',
              categoryId: matchedCat.id,
              dateTime: tr.date ? new Date(tr.date).toISOString() : new Date().toISOString(),
              note: `Imported from statement (${tr.month || ''})`,
            };
            store.expenses.push(exp);
            matchedCat.spent += amt;
          } else {
            const inc: IncomeEntry = {
              id: `inc-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              amount: amt,
              source: tr.description || 'Statement Credit',
              category: tr.suggestedCategory || 'Deposit',
              dateTime: tr.date ? new Date(tr.date).toISOString() : new Date().toISOString(),
              note: `Imported from statement (${tr.month || ''})`,
            };
            store.income.push(inc);
          }
        }
      }
    }

    // Process Bank accounts
    if (Array.isArray(bankAccounts)) {
      store.bankAccounts = bankAccounts.map((b: any, index: number) => ({
        id: `bank-${Date.now()}-${index}`,
        bankName: b.bankName || 'Bank',
        label: b.label || '',
        balance: Number(b.balance || 0),
        lastUpdated: new Date().toISOString(),
      }));
    } else {
      store.bankAccounts = [];
    }

    // Process Debtors
    if (Array.isArray(debtors)) {
      store.debtors = debtors.map((d: any, index: number) => ({
        id: `deb-${Date.now()}-${index}`,
        name: d.name || 'Debtor',
        amountOwed: Number(d.amountOwed || 0),
        dateLent: d.dateLent || new Date().toISOString().split('T')[0],
        dueDate: d.dueDate || undefined,
        status: 'owing',
        note: d.note || '',
        createdAt: new Date().toISOString(),
      }));
    } else {
      store.debtors = [];
    }

    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, store });
  });

  // 14. Gemini Statement Parser endpoint
  app.post('/api/gemini/parse-statement', async (req, res) => {
    try {
      const { fileData, mimeType, fileName, existingTransactions } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: 'fileData is required' });
      }

      const ai = getGenAI();

      // Check if fileData is CSV text or if we can parse CSV directly
      const isCsv = mimeType?.includes('csv') || fileName?.endsWith('.csv') || fileData.startsWith('data:text/csv');

      if (ai) {
        try {
          let contentsPart: any;
          if (fileData.startsWith('data:')) {
            // Extract base64 payload & mime
            const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const detectedMime = match[1];
              const base64Str = match[2];
              contentsPart = {
                inlineData: {
                  mimeType: detectedMime || 'application/pdf',
                  data: base64Str,
                },
              };
            } else {
              contentsPart = { text: fileData };
            }
          } else {
            contentsPart = { text: fileData };
          }

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
            model: 'gemini-3.8-flash',
            contents: {
              parts: [contentsPart, { text: promptText }],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING },
                    suggestedCategory: { type: Type.STRING },
                    month: { type: Type.STRING },
                  },
                  required: ['date', 'amount', 'description', 'type', 'suggestedCategory', 'month'],
                },
              },
            },
          });

          const rawText = response.text || '[]';
          let parsedTransactions = JSON.parse(rawText);

          // Ensure array format
          if (!Array.isArray(parsedTransactions)) {
            parsedTransactions = [];
          }

          // Duplicate detection against existing user transactions
          const existingList: any[] = Array.isArray(existingTransactions) ? existingTransactions : [...store.expenses, ...store.income];
          const enriched = parsedTransactions.map((tx: any, idx: number) => {
            const isDup = existingList.some(ex => {
              const exDate = (ex.dateTime || ex.date || '').slice(0, 10);
              const txDate = (tx.date || '').slice(0, 10);
              const exAmt = Math.abs(ex.amount || 0);
              const txAmt = Math.abs(tx.amount || 0);
              return exDate === txDate && Math.abs(exAmt - txAmt) < 0.01;
            });

            return {
              id: `parsed-${Date.now()}-${idx}`,
              ...tx,
              amount: Math.abs(Number(tx.amount) || 0),
              isDuplicate: isDup,
              confirmed: !isDup, // auto-select non-duplicates
            };
          });

          return res.json({
            success: true,
            transactions: enriched,
            method: 'gemini-3.8-flash',
          });
        } catch (geminiErr) {
          console.warn('Gemini API parse failed, checking fallback:', geminiErr);
        }
      }

      // Fallback CSV Parser if Gemini API is unavailable or for simple CSV files
      let textContent = fileData;
      if (fileData.startsWith('data:')) {
        const base64 = fileData.split(',')[1];
        if (base64) {
          textContent = Buffer.from(base64, 'base64').toString('utf-8');
        }
      }

      const lines = textContent.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      const fallbackTransactions: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c: string) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 3) {
          const dateStr = cols[0];
          const desc = cols[1] || 'Transaction';
          const amountRaw = cols[2] ? parseFloat(cols[2].replace(/[^0-9.-]/g, '')) : 0;
          if (isNaN(amountRaw) || amountRaw === 0) continue;

          const isNegative = amountRaw < 0;
          const absAmt = Math.abs(amountRaw);
          const parsedDate = new Date(dateStr);
          const validDate = !isNaN(parsedDate.getTime());
          const dateFormatted = validDate ? parsedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          const monthStr = dateFormatted.slice(0, 7);

          fallbackTransactions.push({
            id: `parsed-fb-${Date.now()}-${i}`,
            date: dateFormatted,
            amount: absAmt,
            description: desc,
            type: isNegative ? 'expense' : 'income',
            suggestedCategory: 'Groceries',
            month: monthStr,
            isDuplicate: false,
            confirmed: true,
          });
        }
      }

      return res.json({
        success: true,
        transactions: fallbackTransactions,
        method: 'local-csv-fallback',
      });
    } catch (err: any) {
      console.error('Error parsing statement:', err);
      res.status(500).json({ error: err.message || 'Failed to parse statement' });
    }
  });

  // 15. Update Category budget
  app.post('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const cat = store.categories.find(c => c.id === id);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const { monthlyBudget } = req.body;
    if (monthlyBudget !== undefined) {
      cat.monthlyBudget = Number(monthlyBudget);
    }
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, category: cat });
  });

  // 16. Reset to default demo data
  app.post('/api/reset', (req, res) => {
    store = JSON.parse(JSON.stringify(initialDataPayload));
    store.lastUpdated = new Date().toISOString();
    res.json({ success: true, store });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TimeWorth server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

