import { useIsTouchPrimaryDevice, useRotation } from '@tastic/core'
import { GuideProvider, useGuide } from '@tastic/hud/guide'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector, useStore } from 'react-redux'

import { usePack } from '../PackContext'
import type { ShellState } from '../redux/shellState'
import { roundModeFor, seatTwoFor } from '../types'

interface GameGuideContextValue {
  // Shows a game's How to Play cards if this player hasn't finished or skipped this version yet,
  // then runs `next` once they close; runs `next` at once otherwise (and for a game with no cards of
  // its own). Home calls it on a tile tap, so a game's cards show the first time it's picked, before
  // its loadout opens.
  openFirstTime: (gameId: string, next: () => void) => void
  // Shows a game's cards now, seen or not (a tile's rules button, a loadout's How to Play row). Does
  // nothing for a game with no cards of its own.
  openFor: (gameId: string) => void
  // Shows the pack's own cards now (PackDefinition.guide: Home's Settings).
  openPack: () => void
  // Shows the pack's own cards once per session, while this player hasn't seen this version (Home's
  // first launch).
  autoShowPack: () => void
}

// What the one GuideProvider is showing: the pack's own cards, or a game's (by id).
const PACK_GUIDE = '__pack__'

const NO_INPUT = {}

const GameGuideContext = createContext<GameGuideContextValue | null>(null)

interface Props {
  children: ReactNode
}

// One @tastic/hud GuideProvider for the whole pack, showing whichever cards were asked for last:
// the pack's own (PackDefinition.guide, cards that teach every game at once), or a game's. Each
// game's cards come from its own registry entry (GameDefinition.guide), built from the live settings
// and seat 2 so a replay after any loadout change describes the next match. Mounted around the stack
// in RootLayout, inside the toast provider and OrientationBridge because the card renders through a
// Portal and turns with the shared reading (`rotation`, the same one Home hands its Settings dialog),
// and inside the profiles gate so it mounts together with Home.
export function GuideHost({ children }: Props) {
  const pack = usePack()
  const [subject, setSubject] = useState(() => (pack.guide ? PACK_GUIDE : (pack.games.find((g) => g.guide)?.id ?? null)))
  const packGuide = subject === PACK_GUIDE ? pack.guide : undefined
  const game = subject === PACK_GUIDE ? undefined : pack.games.find((g) => g.id === subject)
  const gameGuide = game?.guide

  const rotation = useRotation()
  const touch = useIsTouchPrimaryDevice()
  const seatTwo = useSelector((state: ShellState) => state.opponent.seatTwo)
  const input = useSelector((state: ShellState) => (gameGuide ? gameGuide.selectInput(state) : NO_INPUT), shallowEqual)
  const seenVersion = useSelector((state: ShellState) => (packGuide ?? gameGuide)?.selectVersionSeen(state) ?? 0)
  const dispatch = useDispatch()

  // The seat-2 choice the cards describe: the one the player last picked, the CPU in a game that has
  // no room for it (a saved 'nobody' in a game without a solo mode), or nobody in a game for one.
  const mode = roundModeFor(seatTwoFor(seatTwo, game?.seatTwo))
  const steps = useMemo(() => (packGuide ? packGuide.getSteps({ touch }) : gameGuide ? gameGuide.getSteps(input, { touch, mode }) : []), [packGuide, gameGuide, input, touch, mode])
  const onSeen = useCallback(
    (version: number) => {
      const guide = packGuide ?? gameGuide
      if (guide) dispatch(guide.markSeen(version))
    },
    [dispatch, packGuide, gameGuide]
  )

  return (
    <GuideProvider steps={steps} currentVersion={(packGuide ?? gameGuide)?.version ?? 0} seenVersion={seenVersion} onSeen={onSeen} rotation={rotation}>
      <GameGuideBridge onPick={setSubject}>{children}</GameGuideBridge>
    </GuideProvider>
  )
}

// Inside GuideProvider, so it can open the dialog and watch it close.
function GameGuideBridge({ onPick, children }: { onPick: (subject: string) => void; children: ReactNode }) {
  const pack = usePack()
  const store = useStore<ShellState>()
  const { isOpen, open } = useGuide()
  const pendingNext = useRef<(() => void) | null>(null)
  const wasOpen = useRef(false)
  // The pack's cards show by themselves once per session at most: Home mounts again whenever the
  // player comes back to it, and skipping shouldn't have to happen twice before the seen version is
  // written back.
  const packAutoShown = useRef(false)

  // When cards opened by openFirstTime close (finished, skipped or dismissed), carry on to where the
  // tap was going.
  useEffect(() => {
    if (wasOpen.current && !isOpen && pendingNext.current) {
      const next = pendingNext.current
      pendingNext.current = null
      next()
    }
    wasOpen.current = isOpen
  }, [isOpen])

  const openFor = useCallback(
    (gameId: string) => {
      if (!pack.games.find((g) => g.id === gameId)?.guide) return
      onPick(gameId)
      open()
    },
    [pack, onPick, open]
  )

  const openFirstTime = useCallback(
    (gameId: string, next: () => void) => {
      const guide = pack.games.find((g) => g.id === gameId)?.guide
      if (!guide || guide.selectVersionSeen(store.getState()) >= guide.version) {
        next()
        return
      }
      pendingNext.current = next
      openFor(gameId)
    },
    [pack, store, openFor]
  )

  const openPack = useCallback(() => {
    if (!pack.guide) return
    onPick(PACK_GUIDE)
    open()
  }, [pack, onPick, open])

  const autoShowPack = useCallback(() => {
    const guide = pack.guide
    if (!guide || packAutoShown.current || guide.selectVersionSeen(store.getState()) >= guide.version) return
    packAutoShown.current = true
    openPack()
  }, [pack, store, openPack])

  const value = useMemo(() => ({ openFirstTime, openFor, openPack, autoShowPack }), [openFirstTime, openFor, openPack, autoShowPack])
  return <GameGuideContext.Provider value={value}>{children}</GameGuideContext.Provider>
}

export function useGameGuide(): GameGuideContextValue {
  const ctx = useContext(GameGuideContext)
  if (!ctx) throw new Error('useGameGuide must be used within a GuideHost')
  return ctx
}
