import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BankAccount } from '../types';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import {
  ArrowLeft,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Wallet,
  ShieldCheck,
  X,
  Sparkles
} from 'lucide-react';

export const BankAccountsView: React.FC = () => {
  const { bankAccounts, profile, addBankAccount, updateBankAccount, deleteBankAccount, setActiveView } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [bankName, setBankName] = useState('');
  const [label, setLabel] = useState('');
  const [balance, setBalance] = useState('');

  const totalBalance = bankAccounts.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);
  const totalTime = convertAmountToTime(totalBalance, profile);

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setBankName('');
    setLabel('');
    setBalance('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (bank: BankAccount) => {
    setEditingAccount(bank);
    setBankName(bank.bankName);
    setLabel(bank.label || '');
    setBalance(bank.balance.toString());
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) return;
    const numBalance = parseFloat(balance) || 0;

    if (editingAccount) {
      await updateBankAccount(editingAccount.id, {
        bankName: bankName.trim(),
        label: label.trim(),
        balance: numBalance,
      });
    } else {
      await addBankAccount({
        bankName: bankName.trim(),
        label: label.trim(),
        balance: numBalance,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this bank account?')) {
      await deleteBankAccount(id);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-10">
      {/* Curved Forest Green Header matching App Visual Identity */}
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
            Bank Accounts
          </h1>

          <button
            onClick={handleOpenAdd}
            className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-colors"
            title="Add bank account"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Total Balance & Time Equivalent Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
          <div className="flex items-center justify-between text-xs text-emerald-200/90 font-medium mb-1">
            <span>Total Liquid Cash</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-300">
              <Clock className="w-3.5 h-3.5" />
              {totalTime.formattedFull}
            </span>
          </div>
          <div className="text-3xl font-black tracking-tight text-white font-mono">
            {formatCurrency(totalBalance, profile.currencySymbol)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-100/70 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Across {bankAccounts.length} {bankAccounts.length === 1 ? 'account' : 'accounts'}</span>
          </div>
        </div>
      </div>

      {/* Bank Accounts List or Genuine Empty State */}
      {bankAccounts.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">No bank accounts added yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Add your checking, savings, or business accounts to view your real cash reserves translated directly into hours of life freedom.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Add First Bank Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Connected Accounts ({bankAccounts.length})
            </span>
            <button
              onClick={handleOpenAdd}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another bank
            </button>
          </div>

          <div className="grid gap-3">
            {bankAccounts.map(account => {
              const accountBalance = Number(account.balance) || 0;
              const accountTime = convertAmountToTime(accountBalance, profile);

              return (
                <div
                  key={account.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
                      <Building2 className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {account.bankName}
                        </h4>
                        {account.label && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {account.label}
                          </span>
                        )}
                      </div>

                      {/* Time-equivalent subtext under the balance */}
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>≈ {accountTime.formattedFull} of work</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-extrabold text-slate-900 font-mono">
                      {formatCurrency(accountBalance, profile.currencySymbol)}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        onClick={() => handleOpenEdit(account)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit account"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete account"
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

      {/* Add / Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
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
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. Zenith Bank, GTBank, Kuda, Chase"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Account Label (Optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Salary, Emergency, Savings"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Current Balance ({profile.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  placeholder="250000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {balance && parseFloat(balance) > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Time value: <strong className="font-bold">{convertAmountToTime(parseFloat(balance) || 0, profile).formattedFull}</strong> of work
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-98"
              >
                {editingAccount ? 'Save Changes' : 'Add Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
