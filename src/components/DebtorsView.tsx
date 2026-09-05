import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Debtor } from '../types';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import {
  ArrowLeft,
  Users,
  Plus,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
  FileText,
  BadgeAlert
} from 'lucide-react';

export const DebtorsView: React.FC = () => {
  const { debtors, profile, addDebtor, updateDebtor, toggleDebtorStatus, deleteDebtor, setActiveView } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);

  const [name, setName] = useState('');
  const [amountOwed, setAmountOwed] = useState('');
  const [dateLent, setDateLent] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  // Calculate total currently owing (status === 'owing')
  const totalOwed = debtors
    .filter(d => d.status === 'owing')
    .reduce((sum, d) => sum + (Number(d.amountOwed) || 0), 0);
  const totalTimeOwed = convertAmountToTime(totalOwed, profile);

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = debtors.filter(d => d.status === 'owing' && d.dueDate && d.dueDate < todayStr).length;

  const handleOpenAdd = () => {
    setEditingDebtor(null);
    setName('');
    setAmountOwed('');
    setDateLent(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setName(debtor.name);
    setAmountOwed(debtor.amountOwed.toString());
    setDateLent(debtor.dateLent);
    setDueDate(debtor.dueDate || '');
    setNote(debtor.note || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const numAmount = parseFloat(amountOwed) || 0;

    if (editingDebtor) {
      await updateDebtor(editingDebtor.id, {
        name: name.trim(),
        amountOwed: numAmount,
        dateLent,
        dueDate: dueDate || undefined,
        note: note.trim(),
      });
    } else {
      await addDebtor({
        name: name.trim(),
        amountOwed: numAmount,
        dateLent,
        dueDate: dueDate || undefined,
        status: 'owing',
        note: note.trim(),
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this debtor entry?')) {
      await deleteDebtor(id);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-950 to-teal-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10 mb-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-2xl font-black tracking-tight font-sans">
            People Who Owe You
          </h1>

          <button
            onClick={handleOpenAdd}
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors"
            title="Add debtor"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Total Owed & Time Equivalent Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
          <div className="flex items-center justify-between text-xs text-emerald-200/90 font-medium mb-1">
            <span>Total Outstanding Owed</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-300">
              <Clock className="w-3.5 h-3.5" />
              {totalTimeOwed.formattedFull}
            </span>
          </div>
          <div className="text-3xl font-black tracking-tight text-white font-mono">
            {formatCurrency(totalOwed, profile.currencySymbol)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-100/70 flex items-center justify-between">
            <span>{debtors.filter(d => d.status === 'owing').length} active {debtors.filter(d => d.status === 'owing').length === 1 ? 'person' : 'people'} owing</span>
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 font-bold border border-rose-400/40 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Debtors List or Genuine Empty State */}
      {debtors.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">No debtors recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Track loans and money friends or clients owe you. Every naira owed is translated directly into hours of your labor waiting to be reclaimed.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Add First Debtor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Debtors Directory ({debtors.length})
            </span>
            <button
              onClick={handleOpenAdd}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add new debtor
            </button>
          </div>

          <div className="grid gap-3">
            {debtors.map(debtor => {
              const amountVal = Number(debtor.amountOwed) || 0;
              const timeEquivalent = convertAmountToTime(amountVal, profile);
              const isPaid = debtor.status === 'paid';
              const isOverdue = !isPaid && debtor.dueDate && debtor.dueDate < todayStr;

              return (
                <div
                  key={debtor.id}
                  className={`bg-white rounded-2xl p-4 border transition-all flex flex-col gap-3 shadow-xs ${
                    isOverdue
                      ? 'border-rose-200 bg-rose-50/20'
                      : isPaid
                      ? 'border-slate-100 opacity-70 bg-slate-50/40'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                          isPaid
                            ? 'bg-slate-100 text-slate-500'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200/60'
                        }`}
                      >
                        {debtor.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-bold truncate ${isPaid ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                            {debtor.name}
                          </h4>
                          {isPaid ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Paid
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-0.5">
                              <BadgeAlert className="w-3 h-3" />
                              Overdue
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Owing
                            </span>
                          )}
                        </div>

                        {/* Time-equivalent */}
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>≈ {timeEquivalent.formattedFull} of work</span>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Quick Action */}
                    <div className="text-right shrink-0">
                      <div className={`text-base font-extrabold font-mono ${isPaid ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {formatCurrency(amountVal, profile.currencySymbol)}
                      </div>

                      {/* One-tap Mark as Paid action */}
                      <button
                        onClick={() => toggleDebtorStatus(debtor.id)}
                        className={`mt-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ml-auto ${
                          isPaid
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isPaid ? 'Mark as Owing' : 'Mark as Paid'}
                      </button>
                    </div>
                  </div>

                  {/* Date lent, due date, note footer */}
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Lent: {debtor.dateLent}
                      </span>
                      {debtor.dueDate && (
                        <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                          Due: {debtor.dueDate}
                        </span>
                      )}
                      {debtor.note && (
                        <span className="italic text-slate-400 truncate max-w-[140px]">
                          "{debtor.note}"
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(debtor)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit debtor"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(debtor.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete debtor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingDebtor ? 'Edit Debtor' : 'Add Person Who Owes You'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Person's Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Tunde Adeyemi"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Amount Owed ({profile.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={amountOwed}
                  onChange={e => setAmountOwed(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Date Lent *
                  </label>
                  <input
                    type="date"
                    required
                    value={dateLent}
                    onChange={e => setDateLent(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Note / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Car repair emergency loan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {amountOwed && parseFloat(amountOwed) > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Holds <strong className="font-bold">{convertAmountToTime(parseFloat(amountOwed) || 0, profile).formattedFull}</strong> of your life work
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-98"
              >
                {editingDebtor ? 'Save Debtor' : 'Record Debtor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
