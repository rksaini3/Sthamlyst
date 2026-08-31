import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = { title: 'Privacy Policy — Sthamly' }

export default function PrivacyPage() {
  return (
    <div className="max-w-md mx-auto pb-24 px-5 pt-6 text-stone-700 text-sm leading-relaxed">
      <Link href="/profile" className="text-xs text-amber-700 font-semibold">← Back</Link>
      <h1 className="text-xl font-bold text-stone-900 mt-3 mb-1">Privacy Policy</h1>
      <p className="text-xs text-stone-400 mb-1">Last updated: August 2026</p>
      <p className="text-xs text-stone-400 mb-6">
        Sthamly is currently in an early pilot phase. This policy will be updated as the
        Platform grows.
      </p>

      <Section title="1. What We Collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account info:</strong> name, email address, city</li>
          <li><strong>Activity data:</strong> quiz completions, Sthamly Points balance,
            products listed, reels uploaded</li>
          <li><strong>Content you upload:</strong> reel videos, product photos, chat messages,
            voice notes, and images shared in chat</li>
          <li><strong>Technical data:</strong> device/browser information collected automatically
            for security and app performance</li>
        </ul>
      </Section>

      <Section title="2. How We Use It">
        <ul className="list-disc pl-5 space-y-1">
          <li>To operate your account, track points, and run the Learn &amp; Earn and Local
            Bazaar features</li>
          <li>To display your name/city to other users when you list a product or send a chat
            message (this is inherent to how a local marketplace works)</li>
          <li>To detect fraud or abuse of the quiz/points system</li>
          <li>To improve the Platform and communicate important updates to you</li>
        </ul>
        We do not sell your personal data to third parties.
      </Section>

      <Section title="3. Where Your Data Is Stored (Cross-Border Transfer)">
        Sthamly is built on <strong>Supabase</strong> (database, authentication, file storage) and
        hosted on <strong>Vercel</strong>. These providers may store data on servers outside
        India as part of their global cloud infrastructure. Under India&apos;s{' '}
        <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, this is permitted
        for all countries except those specifically restricted by the Government of India — we
        do not currently use any restricted-country infrastructure. By using Sthamly, you
        consent to this transfer, which is necessary to provide the service.
      </Section>

      <Section title="3A. Consent &amp; Data Minimisation">
        In line with the DPDP Act, we ask for your clear consent — in simple Hindi/English — at
        sign-up before collecting your name, email, or city. We only collect data that is
        strictly necessary to run the Learn &amp; Earn and Local Bazaar features (data
        minimisation); we do not ask for information we don&apos;t need to operate the Platform.
      </Section>

      <Section title="3B. Payments Are Not Held by Sthamly">
        Sthamly does not process or hold payments — any amount agreed between a buyer and seller
        is settled directly between them (e.g. UPI, cash, QR code), outside the app. Because
        Sthamly never holds customer funds, RBI's in-app payment localisation/aggregator rules do
        not apply to the Platform in its current form.
      </Section>

      <Section title="4. Chat Data">
        Messages, images, and voice notes you send through Chat-to-Bargain are stored so that
        both participants in a conversation can view their chat history. Only the buyer and
        seller in a given conversation can see its contents.
      </Section>

      <Section title="5. Your Rights">
        You may:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Request a copy of the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and associated data, subject to any legal
            retention requirements</li>
        </ul>
        To exercise these rights, contact us using the details below.
      </Section>

      <Section title="6. Data Retention">
        We retain your account data for as long as your account is active. If you delete your
        account, we will remove your personal data within a reasonable period, except where we
        are required to retain it by law.
      </Section>

      <Section title="7. Children's Privacy">
        Sthamly is not directed at children under 18. We do not knowingly collect personal data
        from minors without parental consent.
      </Section>

      <Section title="8. Cookies & Similar Technologies">
        We use essential cookies/local storage required to keep you signed in and for the app to
        function correctly. We do not currently use third-party advertising trackers.
      </Section>

      <Section title="9. Grievance Officer / Contact">
        In accordance with Indian law, including the Information Technology Act, 2000 and the
        Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules,
        2021, and the Digital Personal Data Protection Act, 2023, grievances or data requests can
        be sent to:
        <p className="mt-2 font-semibold text-stone-800">
          Grievance Officer, Sthamly<br />
          Gonda, Uttar Pradesh, India<br />
          Email: <span className="text-amber-700">privacy@sthamly.com</span>
        </p>
        <p className="mt-2 text-xs text-stone-500">
          As an early-stage platform, Sthamly currently relies on the DPDP Act&apos;s relaxations
          available to startups (e.g. simplified compliance obligations). We will appoint a
          formal Data Protection Officer if and when required by law as the Platform grows.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        We may update this Privacy Policy from time to time. We will indicate the &quot;Last
        updated&quot; date at the top of this page whenever changes are made, and where changes
        are significant, we will let users know inside the app.
      </Section>

      <p className="text-xs text-stone-400 mt-8">
        See also our{' '}
        <Link href="/terms" className="text-amber-700 underline">Terms &amp; Conditions</Link>.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold text-stone-900 mb-1.5">{title}</h2>
      <div className="text-stone-600">{children}</div>
    </div>
  )
}
