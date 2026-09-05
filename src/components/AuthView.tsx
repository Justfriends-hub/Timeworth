import React, { useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase';
import { Clock, Mail, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!supabase) {
      setError('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) throw err;
        // If email confirmations are enabled, Supabase returns no session
        if (!data.session && data.user && !data.user.email_confirmed_at) {
          setInfo('Account created! Check your email to confirm, then log in.');
          setMode('login');
        } else {
          setInfo('Account created and logged in!');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (err) throw err;
        // onAuthStateChange in AppContext will auto-route
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-0 bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200">
        {/* Left - brand */}
        <div className="bg-gradient-to-br from-teal-900 via-slate-900 to-emerald-900 p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-400/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                <Clock className="w-5 h-5" />
              </div>
              <span className="font-extrabold tracking-tight text-lg">TimeWorth</span>
              <span className="ml-2 text-[10px] font-bold tracking-widest bg-white/10 border border-white/20 px-2 py-1 rounded-full">BUDGET IN TIME</span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black leading-tight tracking-tight">
              Budgeting in <span className="text-emerald-400">hours of work</span><br />instead of just currency.
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-md">
              Every naira has a time cost. TimeWorth converts your income into an hourly rate so every expense shows its true labor price.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-emerald-300" /></div>
                <div>
                  <div className="font-bold text-white text-xs">Secured with Supabase Auth</div>
                  <div className="text-[11px] text-slate-400">RLS: you only see your own data (user_id = auth.uid())</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><Sparkles className="w-4 h-4 text-emerald-300" /></div>
                <div>
                  <div className="font-bold text-white text-xs">Schema-aware • 7 tables</div>
                  <div className="text-[11px] text-slate-400">profiles, categories, expenses, income, goals, bank_accounts, debtors</div>
                </div>
              </div>
            </div>
          </div>

          <p className="relative text-[11px] text-slate-400 mt-8">By continuing you agree to our Terms. Demo uses in-memory fallback if Supabase not configured.</p>
        </div>

        {/* Right - form */}
        <div className="p-8 lg:p-10 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode==='login' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'}`}>Login</button>
              <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode==='signup' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}`}>Sign up</button>
            </div>
          </div>

          {!supabase && (
            <div className="mb-4 flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Supabase not configured on this deployment. Auth will fail until <code className="font-mono bg-white px-1 rounded">VITE_SUPABASE_URL</code> + <code className="font-mono bg-white px-1 rounded">VITE_SUPABASE_ANON_KEY</code> are set (Vercel env).</span>
            </div>
          )}

          {error && (
            <div className="mb-4 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2.5 rounded-xl">{info}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Full name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Molly Johnson" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup' ? 'Min 6 characters' : 'Your password'} className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" autoComplete={mode==='signup' ? 'new-password' : 'current-password'} />
                <button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-3 top-3 p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                  {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {mode==='signup' && <p className="text-[11px] text-slate-400 mt-1.5">Triggers Supabase trigger <code className="font-mono bg-slate-100 px-1 rounded">handle_new_user()</code> — auto-creates profile + 12 default categories.</p>}
            </div>

            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-2xl shadow-md transition text-sm">
              {loading ? 'Please wait...' : mode==='signup' ? 'Create account' : 'Log in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            {mode==='login' ? (
              <p className="text-xs text-slate-500">No account? <button onClick={()=>setMode('signup')} className="font-bold text-emerald-700 hover:underline">Sign up</button></p>
            ) : (
              <p className="text-xs text-slate-500">Already have an account? <button onClick={()=>setMode('login')} className="font-bold text-slate-900 hover:underline">Log in</button></p>
            )}
          </div>

          <div className="mt-auto pt-6 text-[11px] text-slate-400 leading-relaxed border-t border-slate-100">
            Schema FK: <code className="font-mono bg-slate-100 px-1 rounded">profiles.user_id -&gt; auth.users.id</code>. Expenses use composite FK <code className="font-mono bg-slate-100 px-1 rounded">(user_id, category_id) -&gt; categories(user_id,id)</code> — do not insert categories without user_id.
          </div>
        </div>
      </div>
    </div>
  );
};
