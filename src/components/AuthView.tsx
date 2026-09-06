import React, { useState, useEffect } from 'react';
import { getSupabaseBrowser } from '../lib/supabase';
import { Clock, Mail, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, AlertCircle, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'recovery'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  // Detect password-recovery session (user clicked email link)
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
        setInfo('Reset link verified. Set your new password below.');
      }
    });
    // Also check if we landed with a recovery hash already
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=magiclink')) {
      // Supabase with detectSessionInUrl will auto handle, but ensure UI switches
      // Small delay to let session establish
      setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) setMode('recovery');
        });
      }, 500);
    }
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!supabase) {
      setError('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

    // Forgot flow
    if (mode === 'forgot') {
      if (!email.trim()) { setError('Enter your email to receive a reset link.'); return; }
      setLoading(true);
      try {
        const redirectTo = window.location.origin;
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
        if (err) throw err;
        setInfo(`Reset link sent to ${email.trim()} — check inbox (and spam). Link expires in 1 hour.`);
      } catch (err: any) {
        setError(err?.message || 'Failed to send reset email');
      } finally { setLoading(false); }
      return;
    }

    // Recovery — set new password
    if (mode === 'recovery') {
      if (!newPassword || newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
      if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
      setLoading(true);
      try {
        const { error: err } = await supabase.auth.updateUser({ password: newPassword });
        if (err) throw err;
        setInfo('Password updated! You are now logged in.');
        // Clear hash and let AppContext route to dashboard/onboarding
        window.history.replaceState(null, '', window.location.pathname);
        setTimeout(() => {
          // Force reload to let auth state propagate — or just switch to login
          setMode('login');
          setNewPassword(''); setConfirmPassword('');
        }, 1200);
      } catch (err: any) {
        setError(err?.message || 'Failed to update password');
      } finally { setLoading(false); }
      return;
    }

    // Login / Signup
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

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) throw err;
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
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const isRecovery = mode === 'recovery';
  const isForgot = mode === 'forgot';

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

            <div className="mt-6 grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5"><Clock className="w-4 h-4 text-emerald-300" /></div>
                <div>
                  <div className="font-bold text-white text-xs">See how much LIFE you're spending</div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">Every ₦20,000 is ~8 hours of your life. Stop wasting <span className="text-emerald-300 font-bold">years</span> on impulse buys — see the real cost in hours & years.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5"><User className="w-4 h-4 text-amber-300" /></div>
                <div>
                  <div className="font-bold text-white text-xs">Track what debtors owe in LIFE-TIME</div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">Someone owes you ₦500k? That's <span className="text-amber-300 font-bold">185 hours</span> of your work holding in their pocket.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0 mt-0.5"><Sparkles className="w-4 h-4 text-sky-300" /></div>
                <div>
                  <div className="font-bold text-white text-xs">Flexible — type manually OR upload statements</div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">Prefer typing? Enter amounts manually. Or upload <span className="text-white font-bold">multiple bank statements</span> (PDF/CSV/photos) — AI reads & converts to hours. Both work!</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5"><ShieldCheck className="w-4 h-4 text-emerald-300" /></div>
                <div>
                  <div className="font-bold text-white text-xs">No salary? AI figures it out</div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">Don't know your monthly income? Upload your statement and <span className="text-emerald-300 font-bold">AI estimates your salary</span> from your inflows — no guesswork.</div>
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
              {isRecovery ? 'Reset password' : isForgot ? 'Forgot password' : mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            {!isRecovery && !isForgot && (
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode==='login' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'}`}>Login</button>
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode==='signup' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}`}>Sign up</button>
              </div>
            )}
            {(isForgot || isRecovery) && (
              <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-200">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </button>
            )}
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
            <div className="mb-4 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2.5 rounded-xl flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRecovery ? (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">New password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Min 6 characters" className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" autoComplete="new-password" />
                    <button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-3 top-3 p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                      {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Confirm new password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" autoComplete="new-password" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-2xl shadow-md transition text-sm">
                  {loading ? 'Updating...' : 'Update password'} {!loading && <KeyRound className="w-4 h-4" />}
                </button>
                <p className="text-[11px] text-slate-400 text-center">After update you'll be logged in automatically.</p>
              </>
            ) : isForgot ? (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" autoComplete="email" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">We'll send a secure reset link valid for 1 hour. Check spam if you don't see it.</p>
                </div>
                <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold rounded-2xl shadow-md transition text-sm">
                  {loading ? 'Sending...' : 'Send reset link'} {!loading && <Mail className="w-4 h-4" />}
                </button>
              </>
            ) : (
              <>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    {mode==='login' && <button type="button" onClick={()=>{setMode('forgot'); setError(null); setInfo(null);}} className="text-[11px] font-bold text-emerald-700 hover:underline">Forgot password?</button>}
                  </div>
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
              </>
            )}
          </form>

          {!isRecovery && !isForgot && (
            <div className="mt-6 text-center">
              {mode==='login' ? (
                <p className="text-xs text-slate-500">No account? <button onClick={()=>setMode('signup')} className="font-bold text-emerald-700 hover:underline">Sign up</button> <span className="mx-1">·</span> <button onClick={()=>{setMode('forgot'); setError(null); setInfo(null);}} className="font-bold text-slate-600 hover:underline">Forgot password?</button></p>
              ) : (
                <p className="text-xs text-slate-500">Already have an account? <button onClick={()=>setMode('login')} className="font-bold text-slate-900 hover:underline">Log in</button></p>
              )}
            </div>
          )}
          {isForgot && (
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500">Remembered? <button onClick={()=>setMode('login')} className="font-bold text-slate-900 hover:underline">Back to login</button></p>
            </div>
          )}

          <div className="mt-auto pt-6 text-[11px] text-slate-400 leading-relaxed border-t border-slate-100">
            Upload multiple statements — AI extracts salary & transactions instantly. No manual entry needed.
          </div>
        </div>
      </div>
    </div>
  );
};
