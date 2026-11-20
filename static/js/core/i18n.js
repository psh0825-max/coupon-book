import { messages } from './messages.js';

const STORAGE_KEY = 'coupon-book-language';
const SUPPORTED = ['ko', 'en', 'ja'];

export function languagePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function appLanguage() {
  const preference = languagePreference();
  if (preference !== 'system') return preference;
  const preferred = typeof document === 'undefined' ? [] : (navigator.languages || [navigator.language]);
  return preferred.map((tag) => tag?.toLowerCase().split('-')[0])
    .find((language) => SUPPORTED.includes(language)) || 'ko';
}

export function setLanguagePreference(language) {
  if (language === 'system') localStorage.removeItem(STORAGE_KEY);
  else if (SUPPORTED.includes(language)) localStorage.setItem(STORAGE_KEY, language);
}

export function t(key, ...values) {
  const language = appLanguage();
  const template = language === 'ko' ? key : (Object.hasOwn(messages, key) ? messages[key][language === 'en' ? 0 : 1] : key);
  return values.length ? template.replace(/\{(\d+)\}/g, (match, index) => (
    Number(index) < values.length ? String(values[Number(index)]) : match
  )) : template;
}

export function localizeShell() {
  document.documentElement.lang = appLanguage();
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  for (const name of ['aria-label', 'title', 'placeholder']) {
    const attribute = `data-i18n-${name}`;
    document.querySelectorAll(`[${attribute}]`).forEach((node) => {
      node.setAttribute(name, t(node.getAttribute(attribute)));
    });
  }
}
