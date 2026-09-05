-- Timeworth — Corrected Supabase schema
-- Deploy via Supabase Dashboard: SQL Editor -> paste -> Run
-- or via CLI: supabase db push

-- 0) Extensions (required for gen_random_uuid)
create extension if not exists "pgcrypto";

-- 1) profiles — one row per auth user
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  monthly_income numeric not null default 0,
  work_hours_per_day numeric not null default 8,
  work_days_per_week numeric not null default 5,
  currency text not null default 'NGN' check (currency in ('NGN','USD','EUR','GBP')),
  currency_symbol text not null default '₦',
  hourly_rate numeric not null default 0,
  daily_rate numeric not null default 0,
  show_amounts_in_time boolean not null default true,
  time_primary boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) categories — PK is (user_id, id) so each user has its own namespace
create table if not exists public.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  icon text not null,
  color text not null,
  bg_color text not null,
  type text not null check (type in ('expense','income')),
  monthly_budget numeric not null default 0,
  spent numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 3) expenses — FIXED composite FK (user_id, category_id) -> categories(user_id, id)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  title text not null,
  category_id text not null,
  date_time timestamptz not null default now(),
  note text default '',
  time_equivalent_seconds numeric,
  created_at timestamptz not null default now(),
  constraint expenses_user_category_fkey
    foreign key (user_id, category_id) references public.categories(user_id, id) on delete restrict
);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_user_category_idx on public.expenses(user_id, category_id);
create index if not exists expenses_date_time_idx on public.expenses(user_id, date_time desc);

-- 4) income
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  source text not null,
  category text not null default 'Income',
  date_time timestamptz not null default now(),
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists income_user_id_idx on public.income(user_id);

-- 5) goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_amount numeric not null check (target_amount > 0),
  saved_amount numeric not null default 0,
  icon text not null default 'Target',
  color text not null default '#10B981',
  section text not null default 'smart' check (section in ('special','smart','consumer')),
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on public.goals(user_id);

-- 6) bank_accounts
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null,
  label text default '',
  balance numeric not null default 0,
  last_updated timestamptz not null default now()
);
create index if not exists bank_accounts_user_id_idx on public.bank_accounts(user_id);

-- 7) debtors
create table if not exists public.debtors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount_owed numeric not null default 0,
  date_lent date not null default current_date,
  due_date date,
  status text not null default 'owing' check (status in ('owing','paid')),
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists debtors_user_id_idx on public.debtors(user_id);

-- ── Auto-update updated_at trigger for profiles ──
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.handle_updated_at();

-- ── Auto-create profile + default categories on signup ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''));

  insert into public.categories (user_id, id, name, icon, color, bg_color, type, monthly_budget, spent) values
    (new.id, 'cat-groceries', 'Groceries', 'Apple', '#E07A5F', '#FFF0EA', 'expense', 0, 0),
    (new.id, 'cat-business', 'Business', 'Briefcase', '#3D82D0', '#EBF4FF', 'expense', 0, 0),
    (new.id, 'cat-food', 'Food & Drink', 'UtensilsCrossed', '#E8A33E', '#FEF6E9', 'expense', 0, 0),
    (new.id, 'cat-transport', 'Transportation', 'Car', '#2A9D8F', '#E8F6F4', 'expense', 0, 0),
    (new.id, 'cat-utilities', 'Utilities', 'Zap', '#E76F51', '#FDEEE9', 'expense', 0, 0),
    (new.id, 'cat-education', 'Education', 'GraduationCap', '#6366F1', '#EEF2FF', 'expense', 0, 0),
    (new.id, 'cat-savings', 'Savings', 'PiggyBank', '#10B981', '#E6F9F0', 'expense', 0, 0),
    (new.id, 'cat-pets', 'Pets', 'PawPrint', '#EC4899', '#FDF2F8', 'expense', 0, 0),
    (new.id, 'cat-care', 'Personal Care', 'Sparkles', '#8B5CF6', '#F5F3FF', 'expense', 0, 0),
    (new.id, 'cat-hobbies', 'Hobbies', 'Gamepad2', '#4F46E5', '#EEF0FF', 'expense', 0, 0),
    (new.id, 'cat-entertainment', 'Entertainment', 'Film', '#0284C7', '#F0F9FF', 'expense', 0, 0),
    (new.id, 'cat-shopping', 'Shopping', 'ShoppingBag', '#F43F5E', '#FFF1F2', 'expense', 0, 0)
  on conflict do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ──
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.income enable row level security;
alter table public.goals enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.debtors enable row level security;

-- Policies: each user can only CRUD their own rows (user_id = auth.uid())
-- Profiles
drop policy if exists "profiles_is_owner" on public.profiles;
create policy "profiles_is_owner" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categories
drop policy if exists "categories_is_owner" on public.categories;
create policy "categories_is_owner" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Expenses
drop policy if exists "expenses_is_owner" on public.expenses;
create policy "expenses_is_owner" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Income
drop policy if exists "income_is_owner" on public.income;
create policy "income_is_owner" on public.income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Goals
drop policy if exists "goals_is_owner" on public.goals;
create policy "goals_is_owner" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bank accounts
drop policy if exists "bank_accounts_is_owner" on public.bank_accounts;
create policy "bank_accounts_is_owner" on public.bank_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Debtors
drop policy if exists "debtors_is_owner" on public.debtors;
create policy "debtors_is_owner" on public.debtors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
