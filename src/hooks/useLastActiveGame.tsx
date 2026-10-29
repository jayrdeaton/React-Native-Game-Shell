import { createContext, ReactNode, useContext, useMemo, useRef, useState } from 'react'
import { useDispatch, useStore } from 'react-redux'

import { lastActiveGameActions } from '../redux/lastActiveGameSlice'
import type { ShellState } from '../redux/shellState'

interface LastActiveGameContextValue {
  // Returns the game a cold launch should drop the player straight back onto (once), or null.
  consumeResumeGame: () => string | null
  setLastActiveGame: (gameId: string) => void
  clearLastActiveGame: () => void
}

const LastActiveGameContext = createContext<LastActiveGameContextValue | null>(null)

// Which play screen the player is currently on, persisted (the store's `lastActiveGame` key) so a
// cold launch/relaunch can drop them straight back onto it (see screens/HomeScreen.tsx) instead of
// Home - independent of whether that game still has a resumable board, which is the game's own.
// Mounted inside PersistGate, so the value read once at mount is already the rehydrated one. Ported
// from Solitaire's stores/lastActiveGame.tsx as it was.
//
// Deliberately NOT React state, and never read with useSelector. The only thing that ever needed the
// live value was Home's resume Redirect, and that is a one-shot cold-launch decision - so exposing it
// as state made every set/clear (each game mount, each Home tap) re-render every consumer, and made
// every Home instance in the stack swap its whole menu tree for a Redirect and back (in Solitaire,
// tearing down and rebuilding ~370 SVG preview cards on each transition). The value handed out here
// is stable for the provider's whole lifetime; `pendingResume` is consumed by the first Home to mount
// and cleared by any set/clear, so a launch straight into a game (deep link) can never later resume a
// stale one. A pack with no resumable game has no `lastActiveGame` key, and this reads null.
export function LastActiveGameProvider({ children }: { children: ReactNode }) {
  const store = useStore<ShellState>()
  const dispatch = useDispatch()
  // Read once, at mount (a lazy initializer, never a subscription).
  const [initial] = useState(() => store.getState().lastActiveGame?.gameId ?? null)
  const pendingResume = useRef<string | null>(initial)
  // What the store currently holds, so an unchanged value is never rewritten: every game mount sets it
  // and every exit clears it.
  const persisted = useRef<string | null>(initial)

  const value = useMemo<LastActiveGameContextValue>(
    () => ({
      consumeResumeGame: () => {
        const game = pendingResume.current
        pendingResume.current = null
        return game
      },
      setLastActiveGame: (gameId) => {
        pendingResume.current = null
        if (persisted.current === gameId) return
        persisted.current = gameId
        dispatch(lastActiveGameActions.setGameId(gameId))
      },
      // Called from the play route's unmount cleanup (screens/GameRoute.tsx) - it fires on the play
      // screen's own back, hardware back, or a browser back, but not on mere app backgrounding, where
      // the screen stays mounted. That's exactly "explicitly back out."
      clearLastActiveGame: () => {
        pendingResume.current = null
        if (persisted.current === null) return
        persisted.current = null
        dispatch(lastActiveGameActions.setGameId(null))
      }
    }),
    [dispatch]
  )

  return <LastActiveGameContext.Provider value={value}>{children}</LastActiveGameContext.Provider>
}

export function useLastActiveGame(): LastActiveGameContextValue {
  const ctx = useContext(LastActiveGameContext)
  if (!ctx) throw new Error('useLastActiveGame must be used within a LastActiveGameProvider')
  return ctx
}
