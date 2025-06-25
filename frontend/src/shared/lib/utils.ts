export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  // Add 7 hours for Thailand timezone
  d.setHours(d.getHours() + 7);
  
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(7);
} 