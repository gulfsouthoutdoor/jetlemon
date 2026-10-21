import { LEGAL, LegalPage } from "@/components/legal-page";
import { PLANS } from "@/lib/stripe";

export const metadata = { title: "Terms of Service — JetLemon" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These are the terms for using JetLemon (jetlemon.com), run by {LEGAL.entity}. By creating an account you agree to them. They&rsquo;re short on purpose; if something
        isn&rsquo;t covered, ask us.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older and signing up on behalf of a business.</li>
        <li>Keep your password private. You&rsquo;re responsible for what happens under your account, including what your team members do.</li>
        <li>Give us accurate business details — they appear on the invoices and messages JetLemon sends for you.</li>
      </ul>

      <h2>Plans and billing</h2>
      <ul>
        <li>Every new account starts with a free trial of the Pro plan. No card is needed to try it.</li>
        <li>
          After the trial, pick a plan: Starter (${PLANS.starter.price}/month) or Pro (${PLANS.pro.price}/month). Prices are shown on the billing page and may change with 30
          days&rsquo; notice.
        </li>
        <li>Subscriptions renew monthly and are billed through Stripe. You can switch plans or cancel any time from Billing; a cancellation takes effect at the end of the paid month.</li>
        <li>
          Pro includes {PLANS.pro.features.find((f) => f.includes("texts")) ?? "a monthly text allowance"}. Beyond the included texts, extra texts are billed in blocks on your
          next invoice — never beyond the monthly cap you set in Settings, and never while texting is paused.
        </li>
        <li>Fees already paid aren&rsquo;t refunded, except where the law requires it or we&rsquo;ve made a mistake.</li>
      </ul>

      <h2>Your data</h2>
      <ul>
        <li>What you put into JetLemon — customers, jobs, invoices, messages — is yours. We store and process it to run the service for you, as described in our privacy policy.</li>
        <li>You can export or delete it at any time. If you close your account, we delete it within 30 days.</li>
        <li>You&rsquo;re responsible for having the right to put your customers&rsquo; information into JetLemon and to contact them.</li>
      </ul>

      <h2>Messaging your customers</h2>
      <p>
        JetLemon can text and email your customers for you. You agree to use it only to contact people who have asked to hear from your business, to honor every
        STOP or unsubscribe, and to follow the <a href="/sms-terms" className="text-indigo-600 hover:underline">texting terms</a> and the laws that apply to you (including the
        TCPA and CAN-SPAM in the US). Don&rsquo;t use JetLemon to send unsolicited marketing, anything deceptive, or anything illegal. We may pause messaging on an account that
        draws complaints.
      </p>

      <h2>Payments from your customers</h2>
      <p>
        If you connect a Stripe account, card payments on your invoices go directly to that account under Stripe&rsquo;s terms. Stripe&rsquo;s fees come out of each payment.
        Refunds, disputes and chargebacks are between you, your customer and Stripe; JetLemon isn&rsquo;t a party to the sale.
      </p>

      <h2>AI features</h2>
      <p>
        Some features draft text for you — a lead summary, a suggested reply, a setup guess. They&rsquo;re suggestions. Read before you send, and don&rsquo;t rely on them for
        legal, financial or safety decisions.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&rsquo;t break the law, break into the service, overload it, resell it without our agreement, or use it to harm anyone. We can suspend accounts that do.</p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep JetLemon up and your data safe, but it&rsquo;s provided &ldquo;as is.&rdquo; We don&rsquo;t promise it will be error-free or always available. To the extent the law
        allows, {LEGAL.entity} isn&rsquo;t liable for indirect or consequential losses, and our total liability for any claim is limited to what you paid us in the 12 months
        before the claim.
      </p>

      <h2>Ending the agreement</h2>
      <p>You can cancel any time. We can end or suspend an account that breaks these terms. Sections about data, liability and payments survive.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If a change matters, we&rsquo;ll email account owners before it takes effect. Continuing to use JetLemon after that means you accept it.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Alabama, USA, without regard to its conflict-of-law rules.</p>
    </LegalPage>
  );
}
