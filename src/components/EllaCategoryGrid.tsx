import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AmountWithTime } from './AmountWithTime';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { ChevronLeft, ChevronRight, Edit3, PiggyBank, Plus } from 'lucide-react';

export const EllaCategoryGrid: React.FC = () => {
  const { categories, profile, setSelectedCategoryId, setActiveView } = useApp();
  const [selectedMonth, setSelectedMonth] = useState('2024 Mar');

  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = categories.reduce((sum, c) => sum + c.monthlyBudget, 0);
  const totalTimeSpent = convertAmountToTime(totalSpent, profile);

  const months = ['2024 Jan', '2024 Feb', '2024 Mar', '2024 Apr', '2024 May'];

  const handlePrevMonth = () => {
    const idx = months.indexOf(selectedMonth);
    if (idx > 0) setSelectedMonth(months[idx - 1]);
  };

  const handleNextMonth = () => {
    const idx = months.indexOf(selectedMonth);
    if (idx < months.length - 1) setSelectedMonth(months[idx + 1]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Month Selector Header matching Ella reference (< 2024 Mar > with edit and piggy bank) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Budget View</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold text-slate-900 tracking-tight font-sans">
              {selectedMonth}
            </span>
            <button 
              onClick={() => setActiveView('settings')} 
              title="Edit monthly budget targets"
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('goals')}
            className="p-2 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100 transition-colors"
            title="View Wishlist Goals"
          >
            <PiggyBank className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-100/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
            ₦
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-800/80">Total Planned Spend</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-emerald-950">
                {formatCurrency(totalSpent, profile.currencySymbol)}
              </span>
              <span className="text-xs font-bold text-emerald-700">
                / {formatCurrency(totalBudget, profile.currencySymbol)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-center sm:text-right bg-white/80 px-3.5 py-1.5 rounded-xl border border-emerald-200/60">
          <span className="text-[11px] text-slate-500 font-medium block">Total Life Energy</span>
          <span className="text-sm font-extrabold text-emerald-800">
            ≈ {totalTimeSpent.formattedFull}
          </span>
        </div>
      </div>

      {/* Section Title */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Expenses Categories
          </h2>
          <p className="text-xs text-slate-500">
            Tap any tile to inspect the budget gauge and roll-over balance
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400">12 Categories</span>
      </div>

      {/* The 12 Pastel Colored Rounded Cards Grid (matching Image 5 screen 1 exactly!) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {categories.map(cat => {
          const time = convertAmountToTime(cat.spent, profile);
          const percentUsed = Math.min(100, Math.round((cat.spent / (cat.monthlyBudget || 1)) * 100));
          const isOverBudget = cat.spent > cat.monthlyBudget;

          return (
            <div
              key={cat.id}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setActiveView('category-detail');
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedCategoryId(cat.id);
                  setActiveView('category-detail');
                }
              }}
              style={{ backgroundColor: cat.bgColor }}
              className="group relative rounded-3xl p-5 border border-black/5 hover:border-black/15 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col items-center text-center justify-between min-h-[170px] active:scale-98"
            >
              {/* Category Icon Badge in Rounded Pill Circle */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: cat.color,
                  color: '#FFFFFF',
                }}
              >
                <CategoryIcon name={cat.icon} className="w-7 h-7" />
              </div>

              {/* Title & Numbers */}
              <div className="mt-3 w-full">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight line-clamp-1">
                  {cat.name}
                </h3>

                {/* Amount */}
                <div className="mt-1">
                  <span className="text-sm font-black text-slate-900 block font-sans">
                    {formatCurrency(cat.spent, profile.currencySymbol)}
                  </span>

                  {/* Signature Secondary Time Subtext */}
                  <span className="text-[11px] font-medium text-slate-500 block leading-tight mt-0.5">
                    ≈ {time.formattedShort} of work
                  </span>
                </div>
              </div>

              {/* Mini subtle progress bar */}
              <div className="w-full mt-2.5">
                <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentUsed}%`,
                      backgroundColor: isOverBudget ? '#EF4444' : cat.color,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-[9px] font-semibold text-slate-400 mt-1">
                  <span>{percentUsed}%</span>
                  <span>{formatCurrency(cat.monthlyBudget, profile.currencySymbol)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Add Custom Expense Button */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setActiveView('add')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Transaction</span>
        </button>
      </div>
    </div>
  );
};
