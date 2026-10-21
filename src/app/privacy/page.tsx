import { LEGAL, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy — JetLemon" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        JetLemon is a customer-management tool for small service businesses. This policy explains what information we handle, why, and what your choices are. It is written
        in plain language on purpose. &ldquo;We&rdquo; and &ldquo;us&rdquo; means {LEGAL.entity}, the operator of jetlemon.com.
      </p>

      <h2>Two kinds of people use JetLemon</h2>
      <ul>
        <li>
          <strong>Businesses</strong> — the companies that sign up for an account and use JetLemon to run their work.
        </li>
        <li>
          <strong>Their customers</strong> — the people those businesses serve. If a business has your name, phone number or email in JetLemon, it is because you
          contacted that business or did business with them. That business decides what goes in and what messages you get; we store it on their behalf.
        </li>
      </ul>

      <h2>What we collect from businesses</h2>
      <ul>
        <li>Account details: your name, email address, password (stored hashed — we can&rsquo;t read it), business name, phone, address and time zone.</li>
        <li>Billing details: your plan and subscription status. Card numbers are handled by Stripe and never touch our servers.</li>
        <li>Everything you put in: customers, jobs, invoices, notes, message templates, files you import.</li>
        <li>Connections you choose to make: a Facebook Page (to receive lead-form leads), a Stripe account (to take payments), a texting number.</li>
        <li>Usage basics: when you signed in, what browser you used, error logs. We don&rsquo;t use advertising trackers.</li>
      </ul>

      <h2>What we collect about a business&rsquo;s customers</h2>
      <ul>
        <li>What the business enters or imports: name, phone, email, service address, notes about the work.</li>
        <li>What you send the business through a JetLemon lead form, a Facebook lead ad connected to JetLemon, or by texting the business&rsquo;s number.</li>
        <li>Messages sent and received through JetLemon (texts and emails) so the business can see the conversation.</li>
        <li>Whether an invoice was paid. Card details go to Stripe, not us.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: show the business its customers, schedule, invoices and messages.</li>
        <li>To send messages the business set up — for example an automatic text and email to a new lead, a reminder about an unpaid invoice, a thank-you after a job.</li>
        <li>To draft suggestions with AI (a summary of a new lead, a suggested reply, help mapping a spreadsheet). Only the text needed for that task is sent to the AI provider, and it is not used to train their models.</li>
        <li>To bill the business and to keep the service secure.</li>
      </ul>
      <p>We do not sell personal information. We do not use customer data to advertise to anyone.</p>

      <h2>Who we share it with</h2>
      <p>Only the companies that help us run JetLemon, and only what they need:</p>
      <ul>
        <li>Supabase — database and sign-in.</li>
        <li>Vercel — hosting.</li>
        <li>Stripe — subscription billing, and card payments on invoices (paid to the business&rsquo;s own Stripe account).</li>
        <li>Twilio — sending and receiving text messages.</li>
        <li>Resend — sending email.</li>
        <li>Anthropic — the AI assistant features.</li>
        <li>Meta — only if the business connects a Facebook Page, to receive its lead-form submissions.</li>
      </ul>
      <p>We may also disclose information if the law requires it, or to protect the rights and safety of users and the public.</p>

      <h2>Texting and email to customers</h2>
      <p>
        Businesses use JetLemon to text and email the people who contacted them. Our <a href="/sms-terms" className="text-indigo-600 hover:underline">texting terms</a> explain
        consent and how to stop. Every automated email has a link at the bottom to stop future emails from that business; reply <strong>STOP</strong> to any text to stop texts.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>If you&rsquo;re a customer of a business:</strong> contact that business to see, correct or delete what they have about you. They control it. If you can&rsquo;t reach
          them, email us and we&rsquo;ll help.
        </li>
        <li>
          <strong>If you&rsquo;re a business:</strong> you can edit or delete any customer, job or invoice at any time. To close your account and delete everything, email us from
          the account&rsquo;s owner address.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        For as long as the business&rsquo;s account is open. When an account is closed, its data is deleted within 30 days, except what we must keep for billing, tax or
        legal reasons.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest. Each business can only see its own data. Access to production systems is limited to people who need it to run the
        service. No system is perfectly secure; if we learn of a breach affecting you, we&rsquo;ll tell you.
      </p>

      <h2>Children</h2>
      <p>JetLemon is for businesses and isn&rsquo;t directed at children under 13. We don&rsquo;t knowingly collect information from them.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&rsquo;ll update the date at the top and tell account owners by email.</p>
    </LegalPage>
  );
}
