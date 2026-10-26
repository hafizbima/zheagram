# Supabase setup

## 1. Create the project

Create a Supabase project, then open **SQL Editor** and run [`schema.sql`](./schema.sql).

The schema stores each diagram as one row in `public.boards`, with the canvas objects and z-order in the `data` JSONB column. Row-level security limits reads and writes to the authenticated owner.

## 2. Configure authentication

In Supabase, open **Authentication → Providers → Email** and keep email/password sign-in enabled.

The app provides email/password sign-in and account creation. If **Confirm email** is enabled, new users must click the confirmation link before signing in.

## 3. Configure local development

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the values from **Project Settings → API**:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app also accepts the `NEXT_PUBLIC_` names used by Next.js deployments:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use the publishable/anon key only. Never put the Supabase service-role key in the Vite app.

## 4. Configure Vercel

Add the same two variables in the Vercel project settings for **Production**, **Preview**, and **Development** as needed, then redeploy.

If the variables are missing or Supabase is unavailable, the app keeps using IndexedDB with a localStorage fallback. When Supabase is configured, the app shows the login page before opening the workspace.
