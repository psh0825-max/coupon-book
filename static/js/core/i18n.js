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

// Keys are the Korean text. 'text@@context' tells apart two uses of the same
// Korean word (사용 as the Use button and as the Used label); Korean shows the
// part before @@. {0|one|other} in a translation picks a plural form by {0}.
export function t(key, ...values) {
  const language = appLanguage();
  const korean = key.split('@@')[0];
  const template = language === 'ko' ? korean : (Object.hasOwn(messages, key) ? messages[key][language === 'en' ? 0 : 1] : korean);
  if (!values.length) return template;
  const value = (index) => values[Number(index)];
  return template
    .replace(/\{(\d+)\|([^|{}]*)\|([^{}]*)\}/g, (match, index, one, other) => (
      Number(index) < values.length ? (Number(value(index)) === 1 ? one : other) : match
    ))
    .replace(/\{(\d+)\}/g, (match, index) => (
      Number(index) < values.length ? String(value(index)) : match
    ));
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
