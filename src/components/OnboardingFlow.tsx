import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CurrencyCode, UserProfile } from '../types';
import { calculateHourlyRate, convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  UploadCloud,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  ShieldCheck,
  Zap,
  TrendingUp,
  Wallet,
  AlertTriangle,
  FileSpreadsheet,
  Image as ImageIcon
} from 'lucide-react';

interface ParsedTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'expense' | 'income';
  suggestedCategory: string;
  month: string;
  isDuplicate?: boolean;
  confirmed: boolean;
}

interface ItemizedEntry {
  id: string;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  categoryId: string;
  dateTime: string;
  note?: string;
}

export const OnboardingFlow: React.FC = () => {
  const { categories, completeOnboarding, user } = useApp();

  // Phase: 'signup' | 0 | 1 | 2 | 3 | 4 | 5 | 6
  const [currentStep, setCurrentStep] = useState<number | 'signup'>(() => (user ? 0 : 'signup'));

  // Sign Up Form State
  const [signupName, setSignupName] = useState(user?.user_metadata?.name || user?.email?.split('@')[0] || '');
  const [signupEmail, setSignupEmail] = useState(user?.email || '');
  const [signupPassword, setSignupPassword] = useState('');

  // Step 0: Slide index (0, 1, 2)
  const [slideIndex, setSlideIndex] = useState(0);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');
  const currencySymbol = useMemo(() => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '₦';
    }
  }, [currency]);

  // Step 2: Income & Work Schedule
  const [monthlyIncomeStr, setMonthlyIncomeStr] = useState('450000');
  const [workHoursPerDay, setWorkHoursPerDay] = useState<number>(8);
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState<number>(5);

  const monthlyIncome = parseFloat(monthlyIncomeStr) || 0;
  const { hourlyRate, dailyRate } = useMemo(() => {
    return calculateHourlyRate(monthlyIncome, workDaysPerWeek, workHoursPerDay);
  }, [monthlyIncome, workDaysPerWeek, workHoursPerDay]);

  // Temporary profile for time conversion in onboarding
  const tempProfile: UserProfile = useMemo(() => ({
    name: name || 'User',
    monthlyIncome,
    workHoursPerDay,
    workDaysPerWeek,
    currency,
    currencySymbol,
    hourlyRate,
    dailyRate,
    showAmountsInTime: true,
    timePrimary: false,
    onboardingCompleted: false,
  }), [name, monthlyIncome, workHoursPerDay, workDaysPerWeek, currency, currencySymbol, hourlyRate, dailyRate]);

  // Step 3: Catch-up Entry
  // Option A: Manual
  const [manualIncomeStr, setManualIncomeStr] = useState('');
  const [manualExpenseStr, setManualExpenseStr] = useState('');
  const [useItemized, setUseItemized] = useState(false);
  const [itemizedList, setItemizedList] = useState<ItemizedEntry[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');
  const [newCatId, setNewCatId] = useState('cat-groceries');

  // Option B: Import Statement
  const [isParsingStatement, setIsParsingStatement] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importedTransactions, setImportedTransactions] = useState<ParsedTransaction[]>([]);
  const [importedFileNames, setImportedFileNames] = useState<string[]>([]);
  const [aiEstimatedIncome, setAiEstimatedIncome] = useState<number | null>(null);

  // Estimate monthly income from parsed income transactions (avg per month)
  const computeAiEstimate = (txs: ParsedTransaction[]) => {
    const incomeByMonth: Record<string, number> = {};
    txs.filter(t => t.type === 'income').forEach(t => {
      const m = t.month || t.date.slice(0,7);
      incomeByMonth[m] = (incomeByMonth[m] || 0) + t.amount;
    });
    const months = Object.keys(incomeByMonth);
    if (months.length === 0) return null;
    const total = Object.values(incomeByMonth).reduce((a,b)=>a+b,0);
    return Math.round(total / months.length);
  };

  // Step 4: Bank Accounts
  const [bankRows, setBankRows] = useState<Array<{ id: string; bankName: string; label: string; balance: string }>>([
    { id: 'bank-init-1', bankName: '', label: 'Checking / Salary', balance: '' },
  ]);

  // Step 5: Debtors
  const [debtorRows, setDebtorRows] = useState<Array<{ id: string; name: string; amountOwed: string; dateLent: string; dueDate: string; note: string }>>([]);

  // Submitting final onboarding
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handlers
  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) return;
    setName(signupName.trim());
    setCurrentStep(0);
  };

  // Step 3: Add Itemized Line Item
  const handleAddItemized = () => {
    const val = parseFloat(newAmount) || 0;
    if (!newTitle.trim() || val <= 0) return;
    setItemizedList(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: newTitle.trim(),
        amount: val,
        type: newType,
        categoryId: newCatId,
        dateTime: new Date().toISOString(),
      },
    ]);
    setNewTitle('');
    setNewAmount('');
  };

  const handleRemoveItemized = (id: string) => {
    setItemizedList(prev => prev.filter(item => item.id !== id));
  };

  // Step 3: Handle Statement File Upload (supports MULTIPLE files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsParsingStatement(true);
    setParseError(null);
    setImportedFileNames(files.map(f => f.name));

    const readFileAsData = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read ' + file.name));
      if (file.name.endsWith('.csv') || file.type.includes('csv')) reader.readAsText(file);
      else reader.readAsDataURL(file);
    });

    try {
      let allTxs: ParsedTransaction[] = [...importedTransactions];
      for (const file of files) {
        const fileData = await readFileAsData(file);
        const res = await fetch('/api/gemini/parse-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData,
            mimeType: file.type || 'text/plain',
            fileName: file.name,
            existingTransactions: allTxs,
          }),
        });
        if (!res.ok) throw new Error(`Failed to parse ${file.name} with Gemini AI`);
        const data = await res.json();
        if (data.transactions && Array.isArray(data.transactions)) {
          // Merge, de-dupe by date+amount+desc
          const newTxs: ParsedTransaction[] = data.transactions;
          for (const tx of newTxs) {
            const isDup = allTxs.some(ex => ex.date === tx.date && Math.abs(ex.amount - tx.amount) < 0.01 && ex.description === tx.description);
            if (!isDup) allTxs.push(tx);
            else {
              // mark duplicate but still keep one
              allTxs.push({ ...tx, isDuplicate: true, confirmed: false });
            }
          }
        }
      }
      setImportedTransactions(allTxs);
      const est = computeAiEstimate(allTxs);
      if (est) setAiEstimatedIncome(est);
      if (allTxs.length === 0) setParseError('No transactions could be parsed from the selected files.');
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Error parsing statements');
    } finally {
      setIsParsingStatement(false);
      // reset input so same files can be re-selected + allow adding more
      e.target.value = '';
    }
  };

  const handleToggleConfirmTransaction = (id: string) => {
    setImportedTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, confirmed: !t.confirmed } : t))
    );
  };

  const handleConfirmAllTransactions = () => {
    setImportedTransactions(prev => prev.map(t => ({ ...t, confirmed: true })));
  };

  const handleDiscardAllTransactions = () => {
    setImportedTransactions(prev => prev.map(t => ({ ...t, confirmed: false })));
  };

  // Step 4: Bank Rows
  const handleAddBankRow = () => {
    setBankRows(prev => [
      ...prev,
      { id: `bank-${Date.now()}-${prev.length}`, bankName: '', label: '', balance: '' },
    ]);
  };

  const handleRemoveBankRow = (id: string) => {
    setBankRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateBankRow = (id: string, field: 'bankName' | 'label' | 'balance', value: string) => {
    setBankRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const totalBankBalance = useMemo(() => {
    return bankRows.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);
  }, [bankRows]);

  // Step 5: Debtor Rows
  const handleAddDebtorRow = () => {
    setDebtorRows(prev => [
      ...prev,
      {
        id: `deb-${Date.now()}-${prev.length}`,
        name: '',
        amountOwed: '',
        dateLent: new Date().toISOString().split('T')[0],
        dueDate: '',
        note: '',
      },
    ]);
  };

  const handleRemoveDebtorRow = (id: string) => {
    setDebtorRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateDebtorRow = (id: string, field: 'name' | 'amountOwed' | 'dateLent' | 'dueDate' | 'note', value: string) => {
    setDebtorRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const totalDebtorOwed = useMemo(() => {
    return debtorRows.reduce((sum, d) => sum + (parseFloat(d.amountOwed) || 0), 0);
  }, [debtorRows]);

  // Finish Onboarding
  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const validBanks = bankRows
        .filter(b => b.bankName.trim() && parseFloat(b.balance) >= 0)
        .map(b => ({
          bankName: b.bankName.trim(),
          label: b.label.trim(),
          balance: parseFloat(b.balance) || 0,
        }));

      const validDebtors = debtorRows
        .filter(d => d.name.trim() && parseFloat(d.amountOwed) > 0)
        .map(d => ({
          name: d.name.trim(),
          amountOwed: parseFloat(d.amountOwed) || 0,
          dateLent: d.dateLent || new Date().toISOString().split('T')[0],
          dueDate: d.dueDate || undefined,
          note: d.note.trim(),
        }));

      const confirmedImported = importedTransactions.filter(t => t.confirmed);

      const catchUpPayload = {
        totalExpenses: parseFloat(manualExpenseStr) || 0,
        totalIncome: parseFloat(manualIncomeStr) || 0,
        itemizedExpenses: itemizedList.filter(i => i.type === 'expense'),
        itemizedIncome: itemizedList.filter(i => i.type === 'income'),
        importedTransactions: confirmedImported,
      };

      await completeOnboarding({
        profile: {
          name: name.trim() || 'User',
          currency,
          currencySymbol,
          monthlyIncome: monthlyIncome > 0 ? monthlyIncome : (aiEstimatedIncome || monthlyIncome),
          workDaysPerWeek,
          workHoursPerDay,
        },
        catchUp: catchUpPayload,
        bankAccounts: validBanks,
        debtors: validDebtors,
      });
    } catch (e) {
      console.error('Failed to complete onboarding:', e);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col">
        
        {/* Step Indicator Header */}
        {currentStep !== 'signup' && (
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                {currentStep}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {currentStep === 0 && 'How It Works'}
                {currentStep === 1 && 'Basics'}
                {currentStep === 2 && 'Work Schedule & Rates'}
                {currentStep === 3 && 'Catch-up & Statements'}
                {currentStep === 4 && 'Bank Accounts'}
                {currentStep === 5 && 'People Who Owe You'}
                {currentStep === 6 && 'Review & Launch'}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-400">
              Step {currentStep} of 6
            </div>
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="p-6 sm:p-8 flex-1">

          {/* SIGN UP SCREEN */}
          {currentStep === 'signup' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
                  <Clock className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Welcome to TimeWorth
                </h1>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Every naira spent or earned converted into <strong>hours worked</strong>. Create your account to begin.
                </p>
              </div>

              <form onSubmit={handleSignUpSubmit} className="space-y-4 max-w-sm mx-auto">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    placeholder="e.g. Molly or Tunde"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>Create Account & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 0: HOW IT WORKS (2-3 Slides with visible EXAMPLE badges only, skippable) */}
          {currentStep === 0 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                  Concept Intro ({slideIndex + 1}/3)
                </span>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                >
                  Skip to Setup
                </button>
              </div>

              {/* Slide Carousel */}
              {slideIndex === 0 && (
                <div className="space-y-4">
                  <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-3 relative overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      Example
                    </div>
                    <h3 className="text-xl font-black">Money Is Actually Life Energy</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Say you earn ₦350,000 every month working 40 hours a week. Your effective earning rate is:
                    </p>
                    <div className="p-3 bg-white/10 rounded-2xl flex items-center justify-between font-mono">
                      <span className="text-xs text-slate-300">Effective Rate:</span>
                      <span className="text-base font-extrabold text-emerald-400">≈ ₦2,020 / hour</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Every number here is an illustrative example and is never saved to your account.
                  </p>
                </div>
              )}

              {slideIndex === 1 && (
                <div className="space-y-4">
                  <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-3 relative overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      Example
                    </div>
                    <h3 className="text-xl font-black">Reframe Every Purchase</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Instead of thinking: "A dinner delivery costs ₦10,000", TimeWorth reveals:
                    </p>
                    <div className="p-4 bg-white/10 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-slate-200">Dinner Delivery (₦10,000)</span>
                        <span className="text-rose-400 font-mono">≈ 5 hours of work</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-slate-200">New Sneakers (₦40,000)</span>
                        <span className="text-rose-400 font-mono">≈ 2.5 full work days</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Knowing the time price empowers you to stop impulse spending effortlessly.
                  </p>
                </div>
              )}

              {slideIndex === 2 && (
                <div className="space-y-4">
                  <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-3 relative overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      Example
                    </div>
                    <h3 className="text-xl font-black">Track Real Net Worth</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Liquid bank accounts + money friends owe you are added together and translated into accumulated hours of financial freedom.
                    </p>
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                      <span className="text-xs text-emerald-200">Liquid Cash + Debtors</span>
                      <span className="text-base font-extrabold text-emerald-300">≈ 142 hours saved</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Let's now set up your real profile with your actual numbers!
                  </p>
                </div>
              )}

              {/* Slide navigation controls */}
              <div className="flex items-center justify-between pt-2">
                {slideIndex > 0 ? (
                  <button
                    onClick={() => setSlideIndex(prev => prev - 1)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
                  >
                    Previous
                  </button>
                ) : (
                  <div />
                )}

                {slideIndex < 2 ? (
                  <button
                    onClick={() => setSlideIndex(prev => prev + 1)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>Start Real Setup</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 1: BASICS (Name, Currency) */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Step 1: Your Basics
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  How should TimeWorth address you, and what currency do you use?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Molly"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Preferred Currency</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['NGN', 'USD', 'EUR', 'GBP'] as CurrencyCode[]).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                          currency === c
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-base mb-0.5">
                          {c === 'NGN' ? '₦' : c === 'USD' ? '$' : c === 'EUR' ? '€' : '£'}
                        </div>
                        <div>{c}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Default is Nigerian Naira (₦).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  disabled={!name.trim()}
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Income</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INCOME & WORK SCHEDULE (REQUIRED) */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider mb-1">
                  Required Step
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Step 2: Income & Work Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  This determines your exact hourly and daily rate. Every time conversion in TimeWorth is calculated from these values.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Monthly Net Income ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={monthlyIncomeStr}
                    onChange={e => setMonthlyIncomeStr(e.target.value)}
                    placeholder="e.g. 450000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Average take-home salary or total monthly earnings. <span className="text-emerald-700 font-bold">No fixed salary?</span> Leave it — upload {importedFileNames.length>0 ? 'your' : ''} statement(s) next and AI will estimate it for you.
                  </span>
                  {aiEstimatedIncome && (
                    <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-bold text-emerald-900">AI estimate from {importedFileNames.length} statement(s): {formatCurrency(aiEstimatedIncome, currencySymbol)}/mo</div>
                        <div className="text-[11px] text-emerald-700">Avg of your credits across {new Set(importedTransactions.filter(t=>t.type==='income').map(t=>t.month || t.date.slice(0,7))).size || 1} month(s)</div>
                      </div>
                      <button type="button" onClick={()=>setMonthlyIncomeStr(String(aiEstimatedIncome))} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Apply</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Work Hours / Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={workHoursPerDay}
                      onChange={e => setWorkHoursPerDay(Math.max(1, parseInt(e.target.value) || 8))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Default: 8 hours</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Work Days / Week
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={workDaysPerWeek}
                      onChange={e => setWorkDaysPerWeek(Math.max(1, parseInt(e.target.value) || 5))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Default: 5 days</span>
                  </div>
                </div>

                {/* Live Computed Rates Box */}
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>Calculated Time Rate:</span>
                    <span className="text-[10px] text-emerald-700 font-normal">
                      monthly / (days × 4.33 × hours)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-[11px] text-emerald-800 font-semibold">Hourly Rate</div>
                      <div className="text-lg font-black text-emerald-950 font-mono">
                        {formatCurrency(hourlyRate, currencySymbol)} / hr
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-emerald-800 font-semibold">Daily Rate</div>
                      <div className="text-lg font-black text-emerald-950 font-mono">
                        {formatCurrency(dailyRate, currencySymbol)} / day
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  disabled={monthlyIncome <= 0 && !aiEstimatedIncome}
                  onClick={() => {
                    if (monthlyIncome <= 0 && aiEstimatedIncome) setMonthlyIncomeStr(String(aiEstimatedIncome));
                    setCurrentStep(3);
                  }}
                  className="px-6 py-2.5 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Catch-up {monthlyIncome<=0 && aiEstimatedIncome ? `(AI: ${formatCurrency(aiEstimatedIncome,currencySymbol)})` : ''}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CATCH-UP ENTRY (Two Options BOTH visible, not in a dropdown) */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Step 3: Catch-up Real Data
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter this month's transactions manually OR import a bank statement. You can use both!
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                >
                  Skip Step
                </button>
              </div>

              {/* TWO OPTIONS BOTH VISIBLE */}
              <div className="space-y-6">
                
                {/* OPTION A: MANUAL ENTRY */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                        A
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-800">
                        Option A: Manual Catch-up Entry
                      </h3>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-[11px] font-bold text-slate-600">Itemize line items</span>
                      <input
                        type="checkbox"
                        checked={useItemized}
                        onChange={e => setUseItemized(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                    </label>
                  </div>

                  {!useItemized ? (
                    /* Lump sum inputs covering 1st of current month to today */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Total Income This Month So Far ({currencySymbol})
                        </label>
                        <input
                          type="number"
                          value={manualIncomeStr}
                          onChange={e => setManualIncomeStr(e.target.value)}
                          placeholder="e.g. 200000"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">1st of this month to today</span>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Total Expenses This Month So Far ({currencySymbol})
                        </label>
                        <input
                          type="number"
                          value={manualExpenseStr}
                          onChange={e => setManualExpenseStr(e.target.value)}
                          placeholder="e.g. 85000"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">1st of this month to today</span>
                      </div>
                    </div>
                  ) : (
                    /* Itemized line items list */
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                        <div className="text-xs font-bold text-slate-800">Add Line Item</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder="Description"
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="number"
                            value={newAmount}
                            onChange={e => setNewAmount(e.target.value)}
                            placeholder="Amount"
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                          />
                          <div className="flex gap-2">
                            <select
                              value={newType}
                              onChange={e => setNewType(e.target.value as any)}
                              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            >
                              <option value="expense">Expense</option>
                              <option value="income">Income</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleAddItemized}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>

                      {itemizedList.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {itemizedList.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.type === 'expense' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {item.type}
                                </span>
                                <span className="font-semibold text-slate-800">{item.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">
                                  {formatCurrency(item.amount, currencySymbol)}
                                </span>
                                <button
                                  onClick={() => handleRemoveItemized(item.id)}
                                  className="text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* OPTION B: IMPORT A STATEMENT INSTEAD (PDF, CSV, Photo) with Gemini AI */}
                <div className="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                        B
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Option B: Import Bank Statement (AI Parser)
                        </h3>
                        <span className="text-[11px] text-emerald-800 font-medium">
                          Supports PDF, CSV, or screenshots. Upload MULTIPLE files at once — spans single or multiple months. No manual typing needed.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* File Upload Zone - MULTIPLE */}
                  <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-white transition-all">
                    <UploadCloud className="w-8 h-8 text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-slate-800 text-center">
                      {importedFileNames.length > 0 ? `${importedFileNames.length} file(s): ${importedFileNames.join(', ').slice(0,80)}${importedFileNames.join(', ').length>80?'...':''}` : 'Click to select or drop MULTIPLE statement files'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 text-center">
                      PDF, CSV, JPG, PNG — select many at once. AI extracts & merges all, auto-estimates salary.
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.csv,image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {importedFileNames.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={()=>{setImportedTransactions([]); setImportedFileNames([]); setAiEstimatedIncome(null);}} className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline">Clear all files</button>
                      <span className="text-[11px] text-slate-400">Add more: just select again — we append & de-dupe</span>
                    </div>
                  )}
                  {aiEstimatedIncome && (
                    <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sky-900">AI estimated your monthly income: {formatCurrency(aiEstimatedIncome, currencySymbol)}</div>
                        <div className="text-[11px] text-sky-700">From {importedTransactions.filter(t=>t.type==='income').length} income entries. You can keep it or edit salary in previous step.</div>
                      </div>
                      <button type="button" onClick={()=>{setMonthlyIncomeStr(String(aiEstimatedIncome)); setCurrentStep(2);}} className="ml-2 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 shrink-0">Use this → Step 2</button>
                    </div>
                  )}

                  {/* Parsing loading state */}
                  {isParsingStatement && (
                    <div className="p-4 bg-white rounded-2xl border border-emerald-200 text-center space-y-2">
                      <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 animate-pulse">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Gemini AI extracting and sorting transactions by month...</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full animate-progress" />
                      </div>
                    </div>
                  )}

                  {parseError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  {/* Review Screen Table (Editable, confirm/discard per row and bulk confirm all) */}
                  {importedTransactions.length > 0 && (
                    <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Statement Review ({importedTransactions.filter(t => t.confirmed).length} / {importedTransactions.length} confirmed)</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Editable
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleConfirmAllTransactions}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline"
                          >
                            Confirm All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleDiscardAllTransactions}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline"
                          >
                            Discard All
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                        {importedTransactions.map(tx => {
                          const txTime = convertAmountToTime(tx.amount, tempProfile);
                          return (
                            <div
                              key={tx.id}
                              className={`p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-3 ${
                                tx.confirmed
                                  ? tx.isDuplicate
                                    ? 'border-amber-300 bg-amber-50/40'
                                    : 'border-slate-200 bg-slate-50/60'
                                  : 'border-slate-100 opacity-40 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={tx.confirmed}
                                  onChange={() => handleToggleConfirmTransaction(tx.id)}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 shrink-0"
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-[11px] text-slate-500">
                                      {tx.date}
                                    </span>
                                    <span className="font-bold text-slate-900 truncate">
                                      {tx.description}
                                    </span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-mono">
                                      {tx.month}
                                    </span>
                                    {tx.isDuplicate && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 flex items-center gap-1">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Likely duplicate
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                                    ≈ {txTime.formattedFull} of work
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className={`font-mono font-extrabold text-xs block ${
                                  tx.type === 'expense' ? 'text-slate-900' : 'text-emerald-700'
                                }`}>
                                  {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount, currencySymbol)}
                                </span>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {tx.suggestedCategory}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-[11px] text-slate-400 italic">
                        Transactions are saved only when you complete onboarding.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Bank Accounts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: BANK ACCOUNTS (Repeatable rows, running total with time equivalent, skippable) */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Step 4: Bank Accounts
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Add your real bank accounts. Enter current balances to calculate liquid time reserves.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep(5)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                >
                  Skip Step
                </button>
              </div>

              {/* Running Total Card with Time-equivalent */}
              <div className="p-4 bg-emerald-950 text-white rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-[11px] text-emerald-300 font-semibold">Running Total Bank Balance</div>
                  <div className="text-xl font-black font-mono mt-0.5">
                    {formatCurrency(totalBankBalance, currencySymbol)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-emerald-300 font-semibold">Time Worth</div>
                  <div className="text-sm font-extrabold text-emerald-400 flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    <span>≈ {convertAmountToTime(totalBankBalance, tempProfile).formattedFull}</span>
                  </div>
                </div>
              </div>

              {/* Repeatable Bank Rows */}
              <div className="space-y-3">
                {bankRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        Bank #{idx + 1}
                      </span>
                      {bankRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBankRow(row.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={row.bankName}
                        onChange={e => handleUpdateBankRow(row.id, 'bankName', e.target.value)}
                        placeholder="Bank Name (e.g. Zenith, GTB)"
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                      />
                      <input
                        type="text"
                        value={row.label}
                        onChange={e => handleUpdateBankRow(row.id, 'label', e.target.value)}
                        placeholder="Label (e.g. Salary, Savings)"
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                      />
                      <input
                        type="number"
                        value={row.balance}
                        onChange={e => handleUpdateBankRow(row.id, 'balance', e.target.value)}
                        placeholder="Balance"
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddBankRow}
                  className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another bank</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Debtors</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: DEBTORS (Repeatable rows, running total with time equivalent, skippable) */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Step 5: People Who Owe You
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Optional. Track active loans and unpaid client invoices translated into hours of your labor.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep(6)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                >
                  Skip Step
                </button>
              </div>

              {/* Running Total Debtors Card with Time-equivalent */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-[11px] text-amber-300 font-semibold">Total Outstanding Owed</div>
                  <div className="text-xl font-black font-mono mt-0.5">
                    {formatCurrency(totalDebtorOwed, currencySymbol)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-semibold">Time Owed</div>
                  <div className="text-sm font-extrabold text-amber-400 flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    <span>≈ {convertAmountToTime(totalDebtorOwed, tempProfile).formattedFull}</span>
                  </div>
                </div>
              </div>

              {/* Repeatable Debtor Rows */}
              <div className="space-y-3">
                {debtorRows.length === 0 ? (
                  <div className="p-6 text-center border border-slate-200 rounded-2xl space-y-2">
                    <Users className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-xs font-semibold text-slate-600">
                      No debtors added yet. Click below if anyone owes you money.
                    </div>
                  </div>
                ) : (
                  debtorRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">
                          Person #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDebtorRow(row.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => handleUpdateDebtorRow(row.id, 'name', e.target.value)}
                          placeholder="Person's Name"
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                        />
                        <input
                          type="number"
                          value={row.amountOwed}
                          onChange={e => handleUpdateDebtorRow(row.id, 'amountOwed', e.target.value)}
                          placeholder="Amount Owed"
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="date"
                          value={row.dateLent}
                          onChange={e => handleUpdateDebtorRow(row.id, 'dateLent', e.target.value)}
                          className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                          title="Date Lent"
                        />
                        <input
                          type="date"
                          value={row.dueDate}
                          onChange={e => handleUpdateDebtorRow(row.id, 'dueDate', e.target.value)}
                          className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                          title="Due Date (Optional)"
                        />
                        <input
                          type="text"
                          value={row.note}
                          onChange={e => handleUpdateDebtorRow(row.id, 'note', e.target.value)}
                          placeholder="Note (optional)"
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                        />
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={handleAddDebtorRow}
                  className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add a debtor</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(6)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Review Summary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: SUMMARY (Review Steps 1–5, finish setup) */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Step 6: Summary & Launch
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Review your real setup before entering the TimeWorth dashboard.
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. Basics & Rates */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Profile & Rates
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-900">{name} ({currency})</span>
                    <span className="font-mono font-extrabold text-emerald-700">
                      {formatCurrency(hourlyRate, currencySymbol)} / hr
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Monthly income: {formatCurrency(monthlyIncome, currencySymbol)} • {workHoursPerDay}h/day, {workDaysPerWeek}d/week
                  </div>
                </div>

                {/* 2. Catch-up Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Catch-up Data
                  </div>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <div>
                      Month-to-date manual expenses: <strong className="font-mono">{formatCurrency(parseFloat(manualExpenseStr) || 0, currencySymbol)}</strong>
                    </div>
                    <div>
                      Month-to-date manual income: <strong className="font-mono">{formatCurrency(parseFloat(manualIncomeStr) || 0, currencySymbol)}</strong>
                    </div>
                    {itemizedList.length > 0 && (
                      <div>{itemizedList.length} itemized transaction lines</div>
                    )}
                    {importedTransactions.filter(t => t.confirmed).length > 0 && (
                      <div className="text-emerald-700 font-semibold">
                        {importedTransactions.filter(t => t.confirmed).length} confirmed statement transactions
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Bank Accounts */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Liquid Bank Accounts ({bankRows.filter(b => b.bankName.trim()).length})
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                    <span>Total Liquid Cash</span>
                    <span className="font-mono">{formatCurrency(totalBankBalance, currencySymbol)}</span>
                  </div>
                  <div className="text-xs text-emerald-700 font-bold">
                    ≈ {convertAmountToTime(totalBankBalance, tempProfile).formattedFull} of life work
                  </div>
                </div>

                {/* 4. Debtors */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    People Who Owe You ({debtorRows.filter(d => d.name.trim()).length})
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                    <span>Total Owed</span>
                    <span className="font-mono">{formatCurrency(totalDebtorOwed, currencySymbol)}</span>
                  </div>
                  <div className="text-xs text-emerald-700 font-bold">
                    ≈ {convertAmountToTime(totalDebtorOwed, tempProfile).formattedFull} of work
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                >
                  Back
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleFinishOnboarding}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md active:scale-98"
                >
                  {isSubmitting ? (
                    <span>Launching Dashboard...</span>
                  ) : (
                    <>
                      <span>Finish Setup & Open Dashboard</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
