import type { LocaleContent, SupportedLanguage } from './types';
import { enLocale } from './locales/en';
import { taLocale } from './locales/ta';
import { hiLocale } from './locales/hi';
import { teLocale } from './locales/te';
import { knLocale } from './locales/kn';
import { mlLocale } from './locales/ml';
import { bnLocale } from './locales/bn';
import { mrLocale } from './locales/mr';
import { SUPPORTED_LANGUAGES, LANGUAGE_MAP } from './languages';

export * from './types';
export * from './languages';

export const LOCALES: Record<SupportedLanguage, LocaleContent> = {
  en: enLocale,
  ta: taLocale,
  hi: hiLocale,
  te: teLocale,
  kn: knLocale,
  ml: mlLocale,
  bn: bnLocale,
  mr: mrLocale
};

export function getLocale(lang: string | undefined): LocaleContent {
  if (lang && lang in LOCALES) {
    return LOCALES[lang as SupportedLanguage];
  }
  return enLocale;
}

export function useI18n(lang: string | undefined) {
  const currentLang = (lang && lang in LOCALES) ? (lang as SupportedLanguage) : 'en';
  const content = LOCALES[currentLang];
  const langInfo = LANGUAGE_MAP[currentLang];

  return {
    lang: currentLang,
    content,
    langInfo,
    supportedLanguages: SUPPORTED_LANGUAGES,
    t: content
  };
}
