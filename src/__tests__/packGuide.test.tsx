import { act, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import type { UnknownAction } from 'redux'

import { GuideHost, useGameGuide } from '../components/GuideHost'
import type { ShellState } from '../redux/shellState'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { GameGuide, PackDefinition, PackGuide } from '../types'

// The pack's own How to Play (PackDefinition.guide, Solitaire's three cards that teach every game):
// shown by itself once per session while unseen, replayed from Home's Settings, and alongside games
// that have no cards of their own (GameDefinition.guide optional) or still do (Ratscrew). The real
// GuideHost over the real store; hud's GuideProvider is a stand-in that records which cards it holds
// and whether they're open.

type GuideState = { steps: { title: string }[]; currentVersion: number; seenVersion: number; isOpen: boolean }
let mockGuide: GuideState = { steps: [], currentVersion: 0, seenVersion: 0, isOpen: false }
let mockClose: () => void = () => {}

jest.mock('@tastic/hud/guide', () => {
  const { createContext, useContext, useState } = require('react')
  const GuideContext = createContext({ isOpen: false, open: () => {} })
  return {
    GuideProvider: ({ steps, currentVersion, seenVersion, onSeen, children }: { steps: { title: string }[]; currentVersion: number; seenVersion: number; onSeen: (version: number) => void; children: ReactNode }) => {
      const [isOpen, setOpen] = useState(false)
      mockGuide = { steps, currentVersion, seenVersion, isOpen }
      mockClose = () => {
        setOpen(false)
        if (seenVersion < currentVersion) onSeen(currentVersion)
      }
      return <GuideContext.Provider value={{ isOpen, open: () => setOpen(true) }}>{children}</GuideContext.Provider>
    },
    useGuide: () => useContext(GuideContext)
  }
})

// A key of the pack's own for the pack guide's seen version, and one for a game's.
const seenReducer =
  (prefix: string) =>
  (state = { versionSeen: 0 }, action: UnknownAction) =>
    action.type === `${prefix}/markSeen` ? { versionSeen: (action as unknown as { payload: number }).payload } : state
const selectSeen = (key: string) => (state: ShellState) => (state as unknown as Record<string, { versionSeen: number }>)[key].versionSeen

const PACK_GUIDE: PackGuide = { version: 1, selectVersionSeen: selectSeen('packGuide'), markSeen: (version) => ({ type: 'pack/markSeen', payload: version }), getSteps: ({ touch }) => [{ title: touch ? 'Tap to Play' : 'Click to Play' } as never] }
const RATSCREW_GUIDE: GameGuide = { version: 1, selectVersionSeen: selectSeen('ratscrewGuide'), markSeen: (version) => ({ type: 'ratscrew/markSeen', payload: version }), selectInput: () => ({}), getSteps: () => [{ title: 'Slap' } as never] }

const klondike = standInGame('klondike', { guide: undefined, useLoadout: undefined, seatTwo: undefined })
const ratscrew = standInGame('ratscrew', { guide: RATSCREW_GUIDE })

let guide: ReturnType<typeof useGameGuide>
function Probe() {
  guide = useGameGuide()
  return null
}

async function renderHost(overrides: Partial<PackDefinition> = { guide: PACK_GUIDE }, seen = 0) {
  const pack = standInPack([klondike, ratscrew], { reducers: { packGuide: seenReducer('pack'), ratscrewGuide: seenReducer('ratscrew') }, ...overrides })
  const store = standInStore(pack)
  if (seen) store.dispatch({ type: 'pack/markSeen', payload: seen })
  const Wrapper = shellWrapper(pack, store)
  await render(
    <Wrapper>
      <GuideHost>
        <Probe />
      </GuideHost>
    </Wrapper>
  )
  return store
}

describe("a pack's own How to Play", () => {
  it('shows by itself once per session while this player has not seen it', async () => {
    await renderHost()
    await act(async () => guide.autoShowPack())

    expect(mockGuide).toEqual(expect.objectContaining({ isOpen: true, currentVersion: 1, seenVersion: 0 }))
    expect(mockGuide.steps.map((step) => step.title)).toEqual(['Tap to Play'])

    await act(async () => mockClose())
    await act(async () => guide.autoShowPack())
    expect(mockGuide.isOpen).toBe(false)
  })

  it('marks it seen when it closes, so it never shows by itself again', async () => {
    const store = await renderHost()
    await act(async () => guide.autoShowPack())
    await act(async () => mockClose())

    expect(selectSeen('packGuide')(store.getState() as never)).toBe(1)
  })

  it('stays shut once seen, until opened from Settings', async () => {
    await renderHost(undefined, 1)
    await act(async () => guide.autoShowPack())
    expect(mockGuide.isOpen).toBe(false)

    await act(async () => guide.openPack())
    expect(mockGuide.isOpen).toBe(true)
    expect(mockGuide.steps.map((step) => step.title)).toEqual(['Tap to Play'])
  })

  it('opens a game with no cards of its own straight away, and its rules button shows nothing', async () => {
    await renderHost()
    const next = jest.fn()
    await act(async () => guide.openFirstTime('klondike', next))
    expect(next).toHaveBeenCalledTimes(1)

    await act(async () => guide.openFor('klondike'))
    expect(mockGuide.isOpen).toBe(false)
  })

  it("still shows a game's own cards the first time it's picked", async () => {
    await renderHost()
    const next = jest.fn()
    await act(async () => guide.openFirstTime('ratscrew', next))

    expect(next).not.toHaveBeenCalled()
    expect(mockGuide.isOpen).toBe(true)
    expect(mockGuide.steps.map((step) => step.title)).toEqual(['Slap'])
    await act(async () => mockClose())
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('does nothing in a pack without one', async () => {
    await renderHost({})
    await act(async () => guide.autoShowPack())
    await act(async () => guide.openPack())

    expect(mockGuide.isOpen).toBe(false)
  })
})
