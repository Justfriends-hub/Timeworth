import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { DesktopMollyLayout } from './components/DesktopMollyLayout';
import { MobileScaffold } from './components/MobileScaffold';
import { OnboardingFlow } from './components/OnboardingFlow';
import { AuthView } from './components/AuthView';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { Smartphone, Monitor, Layout, Clock, LogOut } from 'lucide-react';
import { getSupabaseBrowser } from './lib/supabase';

function MainApp() {
  const { deviceMode, setDeviceMode, profile, isLoading, isAuthLoading, user, signOut } = useApp();
  const [mobileFramed, setMobileFramed] = useState(false);
  const supabase = getSupabaseBrowser();
  const isSupabaseConfigured = !!supabase;

  // Initial loader while state is being hydrated
  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center animate-pulse">
          <Clock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">TimeWorth</h2>
          <p className="text-xs text-slate-400">{isAuthLoading ? 'Checking session...' : 'Loading your real numbers...'}</p>
        </div>
      </div>
    );
  }

  // 1) If Supabase is configured and no session -> show login
  if (isSupabaseConfigured && !user) {
    return <AuthView />;
  }

  // 2) Logged in (or demo mode) but onboarding not done -> onboarding
  if (!profile.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <OnboardingFlow />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Device & Viewport Switcher Toolbar */}
      <header className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-50 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold tracking-tight text-sm text-white font-sans">
              TimeWorth
            </span>
          </div>

          <span className="hidden md:inline text-slate-400 font-medium border-l border-slate-700 pl-3">
            Budgeting in <strong className="text-emerald-400">hours of work</strong> instead of just currency
          </span>
        </div>

        {/* Viewport Layout Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-slate-800 rounded-xl border border-slate-700">
            <button
              onClick={() => setDeviceMode('responsive')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
                deviceMode === 'responsive'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Responsive layout (adapts to browser screen)"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Responsive</span>
            </button>

            <button
              onClick={() => setDeviceMode('desktop')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
                deviceMode === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop 3-column layout (Reference Image 1: Molly)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop (Molly)</span>
            </button>

            <button
              onClick={() => setDeviceMode('mobile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
                deviceMode === 'mobile'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Phone-first design (Reference Images 2, 5, 6: Ella & Molly)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile (Ella)</span>
            </button>
          </div>

          {deviceMode === 'mobile' && (
            <label className="hidden sm:flex items-center gap-1.5 text-slate-300 cursor-pointer ml-1 text-[11px] bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <input
                type="checkbox"
                checked={mobileFramed}
                onChange={e => setMobileFramed(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-500"
              />
              <span>Phone Frame</span>
            </label>
          )}

          <div className="hidden sm:block pl-2 border-l border-slate-700">
            <SyncStatusBadge compact />
          </div>

          {isSupabaseConfigured && user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
              <span className="hidden lg:inline text-[11px] text-slate-400 max-w-[160px] truncate">{user.email}</span>
              <button onClick={signOut} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 text-[11px] font-bold">
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main View Render */}
      <main className="flex-1">
        {deviceMode === 'desktop' ? (
          <DesktopMollyLayout />
        ) : deviceMode === 'mobile' ? (
          <MobileScaffold framed={mobileFramed} />
        ) : (
          // Responsive Mode: Displays desktop 3-column on >= lg screens, mobile view on < lg screens
          <div>
            <div className="hidden lg:block">
              <DesktopMollyLayout />
            </div>
            <div className="block lg:hidden">
              <MobileScaffold framed={false} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
