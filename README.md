# TimeWorth

A budgeting app that converts every naira spent or earned into time worked.

View your app in AI Studio: https://ai.studio/apps/4cfba6c4-8dad-4e56-8c79-8adac29ef5aa

## Stack
- React 19 + Vite 6 + Tailwind 4
- Express API (`server.ts`) — also exported as Vercel serverless `api/index.ts`
- Supabase (Postgres + Auth + RLS) — persistent store; falls back to in-memory demo if not configured
- Gemini 2.0 Flash — statement parsing

## Run Locally

```bash
npm install
cp .env.example .env.local  # fill in keys
npm run dev                 # vite + express on http://localhost:3000
```

- `GEMINI_API_KEY` — required for statement parsing (server-only)
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — client Supabase (set both for persistence)
- `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` — server Supabase (Vercel env)

Without Supabase env vars, the app runs in **demo-memory mode** (data resets on restart) — still buildable and deployable.

## Supabase Setup

See [`supabase/README.md`](./supabase/README.md) and run [`supabase/schema.sql`](./supabase/schema.sql) in SQL Editor.
Fixes invalid FK: `expenses(user_id,category_id) -> categories(user_id,id)` (was duplicate constraint).

## Deploy to Vercel

1. Import repo in Vercel — framework auto-detected as **Vite**.
2. Build command: `npm run build` · Output: `dist` (see `vercel.json`).
3. Add Environment Variables in Vercel Dashboard → Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (same as VITE_ one)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `GEMINI_API_KEY`
4. Deploy — `/api/*` is served by `api/index.ts` (Express), SPA fallback via `vercel.json` rewrites.

## Health Check
`GET /api/health` → `{ status, supabase: "configured"|"demo-memory", gemini, env }`

## Schema
Postgres tables: `profiles`, `categories`, `expenses`, `income`, `goals`, `bank_accounts`, `debtors` with RLS owner-only policies. See `supabase/schema.sql`.
