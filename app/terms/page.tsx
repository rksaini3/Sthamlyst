import Link from 'next/link'

export const metadata = { title: 'Terms & Conditions — Sthamly' }

export default function TermsPage() {
  return (
    <div className="max-w-md mx-auto pb-24 px-5 pt-6 text-stone-700 text-sm leading-relaxed">
      <Link href="/profile" className="text-xs text-amber-700 font-semibold">← Back</Link>
      <h1 className="text-xl font-bold text-stone-900 mt-3 mb-1">Terms &amp; Conditions</h1>
      <p className="text-xs text-stone-400 mb-6">Last updated: August 2026</p>

      <Section title="1. About Sthamly">
        Sthamly (&quot;we&quot;, &quot;us&quot;, &quot;the Platform&quot;) is a hyperlocal platform
        piloted in Gonda, Uttar Pradesh, connecting local artisans and makers with buyers through
        short educational videos, a rewards system (&quot;Sthamly Points&quot;), and a local
        handmade-goods marketplace (&quot;Local Bazaar&quot;). By creating an account or using
        Sthamly in any way, you agree to these Terms.
      </Section>

      <Section title="2. Eligibility">
        You must be at least 18 years old, or use the Platform under the supervision of a
        parent/guardian who agrees to these Terms on your behalf, to create an account, list a
        product, or upload content.
      </Section>

      <Section title="3. What You Can Sell">
        Only <strong>non-consumable, handmade goods</strong> (e.g. clay crafts, home décor,
        handwoven baskets, paintings, jute bags) may be listed on the Local Bazaar. Food items,
        beverages, or any consumable product are strictly prohibited, as they fall outside the
        scope of this Platform and its current regulatory approvals. We may remove any listing
        that violates this at our discretion, without prior notice.
      </Section>

      <Section title="4. Sthamly Points">
        Sthamly Points are earned by correctly completing quizzes on the Platform. Points:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>have no cash value and cannot be withdrawn, transferred, or exchanged for money</li>
          <li>may only be redeemed as a discount on eligible Local Bazaar purchases</li>
          <li>expire 30 days after the last date you earned any points, as shown in your Profile</li>
          <li>may be adjusted or revoked if we reasonably believe they were earned through fraud
            or abuse of the quiz system</li>
        </ul>
      </Section>

      <Section title="5. User-Generated Content">
        If you upload a reel, quiz, or product listing (&quot;Creator Mode&quot; or
        &quot;Seller Mode&quot;), you confirm that:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>you own the content or have the right to share it</li>
          <li>it does not infringe anyone else&apos;s intellectual property, and is not obscene,
            defamatory, or unlawful</li>
          <li>you grant Sthamly a non-exclusive, royalty-free licence to host, display, and
            distribute the content within the Platform</li>
        </ul>
        We may remove any content that violates these Terms or applicable Indian law, including
        the Information Technology Act, 2000 and rules made thereunder.
      </Section>

      <Section title="6. Chat-to-Bargain Conduct">
        The in-app chat is meant for genuine price negotiation between buyers and sellers.
        Harassment, spam, fraud, or sharing of unlawful content in chat is prohibited and may
        result in suspension of your account.
      </Section>

      <Section title="7. Seller Verification">
        A &quot;Verified Maker&quot; badge indicates we have taken reasonable steps to confirm a
        seller's local presence, but it is not a guarantee of product quality, delivery, or
        transaction outcome. Buyers should exercise their own judgement, as with any local market
        transaction.
      </Section>

      <Section title="8. No Payment Gateway (Current Status)">
        As of this version, Sthamly does not process payments through the app. Any price agreed
        via chat or listing is settled directly between buyer and seller, outside the Platform.
        Sthamly is not a party to, and bears no responsibility for, that transaction.
      </Section>

      <Section title="9. Limitation of Liability">
        Sthamly is provided &quot;as is&quot;. To the maximum extent permitted by law, we are not
        liable for any indirect, incidental, or consequential loss arising from your use of the
        Platform, including disputes between buyers and sellers.
      </Section>

      <Section title="10. Grievance Officer">
        In accordance with the Information Technology (Intermediary Guidelines and Digital Media
        Ethics Code) Rules, 2021, grievances regarding content on the Platform may be addressed
        to our Grievance Officer at the contact details on our{' '}
        <Link href="/privacy" className="text-amber-700 underline">Privacy Policy</Link> page.
      </Section>

      <Section title="11. Governing Law">
        These Terms are governed by the laws of India. Courts in Uttar Pradesh shall have
        exclusive jurisdiction over any dispute arising from these Terms.
      </Section>

      <Section title="12. Changes to These Terms">
        We may update these Terms from time to time. Continued use of the Platform after changes
        are posted constitutes acceptance of the revised Terms.
      </Section>

      <p className="text-xs text-stone-400 mt-8">
        Questions about these Terms? Contact us at the email listed on our{' '}
        <Link href="/privacy" className="text-amber-700 underline">Privacy Policy</Link> page.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold text-stone-900 mb-1.5">{title}</h2>
      <div className="text-stone-600">{children}</div>
    </div>
  )
}
