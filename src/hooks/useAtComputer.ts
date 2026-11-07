import { useIsTouchPrimaryDevice } from '@tastic/core'
import { Platform } from 'react-native'

// Whether this is a computer: the web without a touch-first screen (@tastic/core's
// useIsTouchPrimaryDevice). There two players
// share one upright screen at one keyboard, whatever the window's shape, so 2 Player sits side by side
// (Jay, 2026-11-07: face to face only on a phone or tablet, natively or in its browser) and the match
// chips stay up in the page's corners. The loadout (GameDefinition.sideBySideAtComputer), MatchChips,
// and a pack's own match seating all read this one test.
export function useAtComputer(): boolean {
  const touchPrimary = useIsTouchPrimaryDevice()
  return Platform.OS === 'web' && !touchPrimary
}
