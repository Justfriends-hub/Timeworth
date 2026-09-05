import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { Clock, Check, Calendar, ArrowLeft, PlusCircle, Sparkles } from 'lucide-react';

export const AddExpenseModal: React.FC = () => {
  const { categories, profile, addExpense, addIncome, setActiveView } = useApp();
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('40000');
  const [title, setTitle] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || 'cat-groceries');
  const [isToday, setIsToday] = useState(true);
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericAmount = parseFloat(amountStr) || 0;
  const timeCalc = convertAmountToTime(numericAmount, profile);

  const handleKeypadPress = (val: string) => {
    if (val === 'backspace') {
      setAmountStr(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === 'clear') {
      setAmountStr('0');
    } else {
      setAmountStr(prev => (prev === '0' ? val : prev + val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) return;

    setIsSubmitting(true);
    const dateToUse = isToday ? new Date().toISOString() : new Date(customDate).toISOString();
    const finalTitle = title.trim() || (entryType === 'expense' 
      ? (categories.find(c => c.id === selectedCategoryId)?.name || 'Expense')
      : 'Income payment');

    try {
      if (entryType === 'expense') {
        await addExpense({
          amount: numericAmount,
          title: finalTitle,
          categoryId: selectedCategoryId,
          dateTime: dateToUse,
          note: note.trim(),
        });
      } else {
        await addIncome({
          amount: numericAmount,
          source: finalTitle,
          category: 'Income',
          dateTime: dateToUse,
          note: note.trim(),
        });
      }
      setActiveView('dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('dashboard')}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Expense vs Income Type Toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setEntryType('expense')}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              entryType === 'expense' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Add Expense
          </button>
          <button
            type="button"
            onClick={() => setEntryType('income')}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              entryType === 'income' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Add Income
          </button>
        </div>

        <div className="w-9"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Big Amount Entry matching Image 2 screen 3 "$40.00" clean minimal layout */}
        <div className="text-center py-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {entryType === 'expense' ? 'How much did it cost?' : 'How much was received?'}
          </span>

          <div className="flex items-center justify-center gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-400">
              {profile.currencySymbol || '₦'}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={numericAmount > 0 ? numericAmount.toLocaleString() : ''}
              onChange={e => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                setAmountStr(clean || '0');
              }}
              placeholder="0"
              className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight text-center w-64 bg-transparent focus:outline-none font-sans"
            />
          </div>

          {/* Signature Live Time Conversion Preview */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold shadow-xs">
            <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>= {timeCalc.formattedFull}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Based on your rate of {formatCurrency(profile.hourlyRate, profile.currencySymbol)}/hr
          </p>
        </div>

        {/* Quick Amount Presets */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[5000, 10000, 25000, 50000, 100000].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setAmountStr(val.toString())}
              className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              +{formatCurrency(val, profile.currencySymbol)}
            </button>
          ))}
        </div>

        {/* Category Icon Chips matching Image 2 screen 3 (yellow bag, blue card, pink lightning, etc.) */}
        {entryType === 'expense' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Category: {selectedCategory?.name}</span>
              <span className="text-slate-400">Select icon</span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {categories.map(cat => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-3 ring-amber-500 ring-offset-2 scale-105 shadow-sm'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: cat.color,
                      color: '#FFFFFF',
                    }}
                    title={cat.name}
                  >
                    <CategoryIcon name={cat.icon} className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Description & Note Input */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {entryType === 'expense' ? 'Title / Merchant' : 'Source'}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={entryType === 'expense' ? 'e.g. Grocery restock, Taxi ride, Lunch' : 'e.g. Salary, Client milestone'}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Paid via mobile bank transfer"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>

          {/* Date Toggle matching Image 2 screen 3 ("Today" checkbox) */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isToday}
                onChange={e => setIsToday(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-700">Today</span>
            </label>

            {!isToday && (
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="text-xs px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
              />
            )}
          </div>
        </div>

        {/* Big Bright Orange CTA Button matching Image 2 screen 3 */}
        <button
          type="submit"
          disabled={numericAmount <= 0 || isSubmitting}
          className={`w-full py-4 rounded-2xl font-bold text-base text-white shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 ${
            entryType === 'expense'
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
          } ${numericAmount <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? (
            <span>Saving to REST API...</span>
          ) : (
            <>
              <span>{entryType === 'expense' ? 'Add Expense' : 'Add Income'}</span>
              <span className="text-xs font-normal opacity-80">
                ({timeCalc.formattedShort})
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
