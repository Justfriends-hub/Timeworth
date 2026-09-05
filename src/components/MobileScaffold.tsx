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
  Plus, 
  Target, 
  TrendingUp, 
  Settings, 
  Wifi, 
  Battery, 
  Signal 
} from 'lucide-react';

export const MobileScaffold: React.FC<{ framed?: boolean }> = ({ framed = false }) => {
  const { activeView, setActiveView } = useApp();

  const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  interface NavItem {
    id: 'dashboard' | 'categories' | 'add' | 'goals' | 'trends';
    label: string;
    icon: any;
    isSpecial?: boolean;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'categories', label: 'Categories', icon: Grid },
    { id: 'add', label: 'Add', icon: Plus, isSpecial: true },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'trends', label: 'Analytics', icon: TrendingUp },
  ];

  const content = (
    <div className="flex flex-col min-h-screen bg-slate-50 relative pb-24">
      {/* Mobile Top Status Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-2.5 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 tracking-tight">
          {currentTimeStr}
        </span>

        {/* Sync Status Badge */}
        <SyncStatusBadge compact />

        <div className="flex items-center gap-1.5 text-slate-700">
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <Battery className="w-4 h-4" />
        </div>
      </div>

      {/* Viewport Content */}
      <div className="p-4 flex-1">
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

      {/* Floating Bottom Navigation Bar matching Mobile References 2, 5, 6 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-4 py-2 flex items-center justify-around shadow-lg">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id || (item.id === 'categories' && activeView === 'category-detail');

          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveView('add')}
                className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-transform"
                title="Add Expense"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
                isActive ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Quick Settings Icon */}
        <button
          onClick={() => setActiveView('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeView === 'settings' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
          }`}
          title="Settings"
        >
          <Settings className={`w-5 h-5 ${activeView === 'settings' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className={`text-[10px] ${activeView === 'settings' ? 'font-bold' : 'font-medium'}`}>
            Rates
          </span>
        </button>
      </nav>
    </div>
  );

  if (framed) {
    return (
      <div className="flex justify-center items-center py-8 px-4 bg-slate-900/90 min-h-screen">
        {/* iPhone Frame Simulator (390 x 844) */}
        <div className="w-[390px] h-[844px] bg-white rounded-[50px] shadow-2xl border-[10px] border-slate-800 overflow-hidden relative flex flex-col">
          {/* Dynamic Island Notch */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-end px-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[430px] mx-auto min-h-screen shadow-2xl bg-white">
      {content}
    </div>
  );
};
