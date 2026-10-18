# JetLemon

A simple multi-tenant SaaS CRM for service businesses (cleaning, delivery, field service, trades).

**Features**
- Marketing landing page with pricing, then sign-up and a 14-day free trial
- Each business gets a private workspace (Postgres row-level security), with team invites
- Customers: contact info, service address, tags, activity notes, lifetime revenue
- Jobs: lead → scheduled → in progress → completed, assignment, pricing, map links
- Weekly schedule calendar, shown in the business's own time zone
- Invoices: auto-numbered, line items, draft/sent/paid/void, overdue tracking, print/PDF, email link
- Dashboard: jobs today, revenue this month, outstanding and overdue invoices, leads
- Stripe subscription billing (Checkout + Customer Portal + webhook), with app access gated after the trial ends

**Stack:** Next.js 15 (App Router, Server Actions), Supabase (Auth + Postgres), Tailwind CSS v4, Stripe.

## Setup

1. **Supabase:** create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor
   (or `supabase db push`). Under Authentication → URL Configuration, set the Site URL to your app URL
   and add `<your-url>/auth/callback` to the redirect URLs. Keep "Confirm email" turned on, because team
   invites are matched by email address.
2. **Stripe:** create a Product with a monthly recurring Price. Add a webhook endpoint at
   `<your-url>/api/stripe/webhook` for these events: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`.
   Enable the Customer Portal in Stripe settings.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Run `npm install` and then `npm run dev`. Open http://localhost:3000.

For local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Deploy (production: https://jetlemon.com)

1. Import the GitHub repo in Vercel and add the environment variables from `.env.example`.
2. In Vercel → Project → Settings → Domains, add `jetlemon.com` and `www.jetlemon.com`
   (redirect www → jetlemon.com). Vercel shows the exact DNS values to use.
3. In HostGator cPanel → Zone Editor → jetlemon.com (keep HostGator's nameservers):
   - Edit the existing **A** record for `jetlemon.com` to point to the IP Vercel shows.
   - Edit or replace the `www` record with a **CNAME** to the target Vercel shows.
   - Leave MX/mail records alone. HTTPS is issued automatically once DNS resolves.
4. In Supabase → Authentication → URL Configuration: Site URL `https://jetlemon.com`, and add
   `https://jetlemon.com/auth/callback` to the redirect URLs.
5. Stripe webhook endpoint: `https://jetlemon.com/api/stripe/webhook`.

## Project layout

```
src/app/page.tsx              landing page
src/app/(app)/…               signed-in app (gated by subscription)
src/app/(account)/billing     billing (always reachable)
src/app/api/stripe/webhook    subscription sync
src/lib/                      Supabase clients, org context, formatting/timezone helpers
supabase/migrations/          schema + RLS policies
```

## Ideas for next versions
Online invoice payment links (Stripe Connect), SMS/email appointment reminders, recurring jobs,
quotes/estimates, a customer portal, a mobile-friendly crew view, and CSV import/export.
