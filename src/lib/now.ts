// Override the app's notion of "now" for testing.
// Set to an ISO string (e.g. '2026-06-23T12:00:00+02:00') to freeze time,
// or to null to use the real wall clock.
const FAKE_NOW: string | null = '2026-06-23T12:00:00+02:00'

export function now(): Date {
  return FAKE_NOW ? new Date(FAKE_NOW) : new Date()
}
