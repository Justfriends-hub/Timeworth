import { UserProfile } from '../types';

/**
 * Calculates hourly rate based on simple mode formula:
 * hourlyRate = monthlyIncome / (workDaysPerWeek * 4.33 * workHoursPerDay)
 */
export function calculateHourlyRate(
  monthlyIncome: number,
  workDaysPerWeek: number = 5,
  workHoursPerDay: number = 8
): { hourlyRate: number; dailyRate: number; monthlyHours: number } {
  const safeDays = Math.max(1, workDaysPerWeek);
  const safeHours = Math.max(1, workHoursPerDay);
  const monthlyHours = safeDays * 4.33 * safeHours;
  const safeIncome = Math.max(0, monthlyIncome);
  const hourlyRate = monthlyHours > 0 ? safeIncome / monthlyHours : 0;
  const dailyRate = hourlyRate * safeHours;
  return { hourlyRate, dailyRate, monthlyHours };
}

/**
 * Converts a currency amount into hours, minutes, and human-readable text
 */
export function convertAmountToTime(
  amount: number,
  profile: UserProfile
): {
  totalHours: number;
  days: number;
  hours: number;
  minutes: number;
  formattedShort: string;
  formattedFull: string;
} {
  const hourlyRate = profile.hourlyRate > 0 
    ? profile.hourlyRate 
    : calculateHourlyRate(profile.monthlyIncome, profile.workDaysPerWeek, profile.workHoursPerDay).hourlyRate;

  if (hourlyRate <= 0 || amount <= 0) {
    return {
      totalHours: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      formattedShort: '0m',
      formattedFull: '0 minutes of work',
    };
  }

  const totalHours = amount / hourlyRate;
  const totalMinutes = Math.round(totalHours * 60);

  const workHoursPerDay = Math.max(1, profile.workHoursPerDay || 8);
  const days = Math.floor(totalHours / workHoursPerDay);
  const remainingHours = Math.floor(totalHours % workHoursPerDay);
  const minutes = totalMinutes % 60;

  let formattedShort = '';
  let formattedFull = '';

  if (days >= 1) {
    if (remainingHours > 0) {
      formattedShort = `${days}d ${remainingHours}h`;
      formattedFull = `${days} day${days > 1 ? 's' : ''} ${remainingHours}h of work`;
    } else {
      formattedShort = `${days}d`;
      formattedFull = `${days} day${days > 1 ? 's' : ''} of work`;
    }
  } else if (Math.floor(totalHours) >= 1) {
    const h = Math.floor(totalHours);
    if (minutes > 0) {
      formattedShort = `${h}h ${minutes}m`;
      formattedFull = `${h}h ${minutes}m of work`;
    } else {
      formattedShort = `${h}h`;
      formattedFull = `${h} hour${h > 1 ? 's' : ''} of work`;
    }
  } else {
    const m = Math.max(1, Math.round(totalHours * 60));
    formattedShort = `${m}m`;
    formattedFull = `${m} minute${m > 1 ? 's' : ''} of work`;
  }

  return {
    totalHours,
    days,
    hours: remainingHours,
    minutes,
    formattedShort,
    formattedFull,
  };
}

/**
 * Format currency with symbols and commas
 */
export function formatCurrency(
  amount: number,
  symbol: string = '₦',
  decimals: boolean = false
): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formattedNumber = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

  return `${isNegative ? '-' : ''}${symbol}${formattedNumber}`;
}
