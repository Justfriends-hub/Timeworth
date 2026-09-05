import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AmountWithTime } from './AmountWithTime';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Clock, 
  Calendar, 
  ChevronRight, 
  Sparkles,
  Zap,
  Building2,
  Users,
  ShieldCheck,
  Wallet
} from 'lucide-react';

export const MollyDashboard: React.FC = () => {
  const { profile, expenses, income, categories, bankAccounts, debtors, setActiveView, setSelectedCategoryId } = useApp();
  const [chartPeriod, setChartPeriod] = useState<'Month' | 'Week' | 'Year'>('Month');
  const [chartMetric, setChartMetric] = useState<'both' | 'income' | 'spent'>('both');

  // Compute summary values
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncomeAmount = income.reduce((sum, i) => sum + i.amount, 0) || profile.monthlyIncome;

  const totalTimeSpent = convertAmountToTime(totalExpenseAmount, profile);
  const totalTimeEarned = convertAmountToTime(totalIncomeAmount, profile);

  // Bank accounts & Debtors net worth calculation
  const totalBankBalance = (bankAccounts || []).reduce((sum, b) => sum + (Number(b.balance) || 0), 0);
  const totalDebtorsOwed = (debtors || [])
    .filter(d => d.status === 'owing')
    .reduce((sum, d) => sum + (Number(d.amountOwed) || 0), 0);
  const totalNetWorth = totalBankBalance + totalDebtorsOwed;
  const totalNetWorthTime = convertAmountToTime(totalNetWorth, profile);
  const totalBankTime = convertAmountToTime(totalBankBalance, profile);
  const totalDebtorsTime = convertAmountToTime(totalDebtorsOwed, profile);

  // Time budget percentage: hours worked for expenses vs total monthly working hours
  const monthlyWorkingHours = profile.workDaysPerWeek * 4.33 * profile.workHoursPerDay;
  const timeBudgetPercentage = Math.min(
    100,
    Math.round((totalTimeSpent.totalHours / (monthlyWorkingHours || 1)) * 100)
  );

  // Daily budget calculations - pure real numbers, no synthetic defaults
  const dailyBudget = profile.dailyRate > 0 ? profile.dailyRate : (profile.monthlyIncome / 30);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayExpenses = expenses
    .filter(e => new Date(e.dateTime) >= todayStart)
    .reduce((sum, e) => sum + e.amount, 0);
  
  const displayTodaySpent = todayExpenses;
  const displayTodayLeft = Math.max(0, dailyBudget - displayTodaySpent);
  const todaySpentPercent = dailyBudget > 0 ? Math.min(100, Math.round((displayTodaySpent / dailyBudget) * 100)) : 0;

  // Top spending categories for right breakdown
  const sortedCategories = [...categories]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 font-sans">
            Hello, {profile.name || 'Molly'}
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Welcome back! Here is your real time-to-income breakdown for this month.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('add')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={() => setActiveView('categories')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70 font-semibold text-sm transition-all"
          >
            <span>Category Grid</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Net Worth Strip (Total Bank Balances + Total Owed by Debtors) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Live Net Worth Strip
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {formatCurrency(totalNetWorth, profile.currencySymbol)}
              </span>
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                ≈ {totalNetWorthTime.formattedFull} of work saved
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('bank-accounts')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Banks ({bankAccounts.length})</span>
            </button>
            <button
              onClick={() => setActiveView('debtors')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Debtors ({debtors.filter(d => d.status === 'owing').length})</span>
            </button>
          </div>
        </div>

        {/* Breakdown sub-pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div
            onClick={() => setActiveView('bank-accounts')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 block">Liquid Bank Balances</span>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ≈ {totalBankTime.formattedFull}
                </span>
              </div>
            </div>
            <span className="text-sm font-black font-mono text-slate-900">
              {formatCurrency(totalBankBalance, profile.currencySymbol)}
            </span>
          </div>

          <div
            onClick={() => setActiveView('debtors')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 block">Money Owed to You</span>
                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ≈ {totalDebtorsTime.formattedFull}
                </span>
              </div>
            </div>
            <span className="text-sm font-black font-mono text-slate-900">
              {formatCurrency(totalDebtorsOwed, profile.currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Signature TimeWorth Card: Time Spent This Month */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-teal-900/15 relative overflow-hidden">
        {/* Ambient background decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-teal-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold tracking-wide uppercase">
              <Clock className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>TimeWorth Signature Metric</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
              You've worked <span className="text-emerald-300 underline decoration-emerald-400/60 decoration-2 underline-offset-4">{totalTimeSpent.formattedFull}</span> worth of spending this month
            </h2>
            
            <p className="text-emerald-100/80 text-sm leading-relaxed">
              At your earning rate of <span className="font-bold text-white">{formatCurrency(profile.hourlyRate, profile.currencySymbol)}/hour</span>, every naira spent is real life energy worked.
              Total spent: <span className="font-bold text-white">{formatCurrency(totalExpenseAmount, profile.currencySymbol)}</span> out of {formatCurrency(profile.monthlyIncome, profile.currencySymbol)} monthly income.
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-emerald-700/50 pt-4 md:pt-0 md:pl-6 gap-3 shrink-0">
            <div className="text-left md:text-right">
              <span className="text-xs text-emerald-200/70 font-medium block">Time Budget Used</span>
              <span className="text-3xl font-black tracking-tight text-white">{timeBudgetPercentage}%</span>
              <span className="text-xs text-emerald-300 block">
                {Math.round(totalTimeSpent.totalHours)}h of {Math.round(monthlyWorkingHours)}h total
              </span>
            </div>

            <button
              onClick={() => setActiveView('trends')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              <span>View Insights</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar of Monthly Work Spent */}
        <div className="mt-5 relative">
          <div className="w-full h-2.5 bg-emerald-950/60 rounded-full overflow-hidden p-0.5 border border-emerald-500/20">
            <div
              className="h-full bg-gradient-to-r from-teal-300 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(5, timeBudgetPercentage))}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] text-emerald-200/70 mt-1.5 font-medium">
            <span>0h worked</span>
            <span>Where you should be today (~50%)</span>
            <span>{Math.round(monthlyWorkingHours)}h limit</span>
          </div>
        </div>
      </div>

      {/* Grid: Molly Style Center Chart + Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Center Main Chart Card (2 cols on large) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
                Income vs Spent
              </h3>
              <p className="text-xs text-slate-500">Track balance in currency and time worked</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setChartMetric('both')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartMetric === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setChartMetric('income')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartMetric === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Income
                </button>
                <button
                  onClick={() => setChartMetric('spent')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartMetric === 'spent' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Spent
                </button>
              </div>

              <select
                value={chartPeriod}
                onChange={e => setChartPeriod(e.target.value as any)}
                aria-label="Filter chart by time period"
                className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Week">Week</option>
                <option value="Month">Month</option>
                <option value="Year">Year</option>
              </select>
            </div>
          </div>

          {/* SVG Smooth Curve Area Chart matching Image 1 Molly chart */}
          <div className="h-52 sm:h-64 w-full relative pt-4">
            <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2A9D8F" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#2A9D8F" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="40" y1="30" x2="580" y2="30" stroke="#F1F5F9" strokeDasharray="4 4" />
              <text x="15" y="34" className="text-[10px] fill-slate-400 font-sans">8k</text>
              <line x1="40" y1="80" x2="580" y2="80" stroke="#F1F5F9" strokeDasharray="4 4" />
              <text x="15" y="84" className="text-[10px] fill-slate-400 font-sans">6k</text>
              <line x1="40" y1="130" x2="580" y2="130" stroke="#F1F5F9" strokeDasharray="4 4" />
              <text x="15" y="134" className="text-[10px] fill-slate-400 font-sans">4k</text>
              <line x1="40" y1="180" x2="580" y2="180" stroke="#F1F5F9" strokeDasharray="4 4" />
              <text x="15" y="184" className="text-[10px] fill-slate-400 font-sans">2k</text>

              {/* Income Curve (Green) */}
              {(chartMetric === 'both' || chartMetric === 'income') && (
                <>
                  <path
                    d="M 60 90 C 140 30, 200 130, 280 110 C 360 90, 420 40, 500 70 C 540 85, 560 60, 570 50 L 570 180 L 60 180 Z"
                    fill="url(#incomeGrad)"
                  />
                  <path
                    d="M 60 90 C 140 30, 200 130, 280 110 C 360 90, 420 40, 500 70 C 540 85, 560 60, 570 50"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="280" cy="110" r="5" fill="#FFFFFF" stroke="#10B981" strokeWidth="3" />
                  <circle cx="500" cy="70" r="5" fill="#FFFFFF" stroke="#10B981" strokeWidth="3" />
                </>
              )}

              {/* Spent Curve (Teal/Emerald matching Molly style) */}
              {(chartMetric === 'both' || chartMetric === 'spent') && (
                <>
                  <path
                    d="M 60 140 C 130 90, 190 85, 270 150 C 340 180, 410 90, 480 95 C 520 100, 550 140, 570 130 L 570 180 L 60 180 Z"
                    fill="url(#spentGrad)"
                  />
                  <path
                    d="M 60 140 C 130 90, 190 85, 270 150 C 340 180, 410 90, 480 95 C 520 100, 550 140, 570 130"
                    fill="none"
                    stroke="#2A9D8F"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Highlight Node */}
                  <circle cx="410" cy="90" r="6" fill="#FFFFFF" stroke="#2A9D8F" strokeWidth="3.5" />
                </>
              )}

              {/* Bottom Month Labels */}
              {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month, idx) => (
                <text
                  key={month}
                  x={70 + idx * 96}
                  y="205"
                  textAnchor="middle"
                  className={`text-[11px] font-medium font-sans ${
                    month === 'Aug' ? 'fill-slate-900 font-bold' : 'fill-slate-400'
                  }`}
                >
                  {month}
                </text>
              ))}
            </svg>
          </div>

          {/* Dual Bottom Sub-Cards matching Molly Reference: Transaction preview & Daily Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            {/* Transaction preview card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-800">Recent Transactions</span>
                <button
                  onClick={() => setActiveView('expenses')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {expenses.length === 0 ? (
                  <div className="py-2 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No expenses yet — add one or import a statement
                    </p>
                    <button
                      onClick={() => setActiveView('add')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors inline-block"
                    >
                      + Add Expense
                    </button>
                  </div>
                ) : (
                  expenses.slice(0, 2).map(exp => {
                    const cat = categories.find(c => c.id === exp.categoryId);
                    return (
                      <div key={exp.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs"
                            style={{ backgroundColor: cat?.bgColor || '#F1F5F9', color: cat?.color || '#475569' }}
                          >
                            <CategoryIcon name={cat?.icon || 'ShoppingBag'} className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 line-clamp-1">{exp.title}</p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(exp.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <AmountWithTime amount={exp.amount} size="xs" align="right" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Daily Budget Card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Daily budget</span>
                <span className="text-[11px] font-bold text-emerald-700">
                  ≈ {convertAmountToTime(dailyBudget, profile).formattedShort} of work
                </span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 font-sans">
                {formatCurrency(dailyBudget, profile.currencySymbol)}
              </div>

              {/* Progress split matching reference: 40% Spent $192 / 60% Left $288 */}
              <div className="mt-3">
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${todaySpentPercent}%` }}
                  ></div>
                  <div
                    className="h-full bg-slate-300 transition-all duration-500"
                    style={{ width: `${100 - todaySpentPercent}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-xs mt-2 font-medium">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Spent ({todaySpentPercent}%)</span>
                    <span className="font-bold text-slate-700">
                      {formatCurrency(displayTodaySpent, profile.currencySymbol)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Left ({100 - todaySpentPercent}%)</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(displayTodayLeft, profile.currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Stat Pills & 78% Circular Time Ring */}
        <div className="space-y-6">
          {/* Dual Stat Pills matching Molly reference: 25% Income / 25% Spent */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Income
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-lg font-black text-slate-900 font-sans">
                  {formatCurrency(totalIncomeAmount, profile.currencySymbol)}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  {totalTimeEarned.formattedShort} earned
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  Spent
                </span>
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-lg font-black text-slate-900 font-sans">
                  {formatCurrency(totalExpenseAmount, profile.currencySymbol)}
                </div>
                <div className="text-[11px] text-amber-700 font-medium">
                  {totalTimeSpent.formattedShort} of life
                </div>
              </div>
            </div>
          </div>

          {/* Circular Time Budget Ring (Replicating the 78% Molly ring) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="w-full flex items-center justify-between text-left">
              <h4 className="text-sm font-bold text-slate-900">Work Time Budget</h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                Monthly
              </span>
            </div>

            {/* Semicircular / Circular Gauge */}
            <div className="relative w-40 h-40 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="transparent"
                  stroke="url(#ringGrad)"
                  strokeWidth="12"
                  strokeDasharray={`${(timeBudgetPercentage * 301.6) / 100} 301.6`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2A9D8F" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 tracking-tight font-sans">
                  {timeBudgetPercentage}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Time Used</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 px-2 leading-relaxed">
              You have used <strong className="text-slate-800">{totalTimeSpent.formattedShort}</strong> out of your{' '}
              <strong className="text-slate-800">{Math.round(monthlyWorkingHours)}h</strong> monthly capacity.
            </p>

            {/* Top Categories breakdown list */}
            <div className="w-full space-y-2.5 pt-3 border-t border-slate-100 text-left">
              {sortedCategories.map(cat => {
                const time = convertAmountToTime(cat.spent, profile);
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setActiveView('category-detail');
                    }}
                    className="flex items-center justify-between text-xs hover:bg-slate-50 p-1.5 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                      <span className="font-medium text-slate-700">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{formatCurrency(cat.spent, profile.currencySymbol)}</span>
                      <span className="text-[10px] text-slate-400 block">{time.formattedShort}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setActiveView('categories')}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Explore All Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
