/**
 * Type-safe locale key derived from the canonical English locale.
 * All locale objects must satisfy Record<LocaleKey, string>.
 */
import type { enLocale } from './en.js';

export type LocaleKey = keyof typeof enLocale;
