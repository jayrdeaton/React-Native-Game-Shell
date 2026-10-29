import { useState } from 'react'

// Returns `value`, except while `hidden` is true: then it keeps returning whatever `value` was the
// instant before `hidden` became true, rather than whatever `value` has already become. Ported from
// Solitaire's components/useFrozenWhileHidden.ts as it was.
//
// Home holds its layout with it while another screen covers it (screens/HomeScreen.tsx): Home stays
// mounted beneath every screen the stack pushes and keeps following the rotation, and crossing the
// upright/wide threshold swaps its whole tree (every tile, the hero, seat 1's button), invisible work
// landing in the same commit as the covering screen's own rotation update. While covered the layout is
// held where it was; it catches up (one swap, visible) when Home is shown again.
export function useFrozenWhileHidden<T>(value: T, hidden: boolean): T {
  // React's own sanctioned "adjust state during render" shape (see react.dev's guide of the same
  // name) rather than mutating a ref during render: each setter below is only ever called when the
  // value it tracks has actually changed, so this settles within the same render pass instead of
  // triggering a visible extra frame.
  const [prevHidden, setPrevHidden] = useState(hidden)
  const [prevValue, setPrevValue] = useState(value)
  const [frozen, setFrozen] = useState(value)

  if (hidden !== prevHidden) {
    setPrevHidden(hidden)
    // Freezes `prevValue` (last render's value, still whatever was visible a moment ago), not this
    // render's `value`: hidden can flip true the same commit `value` already changed, and it's the
    // outgoing one that should stay on screen.
    if (hidden) setFrozen(prevValue)
  }
  if (value !== prevValue) {
    setPrevValue(value)
  }

  return hidden ? frozen : value
}
