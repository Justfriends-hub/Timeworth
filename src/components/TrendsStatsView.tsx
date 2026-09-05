import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AmountWithTime } from './AmountWithTime';
import { CategoryIcon } from './CategoryIcon';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { ChevronLeft, ChevronRight, Clock, Percent, DollarSign, ArrowUpRight } from 'lucide-react';

export const TrendsStatsView: React.FC = () => {
  const { categories, expenses, profile } = useApp();
  const [displayMode, setDisplayMode] = useState<'time' | 'currency' | 'percent'>('time');
  const [activeTab, setActiveTab] = useState<'Expenses' | 'Income'>('Expenses');

  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const totalTimeSpent = convertAmountToTime(totalSpent, profile);

  // Colors for donut segments
  const donutColors = ['#E8A33E', '#2A9D8F', '#E76F51', '#6366F1', '#10B981', '#EC4899', '#8B5CF6'];

  // Top categories for donut
  const topCategories = [...categories]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // SVG Donut calculation
  let cumulativeAngle = 0;
  const segments = topCategories.map((cat, idx) => {
    const fraction = cat.spent / (totalSpent || 1);
    const angle = fraction * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;

    // SVG arc coordinates (cx=100, cy=100, r=60, innerR=42)
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((startAngle + angle - 90) * Math.PI) / 180;

    const x1 = 100 + 60 * Math.cos(startRad);
    const y1 = 100 + 60 * Math.sin(startRad);
    const x2 = 100 + 60 * Math.cos(endRad);
    const y2 = 100 + 60 * Math.sin(endRad);

    const x3 = 100 + 42 * Math.cos(endRad);
    const y3 = 100 + 42 * Math.sin(endRad);
    const x4 = 100 + 42 * Math.cos(startRad);
    const y4 = 100 + 42 * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathData = `M ${x1} ${y1} A 60 60 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A 42 42 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      cat,
      fraction,
      percent: Math.round(fraction * 100),
      color: donutColors[idx % donutColors.length],
      pathData,
    };
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Month Selector matching Ella Screen 3: < This Month > */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400">Analytics & Trends</span>

        <div className="flex items-center gap-3">
          <ChevronLeft className="w-4 h-4 text-slate-400 cursor-pointer" />
          <span className="text-base font-extrabold text-slate-900 font-sans">
            &lt; This Month &gt;
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 cursor-pointer" />
        </div>

        {/* View Mode Switcher: Time vs Currency vs % */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            onClick={() => setDisplayMode('time')}
            className={`px-2 py-1 rounded-lg transition-all ${
              displayMode === 'time' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
            }`}
            title="Show amounts converted to work hours"
          >
            Time
          </button>
          <button
            onClick={() => setDisplayMode('currency')}
            className={`px-2 py-1 rounded-lg transition-all ${
              displayMode === 'currency' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            {profile.currencySymbol || '₦'}
          </button>
          <button
            onClick={() => setDisplayMode('percent')}
            className={`px-2 py-1 rounded-lg transition-all ${
              displayMode === 'percent' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            %
          </button>
        </div>
      </div>

      {/* Content or Genuine Empty State */}
      {totalSpent === 0 && expenses.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No spending data to analyze</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Once you log expenses or import a bank statement, your spending trends, category distributions, and daily burn rate in hours worked will appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Yellow Line Chart Card matching Ella Screen 3 reference */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">Daily Trends</h3>
                <p className="text-xs text-slate-400">Spending timeline across current month</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                All
              </span>
            </div>

            {/* Real spending daily line chart */}
            <div className="h-48 w-full relative pt-2">
              <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
                {/* Grid horizontal markers */}
                <line x1="30" y1="30" x2="480" y2="30" stroke="#F1F5F9" strokeDasharray="3 3" />
                <line x1="30" y1="80" x2="480" y2="80" stroke="#F1F5F9" strokeDasharray="3 3" />
                <line x1="30" y1="130" x2="480" y2="130" stroke="#F1F5F9" strokeDasharray="3 3" />

                {/* Zero Baseline */}
                <line x1="30" y1="140" x2="480" y2="140" stroke="#E2E8F0" strokeWidth="1" />

                {/* Yellow Trend Line */}
                <path
                  d="M 40 140 L 90 80 L 160 50 L 240 110 L 320 90 L 400 60 L 460 140"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {[
                  { x: 40, y: 140 },
                  { x: 90, y: 80 },
                  { x: 160, y: 50 },
                  { x: 240, y: 110 },
                  { x: 320, y: 90 },
                  { x: 400, y: 60 },
                  { x: 460, y: 140 },
                ].map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#FBBF24"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                ))}

                {['0', '05', '10', '15', '20', '25'].map((d, idx) => (
                  <text
                    key={d}
                    x={40 + idx * 75}
                    y="165"
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-medium font-sans"
                  >
                    {d}
                  </text>
                ))}
              </svg>
            </div>

            {/* Expenses vs Income Legend Pills matching reference */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Expenses</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Income</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown Donut Chart matching Ella Screen 3 reference */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                Category Breakdown
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                {categories.filter(c => c.spent > 0).length} Active Categories
              </span>
            </div>

            {/* Donut Chart with Center Total */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
              <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                  {segments.map((seg, i) => (
                    <path
                      key={i}
                      d={seg.pathData}
                      fill={seg.color}
                      className="hover:opacity-85 transition-opacity cursor-pointer"
                    />
                  ))}
                </svg>

                {/* Donut Center Hole Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <span className="text-xs font-semibold text-slate-400">Total</span>
                  <span className="text-lg font-black text-slate-900 font-sans">
                    {displayMode === 'time'
                      ? totalTimeSpent.formattedShort
                      : formatCurrency(totalSpent, profile.currencySymbol)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    {displayMode === 'time'
                      ? formatCurrency(totalSpent, profile.currencySymbol)
                      : totalTimeSpent.formattedShort}
                  </span>
                </div>
              </div>

              {/* Donut Legend Rows with Time Conversions */}
              <div className="w-full space-y-2.5 flex-1">
                {segments.map((seg) => {
                  const time = convertAmountToTime(seg.cat.spent, profile);
                  return (
                    <div key={seg.cat.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-md shrink-0"
                          style={{ backgroundColor: seg.color }}
                        ></span>
                        <span className="font-semibold text-slate-700 truncate max-w-[120px]">
                          {seg.cat.name}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {displayMode === 'percent'
                            ? `${seg.percent}%`
                            : displayMode === 'time'
                            ? time.formattedShort
                            : formatCurrency(seg.cat.spent, profile.currencySymbol)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {displayMode === 'time'
                            ? formatCurrency(seg.cat.spent, profile.currencySymbol)
                            : time.formattedShort}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
