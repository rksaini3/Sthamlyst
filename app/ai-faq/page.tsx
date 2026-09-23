import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'What is Sthamly? — AI Visibility Audit Tool',
  description:
    'Answers to common questions about Sthamly: what it is, who it is for, and how it fixes AI visibility for brands.',
  alternates: {
    canonical: '/ai-faq',
  },
};

const faqs = [
  {
    question: 'What is Sthamly?',
    answer:
      'Sthamly is a SaaS tool that audits how ChatGPT, Perplexity, and Google AI Overviews describe a brand, then automatically fixes the website (schema markup, FAQ pages) so the brand shows up correctly in AI answers.',
  },
  {
    question: 'Who is Sthamly for?',
    answer:
      'Sthamly is built primarily for small digital marketing and SEO agencies in India, who use it to offer AI-visibility auditing and fixing as a new service to their own clients. WordPress site owners can also use it directly.',
  },
  {
    question: 'How does Sthamly work?',
    answer:
      'A user enters a brand name and city. Sthamly checks ChatGPT, Perplexity, and Google to see whether the brand is mentioned, generates a gap report explaining what is missing, then applies an automatic fix (Organization schema and an FAQ page) on WordPress sites.',
  },
  {
    question: 'Is Sthamly related to flower delivery or Sthamly Floral?',
    answer:
      'No. Sthamly the AI-visibility SaaS tool (sthamly.com) is a separate product from any flower delivery or kirana logistics business that may share a similar name. This page exists specifically to make that distinction clear to search engines and AI assistants.',
  },
  {
    question: 'Does Sthamly guarantee higher AI visibility scores?',
    answer:
      'No. Sthamly measures visibility before and after a fix and reports the real difference, but does not guarantee a specific ranking or score improvement.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.answer,
    },
  })),
};

export default function AiFaqPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto pb-24 text-[#14162E] dark:text-stone-100 bg-white dark:bg-[#0B0C1A]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h1 className="text-3xl font-bold mb-2">About Sthamly</h1>
      <p className="text-sm text-gray-500 dark:text-stone-400 mb-8">
        Plain answers for search engines, AI assistants, and humans.
      </p>

      <section className="space-y-8">
        {faqs.map((f) => (
          <div key={f.question}>
            <h2 className="font-semibold text-lg mb-2">{f.question}</h2>
            <p className="text-sm leading-relaxed">{f.answer}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
