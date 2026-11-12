import { usePreventRemove } from 'expo-router'
import { useCallback, useRef, useState } from 'react'

import { safeBack } from '../navigation'

// Holds a play screen while `held`: every way off it but the returned `quit` (Android's hardware or
// gesture back, the browser's back, a link) runs `onHeld` instead, which in a game is the
// `requestBack` from @tastic/hud's useQuitConfirmation, so it opens the same Quit Match? the back chip
// does (audit F093: Android's back and the browser's back left a match at once). iOS's swipe back is
// already off on every screen (RootLayout's useThemedRootBackground). `held` is a plain boolean read
// as the screen renders, not useQuitConfirmation's lazy getter, since expo-router needs to know before
// a back comes in; a game whose progress comes from a state hook that needs Quit Match?'s `paused`
// calls this after that hook, with the same test it hands useQuitConfirmation. Off at Game Over, so
// a back there leaves at once, as the chip does.
//
// The block stops every navigation off the screen while it's on, Quit's own included, so `quit` marks
// the way out first and the block lets that one through with `repeat` (expo-router's way to carry on
// with a navigation it stopped). The block goes off in the same handler as `repeat`, the order
// expo-router documents (it warns otherwise): turned off any sooner, it can stand aside after it has
// stopped the navigation and no longer hand it to this callback, so Quit would do nothing. That was a
// real bug in DuelTastic (2026-11-06), whose copy this is.
//
// While it's on, the web also asks before the page unloads (expo-router's usePreventRemove adds a
// beforeunload handler with it).
export function useBackBlock(held: boolean, onHeld: () => void): () => void {
  const leavingRef = useRef(false)
  const [leaving, setLeaving] = useState(false)
  usePreventRemove(held && !leaving, ({ repeat }) => {
    if (leavingRef.current) {
      setLeaving(true)
      repeat()
    } else onHeld()
  })
  return useCallback(() => {
    leavingRef.current = true
    safeBack()
  }, [])
}
