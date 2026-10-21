import { LEGAL, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Texting Terms — JetLemon" };

// Written to satisfy carrier (10DLC) and Meta reviews: program description, consent, frequency,
// rates, STOP/HELP, and privacy — in plain language.
export default function SmsTermsPage() {
  return (
    <LegalPage title="Texting (SMS) Terms">
      <h2>What this is</h2>
      <p>
        JetLemon is software that local service businesses (cleaners, lawn care, plumbers, electricians, HVAC and similar) use to run their work. Part of that is texting
        their customers from a dedicated business number. These terms cover those texts. {LEGAL.entity} provides the software; the business you contacted is who is
        texting you.
      </p>

      <h2>How you opted in</h2>
      <p>You receive texts from a business through JetLemon only because you did one of these:</p>
      <ul>
        <li>Filled out that business&rsquo;s request form (on their website, their JetLemon lead form, or a Facebook/Instagram lead ad) and gave your mobile number. The form says the business may call or text you about your request.</li>
        <li>Texted the business&rsquo;s number yourself.</li>
        <li>Gave the business your mobile number in person or by phone when you booked or asked about a service, and agreed to get texts about it.</li>
      </ul>

      <h2>What the texts are about</h2>
      <ul>
        <li>A reply to your request and follow-ups about it (for example: &ldquo;We got your request — when is a good time to call?&rdquo;).</li>
        <li>Scheduling and appointment details.</li>
        <li>Invoices and payment reminders for work you asked for.</li>
        <li>A thank-you and a request for a review after a job.</li>
        <li>Replies to things you text the business.</li>
      </ul>
      <p>These are service and conversational messages about your own request or job. Businesses may not use JetLemon to send cold marketing texts.</p>

      <h2>How often</h2>
      <p>
        Message frequency varies. After a new request, you may get up to four follow-up texts over about a week if you haven&rsquo;t replied. Replying stops the automatic
        follow-ups. Other texts are tied to your appointments and invoices.
      </p>

      <h2>Cost</h2>
      <p>Message and data rates may apply, per your mobile plan. The business doesn&rsquo;t charge you for texts.</p>

      <h2>How to stop</h2>
      <p>
        Reply <strong>STOP</strong> to any text and you won&rsquo;t get more texts from that business&rsquo;s number. You&rsquo;ll get one message confirming you&rsquo;ve been opted out.
        Reply <strong>START</strong> to opt back in.
      </p>

      <h2>Help</h2>
      <p>
        Reply <strong>HELP</strong> to any text, or email <a href={`mailto:${LEGAL.email}`} className="text-indigo-600 hover:underline">{LEGAL.email}</a>. You can also call the
        business directly at the number on their website or your invoice.
      </p>

      <h2>Your privacy</h2>
      <p>
        Your mobile number and the texts exchanged are stored so the business can see the conversation. They are not sold or shared with third parties for their marketing.
        No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. See our{" "}
        <a href="/privacy" className="text-indigo-600 hover:underline">privacy policy</a> for the full picture.
      </p>

      <h2>Carriers</h2>
      <p>Carriers are not liable for delayed or undelivered messages. Texting works on major US carriers; some smaller carriers may not be supported.</p>
    </LegalPage>
  );
}
