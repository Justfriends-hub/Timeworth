import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateHourlyRate, formatCurrency } from '../utils/timeConversion';
import { ArrowLeft, Check, RotateCcw, Clock, Calculator, Sliders, Shield, Download, Upload, LogOut, FileText, AlertTriangle, Sparkles, UploadCloud, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { convertAmountToTime } from '../utils/timeConversion';
import { getSupabaseBrowser } from '../lib/supabase';

export const SettingsView: React.FC = () => {
  const { profile, updateProfile, resetData, setActiveView, user, signOut, ingestStatements, categories } = useApp();
  const supabase = getSupabaseBrowser();

  const [monthlyIncome, setMonthlyIncome] = useState(profile.monthlyIncome.toString());
  const [workDays, setWorkDays] = useState(profile.workDaysPerWeek);
  const [workHours, setWorkHours] = useState(profile.workHoursPerDay);
  const [name, setName] = useState(profile.name);
  const [currency, setCurrency] = useState(profile.currencySymbol || '₦');
  const [showTime, setShowTime] = useState(profile.showAmountsInTime);
  const [timePrimary, setTimePrimary] = useState(profile.timePrimary);

  const [isSaved, setIsSaved] = useState(false);

  // Re-upload statement in Settings (post-onboarding) — OpenRouter row-by-row AI + local fallback, fills Dashboard analytics
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [importedTxs, setImportedTxs] = useState<any[]>([]);
  const [importedNames, setImportedNames] = useState<string[]>([]);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);


  // Safe base64 decode that never throws "pattern" error - strips invalid chars, pads, and uses robust decoding
  const safeAtob = (b64: string): string => {
    try {
      const clean = b64.replace(/\s/g,'').replace(/[^A-Za-z0-9+/=]/g,'');
      // pad to multiple of 4
      const pad = (4 - (clean.length % 4)) % 4;
      const padded = clean + '='.repeat(pad);
      return atob(padded);
    } catch { return ''; }
  };
  const safeB64ToBytes = (b64: string): Uint8Array | null => {
    try {
      const clean = b64.replace(/\s/g,'').replace(/[^A-Za-z0-9+/=]/g,'');
      const pad = (4 - (clean.length % 4)) % 4;
      const padded = clean + '='.repeat(pad);
      const bin = atob(padded);
      const bytes = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
      return bytes;
    } catch { return null; }
  };

  // LOCAL COMMENTED OUT - AI ONLY: Settings localParseFallback disabled
  const localParseFallback = (file: File, fileData: string): any[] => {
    console.warn('[settings localParseFallback] disabled - AI-only mode');
    return [];
  };

  const handleSettingsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length===0) return;
    setIsParsing(true); setParseError(null); setParseWarning(null); setIngestSuccess(null);
    setImportedNames(files.map(f=>f.name));
    const readAsData = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read '+file.name));
      const n=file.name.toLowerCase();
      if(n.endsWith('.csv')||file.type.includes('csv')) reader.readAsText(file); else reader.readAsDataURL(file);
    });
    try {
      let all:any[]=[...importedTxs];
      for (const file of files) {
        const fileData = await readAsData(file);
        const res = await fetch('/api/gemini/parse-statement', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fileData, mimeType: file.type||'text/plain', fileName: file.name, existingTransactions: all }) });
        let data:any;
        try { const txt=await res.text(); data=txt?JSON.parse(txt):{}; } catch (e:any) {
          // LOCAL COMMENTED OUT - AI ONLY
          // const local=localParseFallback(file,fileData);
          // if(local.length>0){ ... }
          throw new Error('AI parsing failed for '+file.name+' ('+res.status+') — OpenRouter did not return valid JSON. Local fallback is disabled (AI-only mode).');
        }
        if(data.warning) setParseWarning(data.warning);
        if(data.method) setParseWarning((p:string|null)=> (p?p+' | ':'') + 'AI method: '+data.method+' row-by-row');
        if(!res.ok){
          const msg=data.error||'Failed to parse '+file.name;
          // LOCAL COMMENTED OUT - AI ONLY for 413/too large
          // if(res.status===413||String(msg).toLowerCase().includes('too large')){ const local=localParseFallback... }
          throw new Error(msg + (data.warning?' — '+data.warning:''));
        }
        if(data.transactions && Array.isArray(data.transactions)){
          for(const tx of data.transactions){
            const dup=all.some((ex:any)=>ex.date===tx.date&&Math.abs(ex.amount-tx.amount)<0.01&&ex.description===tx.description);
            if(!dup) all.push(tx); else all.push({...tx,isDuplicate:true,confirmed:false});
          }
        }
      }
      setImportedTxs(all);
      if(all.length===0) setParseError('No transactions found. Try CSV/XLSX export — all rows are carried.');
    } catch(err:any){ setParseError(err.message||'Failed to parse'); }
    finally { setIsParsing(false); e.target.value=''; }
  };

  const handleIngest = async () => {
    const toIngest = importedTxs.filter((t:any)=>t.confirmed);
    if(toIngest.length===0){ setParseError('Confirm at least one transaction to add to Dashboard.'); return; }
    setIsParsing(true); setParseError(null);
    try {
      const result = await ingestStatements(toIngest);
      setIngestSuccess('Added '+result.total+' transactions ('+result.addedExpenses+' expenses, '+result.addedIncome+' income) — Dashboard categories & analytics updated.');
      setImportedTxs([]); setImportedNames([]);
      setTimeout(()=>setIngestSuccess(null), 6000);
    } catch(err:any){ setParseError(err.message||'Failed to add to dashboard'); }
    finally { setIsParsing(false); }
  };

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

      {/* Re-upload Statement Card - Settings (post-onboarding) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white"><UploadCloud className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Re-upload Statement</h3>
            <p className="text-[11px] text-slate-500">Did upload fail or you skipped it? Add XLS/CSV/PDF again — OpenRouter AI reads row-by-row and fills Dashboard categories & analytics.</p>
          </div>
        </div>

        <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-emerald-50/30 transition-all">
          <Upload className="w-6 h-6 text-emerald-600 mb-1" />
          <span className="text-xs font-bold text-slate-800 text-center">{importedNames.length>0 ? importedNames.length+' file(s): '+importedNames.join(', ').slice(0,80) : 'Click to select XLS/XLSX/CSV/PDF'}</span>
          <span className="text-[11px] text-slate-400">XLS/XLSX row-by-row AI • PDF • CSV — all rows carried, no size limit</span>
          <input type="file" accept=".pdf,.csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*" multiple onChange={handleSettingsUpload} className="hidden" />
        </label>

        {isParsing && <div className="p-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse" /> OpenRouter AI reading row-by-row...</div>}
        {parseWarning && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{parseWarning}</span></div>}
        {parseError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /><span>{parseError}</span></div>}
        {ingestSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /><span>{ingestSuccess}</span></div>}

        {importedTxs.length>0 && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Review ({importedTxs.filter((t:any)=>t.confirmed).length}/{importedTxs.length} to add)</span>
              <div className="flex gap-2">
                <button type="button" onClick={()=>setImportedTxs((prev:any[])=>prev.map(t=>({...t,confirmed:true})))} className="text-[11px] font-bold text-emerald-700 underline">Confirm All</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={()=>setImportedTxs((prev:any[])=>prev.map(t=>({...t,confirmed:false})))} className="text-[11px] font-bold text-slate-500 underline">Uncheck All</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={()=>{setImportedTxs([]); setImportedNames([]);}} className="text-[11px] font-bold text-rose-600 underline">Clear</button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {importedTxs.map((tx:any)=>{
                const time = convertAmountToTime(tx.amount, { name: profile.name, monthlyIncome: profile.monthlyIncome, workHoursPerDay: profile.workHoursPerDay, workDaysPerWeek: profile.workDaysPerWeek, currency: profile.currency, currencySymbol: profile.currencySymbol, hourlyRate: profile.hourlyRate, dailyRate: profile.dailyRate, showAmountsInTime:true, timePrimary:false, onboardingCompleted:true } as any);
                return (
                  <label key={tx.id} className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer ${tx.confirmed ? 'border-slate-200 bg-white' : 'border-slate-100 opacity-50 bg-white'}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input type="checkbox" checked={tx.confirmed} onChange={()=>setImportedTxs((prev:any[])=>prev.map(p=>p.id===tx.id?{...p,confirmed:!p.confirmed}:p))} className="w-4 h-4 rounded text-emerald-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap"><span className="font-mono text-[11px] text-slate-500">{tx.date}</span><span className="font-bold text-slate-900 truncate">{tx.description}</span><span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700">{tx.month}</span></div>
                        <div className="text-[10px] text-emerald-700 font-bold">≈ {time.formattedFull} of work • {tx.suggestedCategory}</div>
                      </div>
                    </div>
                    <span className={`font-mono font-extrabold text-xs ${tx.type==='expense'?'text-slate-900':'text-emerald-700'}`}>{tx.type==='expense'?'-':'+'}{tx.amount.toLocaleString()}</span>
                  </label>
                );
              })}
            </div>
            <button onClick={handleIngest} disabled={isParsing} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Add {importedTxs.filter((t:any)=>t.confirmed).length} to Dashboard
            </button>
            <p className="text-[11px] text-slate-400 text-center">Adds to expenses/income and updates Home category analytics instantly.</p>
          </div>
        )}
      </div>

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

      {/* Auth Card */}
      {supabase && user ? (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-600" /> Account</h4>
          <div className="text-xs">
            <div className="text-slate-500">Logged in as</div>
            <div className="font-bold text-slate-900 break-all">{user.email}</div>
            <div className="text-[11px] text-slate-400 font-mono break-all">uid: {user.id}</div>
          </div>
          <button
            onClick={signOut}
            className="w-full inline-flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      ) : !supabase ? (
        <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200">
          <h4 className="text-xs font-bold text-amber-800">Demo mode (no Supabase)</h4>
          <p className="text-[11px] text-amber-700 mt-1">Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to enable real login + RLS. Data currently lives in memory and resets on restart.</p>
        </div>
      ) : null}
    </div>
  );
};
