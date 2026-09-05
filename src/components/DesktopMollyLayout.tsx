import React from 'react';
import { useApp } from '../context/AppContext';
import { MollyDashboard } from './MollyDashboard';
import { EllaCategoryGrid } from './EllaCategoryGrid';
import { EllaCategoryDetail } from './EllaCategoryDetail';
import { AddExpenseModal } from './AddExpenseModal';
import { GoalsWishlistView } from './GoalsWishlistView';
import { TrendsStatsView } from './TrendsStatsView';
import { ExpensesListView } from './ExpensesListView';
import { SettingsView } from './SettingsView';
import { BankAccountsView } from './BankAccountsView';
import { DebtorsView } from './DebtorsView';
import { SyncStatusBadge } from './SyncStatusBadge';
import { 
  LayoutDashboard, 
  Grid, 
  Receipt, 
  Target, 
  TrendingUp, 
  Settings, 
  PlusCircle, 
  Bell, 
  Search,
  Sparkles,
  Clock,
  LogOut,
  Wallet,
  Building2,
  Users
} from 'lucide-react';

export const DesktopMollyLayout: React.FC = () => {
  const { activeView, setActiveView, profile } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'categories', label: 'Categories', icon: Grid },
    { id: 'expenses', label: 'Transactions', icon: Receipt },
    { id: 'bank-accounts', label: 'Bank Accounts', icon: Building2 },
    { id: 'debtors', label: 'Debtors & Loans', icon: Users },
    { id: 'goals', label: 'Goals & Wishlist', icon: Target },
    { id: 'trends', label: 'Analytics', icon: TrendingUp },
    { id: 'settings', label: 'Hourly Rate & Settings', icon: Settings },
  ] as const;

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      {/* Left Column: Molly Sidebar matching Image 1 */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between p-6 shrink-0 sticky top-0 h-screen">
        <div className="space-y-8">
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-500 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">
                TimeWorth
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 block uppercase tracking-wider">
                Time-Based Budgeting
              </span>
            </div>
          </div>

          {/* Navigation Links matching Image 1 */}
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.id || (item.id === 'categories' && activeView === 'category-detail');
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-200/60'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Promo Card matching Molly Reference Image 1 */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/70 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold">Time Mindset</span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed font-medium">
              Every ₦{Math.round(profile.hourlyRate).toLocaleString()} is 60 minutes of labor. Think in hours before checkout!
            </p>
            <button
              onClick={() => setActiveView('add')}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              + Quick Log
            </button>
          </div>

          {/* User profile mini pill */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                {profile.name ? profile.name[0] : 'M'}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block truncate max-w-[100px]">
                  {profile.name || 'Molly'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {profile.currencySymbol}{Math.round(profile.hourlyRate)}/hr
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveView('settings')}
              className="text-slate-400 hover:text-slate-700 p-1"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Desktop Bar matching Image 1 */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30">
          {/* Search bar */}
          <div className="relative w-80 hidden sm:block">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses, categories, or goals..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Right Actions & Sync Status */}
          <div className="flex items-center gap-4">
            <SyncStatusBadge />
            <button
              onClick={() => setActiveView('add')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>
          </div>
        </header>

        {/* Page Dynamic View */}
        <div className="p-8 flex-1">
          {activeView === 'dashboard' && <MollyDashboard />}
          {activeView === 'categories' && <EllaCategoryGrid />}
          {activeView === 'category-detail' && <EllaCategoryDetail />}
          {activeView === 'expenses' && <ExpensesListView />}
          {activeView === 'bank-accounts' && <BankAccountsView />}
          {activeView === 'debtors' && <DebtorsView />}
          {activeView === 'add' && <AddExpenseModal />}
          {activeView === 'goals' && <GoalsWishlistView />}
          {activeView === 'trends' && <TrendsStatsView />}
          {activeView === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
};
