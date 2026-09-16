'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { type Language, t as translate } from './i18n';

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: Parameters<typeof translate>[1]) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('sthamly-language') as Language | null;
    if (saved) setLangState(saved);
  }, []);

  function setLang(next: Language) {
    setLangState(next);
    localStorage.setItem('sthamly-language', next);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: (key) => translate(lang, key) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}