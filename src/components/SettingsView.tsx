import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateHourlyRate, formatCurrency } from '../utils/timeConversion';
import { ArrowLeft, Check, RotateCcw, Clock, Calculator, Sliders, Shield, Download, Upload } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { profile, updateProfile, resetData, setActiveView } = useApp();

  const [monthlyIncome, setMonthlyIncome] = useState(profile.monthlyIncome.toString());
  const [workDays, setWorkDays] = useState(profile.workDaysPerWeek);
  const [workHours, setWorkHours] = useState(profile.workHoursPerDay);
  const [name, setName] = useState(profile.name);
  const [currency, setCurrency] = useState(profile.currencySymbol || '₦');
  const [showTime, setShowTime] = useState(profile.showAmountsInTime);
  const [timePrimary, setTimePrimary] = useState(profile.timePrimary);

  const [isSaved, setIsSaved] = useState(false);

  // Live preview calculation
  const numericIncome = parseFloat(monthlyIncome) || 0;
  const rates = calculateHourlyRate(numericIncome, workDays, workHours);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      name: name.trim() || 'Molly',
      monthlyIncome: numericIncome,
      workDaysPerWeek: workDays,
      workHoursPerDay: workHours,
      currencySymbol: currency,
      showAmountsInTime: showTime,
      timePrimary: timePrimary,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetDemo = async () => {
    if (window.confirm('Reset all expenses, income, and goals back to the initial demo state?')) {
      await resetData();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
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
            Settings & Earning Rate
          </h2>
        </div>

        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Check className="w-3.5 h-3.5" />
            Saved!
          </span>
        )}
      </div>

      {/* Hourly Rate Engine Box */}
      <div className="bg-gradient-to-br from-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Effective Earning Rate
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Core Algorithm</span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] text-emerald-200 block">Hourly Earning Rate</span>
            <span className="text-2xl font-black text-white font-sans">
              {formatCurrency(rates.hourlyRate, currency)}
            </span>
            <span className="text-[10px] text-emerald-300 block">per hour worked</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] text-emerald-200 block">Daily Earning Rate</span>
            <span className="text-2xl font-black text-white font-sans">
              {formatCurrency(rates.dailyRate, currency)}
            </span>
            <span className="text-[10px] text-emerald-300 block">per {workHours}h work day</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Formula: Monthly Income ÷ (Work Days/Wk × 4.33 × Hours/Day). An expense of{' '}
          <strong className="text-white">{currency}20,000</strong> represents{' '}
          <strong className="text-emerald-300">
            {(20000 / (rates.hourlyRate || 1)).toFixed(1)} hours
          </strong>{' '}
          of your labor.
        </p>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-500" />
          <span>Work Schedule & Earnings</span>
        </h3>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Monthly Net Income ({currency})
          </label>
          <input
            type="number"
            value={monthlyIncome}
            onChange={e => setMonthlyIncome(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-slate-700">Days / Week</span>
              <span className="font-black text-emerald-700">{workDays} days</span>
            </div>
            <input
              type="range"
              min="1"
              max="7"
              value={workDays}
              onChange={e => setWorkDays(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-slate-700">Hours / Day</span>
              <span className="font-black text-emerald-700">{workHours} hrs</span>
            </div>
            <input
              type="range"
              min="1"
              max="16"
              value={workHours}
              onChange={e => setWorkHours(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Currency Symbol</label>
          <div className="flex gap-2">
            {['₦', '$', '€', '£'].map(sym => (
              <button
                key={sym}
                type="button"
                onClick={() => setCurrency(sym)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                  currency === sym
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Time Display Preferences
          </h4>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Show amounts in time equivalent
              </span>
              <span className="text-[11px] text-slate-400">
                Pairs all currency numbers with '≈ Xh Ym of work'
              </span>
            </div>
            <input
              type="checkbox"
              checked={showTime}
              onChange={e => setShowTime(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Make Time Primary Display
              </span>
              <span className="text-[11px] text-slate-400">
                Shows hours worked in large bold text and currency as subtext
              </span>
            </div>
            <input
              type="checkbox"
              checked={timePrimary}
              onChange={e => setTimePrimary(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all active:scale-98 text-sm"
        >
          Save Settings
        </button>
      </form>

      {/* Demo Reset Card */}
      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800">Reset Demo Data</h4>
          <p className="text-[11px] text-slate-400">
            Restores initial transactions, categories, and goals
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
