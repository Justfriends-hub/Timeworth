import React from 'react';
import { useApp } from '../context/AppContext';
import { convertAmountToTime, formatCurrency } from '../utils/timeConversion';
import { Clock } from 'lucide-react';

interface AmountWithTimeProps {
  amount: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  align?: 'left' | 'right' | 'center';
  prefix?: string;
  suffix?: string;
  isNegative?: boolean;
  isPositive?: boolean;
  className?: string;
  showTimeSubtext?: boolean;
  secondaryTextPrefix?: string;
}

export const AmountWithTime: React.FC<AmountWithTimeProps> = ({
  amount,
  size = 'md',
  align = 'left',
  prefix = '',
  suffix = '',
  isNegative = false,
  isPositive = false,
  className = '',
  showTimeSubtext = true,
  secondaryTextPrefix = '≈ ',
}) => {
  const { profile } = useApp();
  const timeInfo = convertAmountToTime(amount, profile);

  const formattedCurr = `${prefix}${formatCurrency(amount, profile.currencySymbol || '₦')}${suffix}`;
  const shouldShowTime = showTimeSubtext && profile.showAmountsInTime;

  // Alignment classes
  const alignClass =
    align === 'right'
      ? 'items-end text-right'
      : align === 'center'
      ? 'items-center text-center'
      : 'items-start text-left';

  // Sizing styles
  const primarySizes: Record<string, string> = {
    xs: 'text-xs font-semibold',
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold tracking-tight',
    lg: 'text-lg font-bold tracking-tight',
    xl: 'text-2xl font-extrabold tracking-tight',
    '2xl': 'text-3xl sm:text-4xl font-extrabold tracking-tight',
  };

  const secondarySizes: Record<string, string> = {
    xs: 'text-[10px]',
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-xs',
    xl: 'text-sm',
    '2xl': 'text-sm sm:text-base',
  };

  // Color logic
  let textColor = 'text-slate-900';
  if (isNegative) textColor = 'text-rose-600';
  if (isPositive) textColor = 'text-emerald-600';

  // If user has chosen timePrimary in settings, swap order
  const isTimePrimary = profile.timePrimary;

  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      <span className={`${primarySizes[size]} ${textColor} leading-tight font-sans`}>
        {isTimePrimary ? timeInfo.formattedFull : formattedCurr}
      </span>
      {shouldShowTime && (
        <span
          className={`${secondarySizes[size]} text-slate-500 font-medium inline-flex items-center gap-1 mt-0.5`}
          title={`${timeInfo.formattedFull} at ${profile.currencySymbol || '₦'}${Math.round(profile.hourlyRate).toLocaleString()}/hr`}
        >
          <Clock className="w-3 h-3 text-emerald-600/70 inline-shrink-0" />
          <span>
            {isTimePrimary
              ? `${secondaryTextPrefix}${formattedCurr}`
              : `${secondaryTextPrefix}${timeInfo.formattedFull}`}
          </span>
        </span>
      )}
    </div>
  );
};
