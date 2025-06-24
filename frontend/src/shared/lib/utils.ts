import { config } from '../../config/config';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString(config.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: config.timezone
  });
}

export function generateId(): string {
  return Math.random().toString(36).substring(7);
} 