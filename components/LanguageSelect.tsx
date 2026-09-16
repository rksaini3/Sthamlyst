'use client';

import { useLanguage } from '@/lib/LanguageProvider';
import { LANGUAGES, type Language } from '@/lib/i18n';

export default function LanguageSelect() {
  const { lang, setLang } = useLanguage();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Language)}
      aria-label="Select language"
      className="bg-transparent text-stone-200 text-sm border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} className="text-stone-900">
          {l.nativeLabel}
        </option>
      ))}
    </select>
  );
}