/**
 * Returns today's date as a YYYY-MM-DD string in the user's local timezone.
 * This is the key for all "is it a new day?" checks.
 */
export function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Returns yesterday's date as a YYYY-MM-DD string.
 */
export function yesterdayString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Checks whether the user completed tasks yesterday -- used to determine
 * if a streak should be preserved or reset on login.
 */
export function isStreakAlive(lastCompletedDate: string | null): boolean {
  if (!lastCompletedDate) return false
  return lastCompletedDate === yesterdayString() || lastCompletedDate === todayString()
}

/**
 * Checks if all tasks were already completed today.
 */
export function completedToday(lastCompletedDate: string | null): boolean {
  if (!lastCompletedDate) return false
  return lastCompletedDate === todayString()
}
