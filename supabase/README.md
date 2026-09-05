# Supabase setup for Timeworth

1. Create a Supabase project at https://supabase.com/dashboard

2. Run `supabase/schema.sql` in SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
   - Creates tables with correct composite FK `expenses(user_id,category_id) -> categories(user_id,id)`
   - Enables RLS + owner-only policies
   - Auto-creates profile + 12 default categories on signup

3. Copy API keys: Dashboard → Settings → API
   - `SUPABASE_URL`  → Project URL
   - `SUPABASE_ANON_KEY`  → anon public
   - `SUPABASE_SERVICE_ROLE_KEY` → service_role (server-only, never expose to client)

4. Set env vars in Vercel: Dashboard → Settings → Environment Variables
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (server only)
   SUPABASE_URL=https://xxx.supabase.co (alias for server)
   GEMINI_API_KEY=...                 (server only)
   ```

5. Local dev: copy `.env.example` → `.env.local` and fill values.

6. Auth: Email/password enabled by default. The app's `handle_new_user` trigger seeds data on signup.
