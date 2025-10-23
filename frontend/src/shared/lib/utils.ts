export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string | { $date: string }): string {
  let dateStr: string | Date;

  // Handle MongoDB date format
  if (typeof date === 'object' && date !== null && !( date instanceof Date) && '$date' in date) {
    dateStr = date.$date;
  } else {
    dateStr = date as string | Date;
  }

  const d = new Date(dateStr);
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