import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AmountWithTime } from './AmountWithTime';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { Goal, GoalSection } from '../types';
import { 
  ArrowLeft, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Target, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';

export const GoalsWishlistView: React.FC = () => {
  const { goals, profile, addGoal, contributeToGoal, deleteGoal, setActiveView } = useApp();
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('10000');
  const [isAddingNewGoal, setIsAddingNewGoal] = useState(false);

  // New goal form state
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newSaved, setNewSaved] = useState('0');
  const [newSection, setNewSection] = useState<GoalSection>('smart');
  const [newIcon, setNewIcon] = useState('Target');
  const [newColor, setNewColor] = useState('#2563EB');

  const specialGoals = goals.filter(g => g.section === 'special');
  const smartGoals = goals.filter(g => g.section === 'smart');
  const consumerGoals = goals.filter(g => g.section === 'consumer');

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const val = parseFloat(contributeAmount) || 0;
    if (val > 0) {
      await contributeToGoal(selectedGoal.id, val);
      // Update local selectedGoal
      setSelectedGoal(prev => prev ? { ...prev, savedAmount: Math.min(prev.targetAmount, prev.savedAmount + val) } : null);
      setContributeAmount('');
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = parseFloat(newTarget) || 0;
    const savedVal = parseFloat(newSaved) || 0;
    if (!newTitle.trim() || targetVal <= 0) return;

    await addGoal({
      title: newTitle.trim(),
      targetAmount: targetVal,
      savedAmount: savedVal,
      icon: newIcon,
      color: newColor,
      section: newSection,
      note: 'User defined wishlist item',
    });

    setIsAddingNewGoal(false);
    setNewTitle('');
    setNewTarget('');
    setNewSaved('0');
  };

  const renderGoalRow = (goal: Goal) => {
    const isCompleted = goal.savedAmount >= goal.targetAmount;
    const percent = Math.min(100, Math.round((goal.savedAmount / (goal.targetAmount || 1)) * 100));
    const leftAmount = Math.max(0, goal.targetAmount - goal.savedAmount);
    const timeLeft = convertAmountToTime(leftAmount, profile);

    return (
      <div
        key={goal.id}
        onClick={() => setSelectedGoal(goal)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedGoal(goal);
          }
        }}
        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-99"
      >
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Icon Badge */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: goal.color }}
          >
            <CategoryIcon name={goal.icon} className="w-6 h-6" />
          </div>

          {/* Title & Saved/Target */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 truncate font-sans">
                {goal.title}
              </h4>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-slate-800 font-sans">
                  {formatCurrency(goal.savedAmount, profile.currencySymbol)}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  /{formatCurrency(goal.targetAmount, profile.currencySymbol)}
                </span>
              </div>
            </div>

            {/* Progress bar matching Image 4 reference */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  backgroundColor: isCompleted ? '#10B981' : goal.color,
                }}
              ></div>
            </div>

            {/* Subtext: Time Left or Completed */}
            <div className="flex items-center justify-between text-[11px] mt-1.5 font-medium">
              {isCompleted ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completed
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-600" />
                  <span>Left {formatCurrency(leftAmount, profile.currencySymbol)}</span>
                  <span className="text-emerald-700 font-bold">≈ {timeLeft.formattedFull}</span>
                </span>
              )}
              <span className="text-slate-400 text-[10px]">{percent}%</span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Dark Forest Green Curved Header matching Image 4 reference */}
      <div className="bg-gradient-to-b from-emerald-950 to-teal-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <button
            onClick={() => setActiveView('dashboard')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-2xl font-black tracking-tight font-sans">
            Goals
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingNewGoal(true)}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors"
              title="Add new goal"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Motivational summary */}
        <div className="mt-4 pt-3 border-t border-emerald-800/60 text-xs text-emerald-200/80 flex justify-between items-center">
          <span>{goals.length} wishlist targets tracked</span>
          <span className="font-semibold text-emerald-300">
            Convert dream purchases into hours worked
          </span>
        </div>
      </div>

      {/* Goals Content or Genuine Empty State */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <Target className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No wishlist goals yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Add items you want to buy (MacBook, vacation, emergency fund) and see exactly how many hours or days of work are left to afford each one.
            </p>
          </div>
          <button
            onClick={() => setIsAddingNewGoal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Add First Goal
          </button>
        </div>
      ) : (
        <>
          {/* Special Goals Section matching Image 4 */}
          {specialGoals.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Special Goals
                </span>
              </div>
              <div className="space-y-2.5">
                {specialGoals.map(renderGoalRow)}
              </div>
            </div>
          )}

          {/* Smart Goals Section matching Image 4 */}
          {smartGoals.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Smart Goals
                </span>
              </div>
              <div className="space-y-2.5">
                {smartGoals.map(renderGoalRow)}
              </div>
            </div>
          )}

          {/* Consumer Goals Section matching Image 4 */}
          {consumerGoals.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Consumer Goals
                </span>
              </div>
              <div className="space-y-2.5">
                {consumerGoals.map(renderGoalRow)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Goal Detail Modal (matching Image 4's left detail view) */}
      {selectedGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
                  style={{ backgroundColor: selectedGoal.color }}
                >
                  <CategoryIcon name={selectedGoal.icon} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-sans">
                    {selectedGoal.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {selectedGoal.section} Goal
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedGoal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target vs Saved Numbers */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Target Amount:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {formatCurrency(selectedGoal.targetAmount, profile.currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Saved so far:</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {formatCurrency(selectedGoal.savedAmount, profile.currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Remaining to afford:</span>
                <span className="font-extrabold text-amber-700 text-sm">
                  {formatCurrency(Math.max(0, selectedGoal.targetAmount - selectedGoal.savedAmount), profile.currencySymbol)}
                </span>
              </div>

              {/* Time Remaining Metric */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Requires ≈{' '}
                  {convertAmountToTime(Math.max(0, selectedGoal.targetAmount - selectedGoal.savedAmount), profile).formattedFull}{' '}
                  of work
                </span>
              </div>
            </div>

            {/* Allocation Form matching Image 4 */}
            <form onSubmit={handleContribute} className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Allocate Funds towards this goal:
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">
                    {profile.currencySymbol || '₦'}
                  </span>
                  <input
                    type="number"
                    value={contributeAmount}
                    onChange={e => setContributeAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Amount to save"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Save
                </button>
              </div>

              <div className="flex gap-2">
                {[5000, 20000, 50000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setContributeAmount(val.toString())}
                    className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                  >
                    +{formatCurrency(val, profile.currencySymbol)}
                  </button>
                ))}
              </div>
            </form>

            <div className="pt-2 border-t border-slate-100 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  deleteGoal(selectedGoal.id);
                  setSelectedGoal(null);
                }}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                Delete goal
              </button>
              <button
                type="button"
                onClick={() => setSelectedGoal(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Goal Modal */}
      {isAddingNewGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold text-slate-900">Add New Goal</h3>
              <button onClick={() => setIsAddingNewGoal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Gaming PC, Weekend Getaway"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Target Amount ({profile.currencySymbol})</label>
                <input
                  type="number"
                  required
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  placeholder="150000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Section</label>
                <select
                  value={newSection}
                  onChange={e => setNewSection(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="smart">Smart Goals</option>
                  <option value="special">Special Goals</option>
                  <option value="consumer">Consumer Goals</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-all"
              >
                Create Goal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
