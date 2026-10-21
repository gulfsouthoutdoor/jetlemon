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
- Lead capture: a private lead address per business (website forms, Zapier, Make), a hosted lead form, and
  "Connect Facebook" for Facebook/Instagram lead ads (leads arrive in seconds via webhook)
- AI assist (Claude): smart import of any spreadsheet or CRM export with column matching, a setup
  conversation that fills in the business profile and customer-facing wording, suggested text replies,
  a one-line summary on every new lead, and a daily rundown text to the owner
- Texting: two-way texts on the customer page, an automatic speed-to-lead text when a lead arrives, and a
  "new lead" alert to the owner's cell

**Stack:** Next.js 15 (App Router, Server Actions), Supabase (Auth + Postgres), Tailwind CSS v4, Stripe.

## Setup

1. **Supabase:** create a project, then run `supabase/migrations/0001_schema.sql` in the SQL editor
   (or `supabase db push`). Production project: `jetlemon-crm` (ref `fymepcdcuhumhcktyeuz`), schema applied 2026-10-21. Under Authentication → URL Configuration, set the Site URL to your app URL
   and add `<your-url>/auth/callback` to the redirect URLs. Keep "Confirm email" turned on, because team
   invites are matched by email address.
2. **Stripe:** create two Products, each with a monthly recurring Price — Starter ($29, `STRIPE_PRICE_ID`) and
   Pro ($59, `STRIPE_PRO_PRICE_ID`; older Pro prices go in `STRIPE_PRO_PRICE_IDS_LEGACY`). Pro unlocks texting and the text + email follow-ups; trials get Pro features. Add a webhook endpoint at
   `<your-url>/api/stripe/webhook` for these events: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`.
   Enable the Customer Portal in Stripe settings.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Run `npm install` and then `npm run dev`. Open http://localhost:3000.

For local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### Facebook / Instagram lead ads (optional)

1. At developers.facebook.com create an app (type **Business**). Add the **Webhooks** and **Facebook Login for
   Business** products. Copy the App ID and App Secret into `META_APP_ID` / `META_APP_SECRET`.
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://jetlemon.com/api/meta/callback`.
3. Webhooks → **Page** → Subscribe to `leadgen`. Callback URL `https://jetlemon.com/api/meta/webhook`,
   Verify token = whatever you put in `META_VERIFY_TOKEN`.
4. While the app is in **Development** mode, only people listed as app admins/developers/testers can
   connect pages — fine for your own business. To let *other* subscribers connect, complete Business
   Verification and submit `leads_retrieval`, `pages_manage_ads`, `pages_manage_metadata`,
   `pages_read_engagement` and `pages_show_list` for App Review, then switch the app to **Live**.

Subscribers click **Settings → Connect Facebook**, tick their page(s), and new lead-form submissions
become leads immediately.

### Texting (optional)

1. Create a Twilio account; put the Account SID and Auth Token in `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
   Complete A2P 10DLC brand + campaign registration (required for US texting).
2. Buy a number per business. For each number: Messaging → "A message comes in" →
   Webhook `https://jetlemon.com/api/sms/inbound` (POST). Then set that number on the business:
   `update organizations set sms_number = '+12055550142' where id = '<org id>';`
3. Owners turn on the auto-text and the owner alert under **Settings → Texting**.
4. Allowance and overage: each business gets `texts_included` texts a month (default 500). Past that, a
   block of `text_block_size` texts (default 250) at `text_block_price_cents` (default $10) is added to the
   business's next Stripe invoice automatically — but never beyond the owner's own cap
   (`text_block_limit`, default 2 blocks; owners change it in Settings). At the cap, or when the owner flips
   **Pause all texting**, nothing is sent or billed and the dashboard shows a notice. Blocks need an active
   paid subscription; trial accounts get the included texts only.

### AI assist (optional)

Set `ANTHROPIC_API_KEY`. Every AI feature degrades gracefully without it: import falls back to
column-name guesses, setup saves the owner's answers as typed, suggestions and summaries are hidden.
The daily rundown is a plain template (no AI) and runs from the Vercel cron in `vercel.json` once an
hour; set `CRON_SECRET` in Vercel so only Vercel can trigger it. Owners pick the hour under Settings → Texting.

### Follow-ups (text + email sequences)

Three pre-made sequences under **Settings → Follow-ups**, each a switch plus up to four steps
(day, text or email, wording): **New lead** (starts on every new lead, stops when they reply or the
job leaves "lead"), **After the job** (starts when a job is marked completed; `{review_link}` fills
from the business's review URL) and **Unpaid invoice** (starts when an invoice is sent, stops when
paid or voided). Day-0 steps go immediately; later steps go at 9 AM in the business's time zone
from the hourly `/api/cron/sequences` job. Texts go through `sendBusinessText` (Pro plan, cap,
pause switch all apply); emails go through Resend (`RESEND_API_KEY`) from `EMAIL_FROM` with the
business's name and reply-to, a signed unsubscribe link (`/email/stop`), and are logged in
`messages` with `channel = 'email'`. An inbound text of STOP sets `customers.text_opt_out`.

### Email links that survive mail scanners

Supabase's default email templates verify the one-time token the moment the link is opened —
and Microsoft 365 / Gmail link scanners open every link, so the real person finds it "expired".
Point every template at `/auth/confirm`, which shows a **Continue** button and only verifies on
the click. In Supabase → Authentication → Email Templates, set the link in each template to:

| Template | Link |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Magic link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` |
| Change email address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

`Site URL` under Authentication → URL Configuration must be `https://jetlemon.com`.

### Admin page

Set `ADMIN_EMAILS` (comma-separated) in Vercel. Those accounts get an **Admin** link in the sidebar
and can open `/admin`: every business with plan, status, trial, owner, usage counts, and buttons to
assign a texting number, comp an account, change plan, extend a trial, pause texting, or delete a
business. Data comes from the `admin_orgs()` function, which only returns rows to the service role.

### Lead address

Every business has a private lead address shown under **Settings → Lead capture**:
`POST https://jetlemon.com/api/leads/<token>` with JSON or form fields `name`, `phone`, `email`,
`address`, `message`, optional `source` (defaults to `website`) and `source_ref` (for de-duplication).
Any other fields are saved on the lead. A hosted form lives at `https://jetlemon.com/lead/<token>`.

## Deploy (production: https://jetlemon.com)

1. Import the GitHub repo in Vercel and add the environment variables from `.env.example`.
2. In Vercel → Project → Settings → Domains, add `jetlemon.com` and `www.jetlemon.com`
   (redirect www → jetlemon.com). Vercel shows the exact DNS values to use.
3. Back up the old site first: cPanel → File Manager → jetlemon.com's folder (the old Expo Control
   app) → select all → Compress → download the .zip. Its data lives in Supabase and is not affected.
4. In HostGator cPanel → Zone Editor → jetlemon.com (keep HostGator's nameservers):
   - Edit the existing **A** record for `jetlemon.com` to point to the IP Vercel shows.
   - Edit or replace the `www` record with a **CNAME** to the target Vercel shows.
   - Leave MX/mail records alone. HTTPS is issued automatically once DNS resolves.
5. In Supabase → Authentication → URL Configuration: Site URL `https://jetlemon.com`, and add
   `https://jetlemon.com/auth/callback` to the redirect URLs.
6. Stripe webhook endpoint: `https://jetlemon.com/api/stripe/webhook`.

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
