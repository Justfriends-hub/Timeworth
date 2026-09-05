export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP';

export interface UserProfile {
  name: string;
  monthlyIncome: number;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  currency: CurrencyCode;
  currencySymbol: string;
  hourlyRate: number; // computed
  dailyRate: number; // computed
  showAmountsInTime: boolean;
  timePrimary: boolean;
  onboardingCompleted: boolean;
}

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon identifier
  color: string; // Hex or tailwind color class
  bgColor: string;
  type: CategoryType;
  monthlyBudget: number;
  spent: number;
}

export interface ExpenseEntry {
  id: string;
  amount: number;
  title: string;
  categoryId: string;
  dateTime: string; // ISO string
  note?: string;
  timeEquivalentSeconds?: number;
}

export interface IncomeEntry {
  id: string;
  amount: number;
  source: string;
  category: string;
  dateTime: string; // ISO string
  note?: string;
}

export type GoalSection = 'special' | 'smart' | 'consumer';

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  icon: string;
  color: string;
  section: GoalSection;
  createdAt: string;
  note?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  label?: string;
  balance: number;
  lastUpdated: string;
}

export interface Debtor {
  id: string;
  name: string;
  amountOwed: number;
  dateLent: string;
  dueDate?: string;
  status: 'owing' | 'paid';
  note?: string;
  createdAt: string;
}

export interface AppInsight {
  id: string;
  text: string;
  subtext: string;
  relatedCategoryId?: string;
  hoursSpent: number;
  type: 'alert' | 'info' | 'positive';
}

export interface AppDataPayload {
  profile: UserProfile;
  categories: Category[];
  expenses: ExpenseEntry[];
  income: IncomeEntry[];
  goals: Goal[];
  bankAccounts: BankAccount[];
  debtors: Debtor[];
  lastUpdated: string;
}

export type AppView = 
  | 'dashboard'
  | 'banks'
  | 'debtors'
  | 'categories'
  | 'category-detail'
  | 'expenses'
  | 'add'
  | 'goals'
  | 'trends'
  | 'settings'
  | 'onboarding';
