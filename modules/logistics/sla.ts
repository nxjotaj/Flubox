const DAY_MS = 86_400_000;
export function addBusinessDays(
  startIso: string,
  days: number,
  holidays: ReadonlySet<string> = new Set(),
) {
  const date = new Date(startIso);
  let remaining = days;
  while (remaining > 0) {
    date.setTime(date.getTime() + DAY_MS);
    const day = date.getUTCDay();
    const key = date.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(key)) remaining -= 1;
  }
  return date.toISOString();
}
export type SlaStatus = 'on_time' | 'due_today' | 'overdue';
export function getSlaStatus(deadlineIso: string, nowIso: string): SlaStatus {
  const deadline = new Date(deadlineIso);
  const now = new Date(nowIso);
  if (now.getTime() > deadline.getTime()) return 'overdue';
  return deadline.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
    ? 'due_today'
    : 'on_time';
}
