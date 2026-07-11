import { createContext, useContext, useState, type ReactNode } from 'react'
import { getLang, setLang as persistLang } from '../storage'
import de from './de.json'
import en from './en.json'

export type Lang = 'de' | 'en'

export type TFunc = (key: string, vars?: Record<string, string | number>) => string

const dictionaries: Record<Lang, Record<string, string>> = { de, en }

function detectDefaultLang(): Lang {
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'de'
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  let result = text
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, String(value))
  }
  return result
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFunc
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (getLang() as Lang | null) ?? detectDefaultLang())

  function setLang(next: Lang) {
    setLangState(next)
    persistLang(next)
  }

  function t(key: string, vars?: Record<string, string | number>): string {
    const text = dictionaries[lang][key] ?? dictionaries.de[key] ?? key
    return interpolate(text, vars)
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider')
  return ctx
}
