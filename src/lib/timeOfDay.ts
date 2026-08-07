/**
 * Time-of-day theming for the home page background.
 *
 * The gradients are deliberately dark: the app's text is #F0EEE8 and its cards
 * are #1A1A1A, so a literally bright "morning yellow" would strand near-white
 * text on a light background and make the cards read as holes. Instead each
 * period keeps its hue and drops its value, with the colour concentrated at the
 * top (behind the streak bar and hero) resolving into --bg before the task list
 * starts. Sky above, ground below -- the cards always sit on near-black.
 */

export type Period = 'morning' | 'afternoon' | 'evening' | 'night'

export const PERIOD_GRADIENTS: Record<Period, string> = {
  // Light blue sky over a warm sunrise band. The two hues need to stay
  // separated -- blending blue straight into amber passes through neutral grey
  // and reads as olive murk.
  morning: 'linear-gradient(180deg, #2F5070 0%, #6B5424 24%, #241C12 50%, #0F0F0F 78%)',
  // Brightest of the four on purpose. Pushed as far as the gold counter allows
  // -- it sits directly on this gradient, and past roughly #2A5A94 it drops
  // under 3:1 and starts washing out.
  afternoon: 'linear-gradient(180deg, #2A5A94 0%, #1B3A5C 32%, #0F0F0F 66%)',
  evening: 'linear-gradient(180deg, #5C2A10 0%, #301A22 30%, #0F0F0F 64%)',
  // Near-invisible by design -- night is the app's natural --bg, lifted just
  // enough toward blue to read as a deliberate state rather than no state.
  night: 'linear-gradient(180deg, #13141C 0%, #101117 34%, #0F0F0F 66%)',
}

/**
 * Maps a local-time hour (0-23) to its period. Must be called with the *user's*
 * local hour -- deriving this on the server would use the server's timezone.
 */
export function periodForHour(hour: number): Period {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}
