export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto pb-24 text-[#14162E]">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: September 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold text-lg mb-2">1. Introduction</h2>
          <p>
            Sthamly ("we", "our", "us") operates the sthamly.com website and related
            services (the "Service"). This Privacy Policy explains what information we
            collect, how we use it, and the choices you have.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">2. Information We Collect</h2>
          <p className="mb-2"><strong>Account information:</strong> If you sign up, we collect your email, name, and (if you use Google login) your Google profile information.</p>
          <p className="mb-2"><strong>Audit data:</strong> Brand name, target city, and website URL you submit for an AI visibility audit.</p>
          <p className="mb-2"><strong>WordPress connection:</strong> If you connect a WordPress site, we store the site URL, username, and an encrypted application password used only to apply fixes you request.</p>
          <p><strong>Payment information:</strong> Payments are processed by Razorpay. We do not store your card details — Razorpay handles this securely under its own PCI-DSS compliant systems.</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To run AI visibility audits using third-party AI models (via OpenRouter) and search data (via Serper.dev)</li>
            <li>To let you save and revisit your audit history</li>
            <li>To apply schema markup/FAQ fixes to your connected WordPress site when you purchase a fix</li>
            <li>To process payments securely via Razorpay</li>
            <li>To send you service-related communication (not marketing spam)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">4. Third-Party Services</h2>
          <p>
            We share limited data with the following third parties strictly to provide
            the Service: OpenRouter (AI model queries), Serper.dev (search data),
            Supabase (database and authentication), Razorpay (payments), and Google
            (OAuth login, if used). Each of these providers has its own privacy policy
            governing how they handle data.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">5. Data Retention</h2>
          <p>
            Guest audits (without login) are stored against your device only. Logged-in
            audits are retained until you delete your account. WordPress credentials are
            retained until you disconnect the site from Optimizer.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">6. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data
            at any time by contacting us. You may also disconnect your WordPress site or
            delete your account from the Account page.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">7. Security</h2>
          <p>
            We use industry-standard measures (encrypted connections, Razorpay signature
            verification, Supabase Row Level Security) to protect your data. No system is
            100% secure, and we encourage you to use a strong, unique password.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">8. Children's Privacy</h2>
          <p>The Service is not directed at individuals under 18 years of age.</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">9. Changes to This Policy</h2>
          <p>We may update this policy from time to time. Continued use of the Service after changes constitutes acceptance.</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-2">10. Contact Us</h2>
          <p>For any privacy-related questions, please contact us via the support option in your Account settings.</p>
        </div>
      </section>
    </main>
  );
}