import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { dictionaries, LANGUAGE_LABELS, type Language } from './translations';

interface I18nContextValue {
  language: Language;
  /** Traduce una clave; acepta variables {name} en el texto. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Cambia el idioma local (persistido en el navegador). */
  setLanguage: (language: Language) => void;
  available: { value: Language; label: string }[];
}

const STORAGE_KEY = 'gtz_language';

const I18nContext = createContext<I18nContextValue | null>(null);

function readStored(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch { /* ignore */ }
  return 'es';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStored);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    document.documentElement.lang = next;
  }, []);

  // Sincroniza con lo configurado en el servidor (sin sesión usa el endpoint público).
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    const request = token
      ? api.get('/settings/preferences').then((response) => response.data?.language)
      : api.get('/public/language').then((response) => response.data?.language);
    request
      .then((value) => {
        if (cancelled) return;
        if (value === 'es' || value === 'en') setLanguage(value);
      })
      .catch(() => { /* se mantiene el idioma guardado */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = dictionaries[language] ?? dictionaries.es;
    let text = dict[key] ?? dictionaries.es[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      }
    }
    return text;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    t,
    setLanguage,
    available: (Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => ({
      value: code,
      label: LANGUAGE_LABELS[code],
    })),
  }), [language, t, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback seguro si algún componente se renderiza fuera del proveedor.
    return {
      language: 'es',
      t: (key: string) => dictionaries.es[key] ?? key,
      setLanguage: () => undefined,
      available: [],
    };
  }
  return context;
}
