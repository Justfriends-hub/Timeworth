import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AmountWithTime } from './AmountWithTime';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, X, Edit2, Plus, Clock } from 'lucide-react';

export const EllaCategoryDetail: React.FC = () => {
  const { categories, expenses, profile, selectedCategoryId, setSelectedCategoryId, setActiveView, updateCategoryBudget } = useApp();
  const [rolloverPromptDismissed, setRolloverPromptDismissed] = useState(false);
  const [rolloverConfirmed, setRolloverConfirmed] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [activeTab, setActiveTab] = useState<'Plan' | 'Remain'>('Remain');

  const category = categories.find(c => c.id === selectedCategoryId) || categories[0];

  const catExpenses = expenses.filter(e => e.categoryId === category.id);
  const totalSpent = category.spent;
  const monthlyBudget = category.monthlyBudget;
  const remaining = Math.max(0, monthlyBudget - totalSpent);

  const spentPercent = Math.min(100, Math.round((totalSpent / (monthlyBudget || 1)) * 100));
  const remainPercent = Math.max(0, 100 - spentPercent);

  const timeSpent = convertAmountToTime(totalSpent, profile);
  const timeRemaining = convertAmountToTime(remaining, profile);
  const timeBudget = convertAmountToTime(monthlyBudget, profile);

  const handleSaveBudget = async () => {
    const val = Number(newBudget);
    if (!isNaN(val) && val > 0) {
      await updateCategoryBudget(category.id, val);
      setIsEditingBudget(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Top Header with Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('categories')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Categories</span>
        </button>

        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ChevronLeft className="w-4 h-4 text-slate-400 cursor-pointer" />
          <span>2024 Mar</span>
          <ChevronRight className="w-4 h-4 text-slate-400 cursor-pointer" />
        </div>

        <button
          onClick={() => setActiveView('add')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold shadow-xs hover:bg-amber-600"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log</span>
        </button>
      </div>

      {/* Semicircular Arc Gauge Card (Replicating Image 5 Screen 2 exactly) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        {/* Subtle Category Title & Badge */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: category.color }}
          >
            <CategoryIcon name={category.icon} className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">
            {category.name}
          </h2>
        </div>

        {/* SVG Arc Gauge */}
        <div className="relative w-64 h-36 flex items-end justify-center mt-2">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            {/* Background Semicircular Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Foreground Filled Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={category.color}
              strokeWidth="14"
              strokeDasharray={`${(spentPercent * 251.3) / 100} 251.3`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>

          {/* Center Arc Badge & Text */}
          <div className="absolute bottom-2 flex flex-col items-center">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm mb-1"
              style={{ backgroundColor: category.color }}
            >
              <CategoryIcon name={category.icon} className="w-5 h-5" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
              {activeTab === 'Remain'
                ? formatCurrency(remaining, profile.currencySymbol)
                : formatCurrency(totalSpent, profile.currencySymbol)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {activeTab === 'Remain' ? 'Remaining Budget' : 'Total Spent'}
            </span>
            <span className="text-xs font-bold text-emerald-700 mt-0.5 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {activeTab === 'Remain'
                ? `≈ ${timeRemaining.formattedFull} left`
                : `≈ ${timeSpent.formattedFull} worked`}
            </span>
          </div>
        </div>

        {/* Arc Footnotes: Spent vs Monthly Limit */}
        <div className="w-full flex justify-between items-center text-xs pt-4 border-t border-slate-100 mt-4 px-4 font-medium">
          <div className="text-left">
            <span className="text-slate-400 block text-[10px]">Spent ({spentPercent}%)</span>
            <span className="font-bold text-slate-800">
              {formatCurrency(totalSpent, profile.currencySymbol)}
            </span>
            <span className="text-[10px] text-slate-500 block">≈ {timeSpent.formattedShort}</span>
          </div>

          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Monthly Plan</span>
            <div className="flex items-center gap-1 justify-end">
              <span className="font-bold text-slate-800">
                {formatCurrency(monthlyBudget, profile.currencySymbol)}
              </span>
              <button
                onClick={() => {
                  setNewBudget(category.monthlyBudget.toString());
                  setIsEditingBudget(true);
                }}
                className="text-slate-400 hover:text-slate-700"
                title="Edit budget"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
            <span className="text-[10px] text-slate-500 block">≈ {timeBudget.formattedShort}</span>
          </div>
        </div>

        {/* Inline Edit Budget Modal */}
        {isEditingBudget && (
          <div className="w-full mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">Set Monthly Budget:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newBudget}
                onChange={e => setNewBudget(e.target.value)}
                className="w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                placeholder="₦ budget"
              />
              <button
                onClick={handleSaveBudget}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingBudget(false)}
                className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Roll Over Prompt Card (Matching Image 5 Screen 2 exactly) */}
      {!rolloverPromptDismissed && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 shadow-xs transition-all">
          <div className="text-center space-y-1">
            <h4 className="text-sm font-extrabold text-slate-900">Last period remaining</h4>
            <p className="text-xs text-slate-600">
              Do you want to roll over the remaining budget (
              <span className="font-bold text-slate-900">{formatCurrency(remaining, profile.currencySymbol)} ≈ {timeRemaining.formattedShort}</span>
              ) to this period?
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setRolloverPromptDismissed(true)}
              className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all shadow-xs"
            >
              No thanks.
            </button>
            <button
              onClick={() => {
                setRolloverConfirmed(true);
                setRolloverPromptDismissed(true);
              }}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm</span>
            </button>
          </div>
        </div>
      )}

      {rolloverConfirmed && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>✓ Budget successfully rolled over (+{formatCurrency(remaining, profile.currencySymbol)} added to current balance).</span>
          <button onClick={() => setRolloverConfirmed(false)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Expenses Breakdown with Plan / Remain Toggle */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Transaction History</h3>

          {/* Toggle pill matching reference: Plan / Remain */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('Plan')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'Plan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Plan
            </button>
            <button
              onClick={() => setActiveTab('Remain')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'Remain' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Remain
            </button>
          </div>
        </div>

        {/* Expenses logged under this category */}
        {catExpenses.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-xs">No expenses logged yet in {category.name}.</p>
            <button
              onClick={() => setActiveView('add')}
              className="mt-2 text-xs font-bold text-emerald-700 hover:underline"
            >
              + Add first expense
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {catExpenses.map(exp => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: category.color }}
                  >
                    <CategoryIcon name={category.icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{exp.title}</h4>
                    <p className="text-[10px] text-slate-400">
                      {new Date(exp.dateTime).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {exp.note ? ` • ${exp.note}` : ''}
                    </p>
                  </div>
                </div>

                <AmountWithTime amount={exp.amount} size="sm" align="right" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
