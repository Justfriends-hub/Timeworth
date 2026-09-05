import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AmountWithTime } from './AmountWithTime';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { Search, Plus, Trash2, ArrowLeft, Filter } from 'lucide-react';

export const ExpensesListView: React.FC = () => {
  const { expenses, categories, profile, deleteExpense, setActiveView } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.note && exp.note.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCatFilter === 'all' || exp.categoryId === selectedCatFilter;
    return matchesSearch && matchesCat;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalTimeFiltered = convertAmountToTime(totalFiltered, profile);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">
            Transactions
          </h2>
        </div>

        <button
          onClick={() => setActiveView('add')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Expense</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <select
          value={selectedCatFilter}
          onChange={e => setSelectedCatFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary of active selection */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex justify-between items-center text-xs font-medium text-slate-600">
        <span>Showing {filteredExpenses.length} entries</span>
        <div className="text-right">
          <span className="font-extrabold text-slate-900">
            {formatCurrency(totalFiltered, profile.currencySymbol)}
          </span>
          <span className="text-[11px] text-emerald-700 block font-bold">
            ≈ {totalTimeFiltered.formattedShort} of work
          </span>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-2.5">
        {expenses.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <Plus className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">No expenses yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No expenses yet — add one or import a statement to start translating every naira into hours worked.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setActiveView('add')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
              >
                + Add Expense
              </button>
              <button
                onClick={() => setActiveView('onboarding')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Import Statement
              </button>
            </div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center text-slate-400">
            <p className="text-xs font-medium">No transactions match your search filter.</p>
          </div>
        ) : (
          filteredExpenses.map(exp => {
            const cat = categories.find(c => c.id === exp.categoryId);
            return (
              <div
                key={exp.id}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:border-slate-200 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: cat?.color || '#3B82F6' }}
                  >
                    <CategoryIcon name={cat?.icon || 'ShoppingBag'} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{exp.title}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{cat?.name || 'General'}</span>
                      <span>•</span>
                      <span>
                        {new Date(exp.dateTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {exp.note && <span>• {exp.note}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <AmountWithTime amount={exp.amount} size="sm" align="right" />
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-600 transition-opacity"
                    title="Delete expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
