import { render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { opponentActions } from '../redux/opponentSlice'
import { type LoadoutGame, LoadoutScreen } from '../screens/LoadoutScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { SeatTwo } from '../types'

// How the loadout seats its panels (@tastic/core 0.15's window-shape rule): 2 Player face to face in
// any window unless the game seats players side by side in a wide one (sideBySideWhenWide), and one
// person's row following the window. The real LoadoutScreen; the window is a stand-in, and
// useDualZoneLayout records the seat mode it's handed.

const PORTRAIT = { width: 402, height: 874 }
const LANDSCAPE = { width: 1376, height: 1032 }
let mockWindow = PORTRAIT
const mockDualZone = jest.fn()

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ ...mockWindow, scale: 2, fontScale: 1 }) }))
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect])
  }
})
jest.mock('../components/GuideHost', () => ({ ...jest.requireActual('../components/GuideHost'), useGameGuide: () => ({ openFirstTime: jest.fn(), openFor: jest.fn(), openPack: jest.fn(), autoShowPack: jest.fn() }) }))
jest.mock('../components/SettingsDialog', () => ({ SettingsDialog: () => null }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], lastSelected: { 1: null, 2: null }, selectProfile: jest.fn() }) }))
jest.mock('../hooks/useSeatColors', () => ({ useSeatColors: () => ({ p1Color: '#2196f3', p2Color: '#f44336', handleP1ColorChange: jest.fn(), handleP2ColorChange: jest.fn() }) }))
jest.mock('@tastic/hud/lobby', () => ({ ...jest.requireActual('@tastic/hud/lobby'), PlayerSetupPanel: () => null, ReadyButton: () => null }))
jest.mock('@tastic/hud/chrome', () => ({ ...jest.requireActual('@tastic/hud/chrome'), CornerActionButtons: () => null }))
jest.mock('@tastic/split-screen', () => ({
  ...jest.requireActual('@tastic/split-screen'),
  useDualZoneLayout: (orientationMode: string, p1OnRight: boolean, resolved: boolean, upsideDown: boolean) => {
    mockDualZone({ orientationMode, p1OnRight, resolved, upsideDown })
    return { panelLayout: { orientationMode, p1OnRight, upsideDown }, panelFadeStyle: {} }
  },
  DualZoneLayout: ({ p1, p2 }: { p1: ReactNode; p2: ReactNode }) => (
    <>
      {p1}
      {p2}
    </>
  )
}))
jest.mock('../components/SeatTwoPanel', () => ({ SeatTwoPanel: () => null }))

async function seatModeFor(game: LoadoutGame, seatTwo: SeatTwo, window: typeof PORTRAIT) {
  mockWindow = window
  mockDualZone.mockClear()
  const pack = standInPack([game])
  const store = standInStore(pack)
  store.dispatch(opponentActions.setSeatTwo(seatTwo))
  await render(<LoadoutScreen game={game} />, { wrapper: shellWrapper(pack, store) as (props: { children: ReactNode }) => ReactNode })
  return mockDualZone.mock.lastCall![0]
}

describe("the loadout's seats", () => {
  const faceToFaceGame = standInGame('tag') as LoadoutGame
  const sideBySideGame = standInGame('snake', { sideBySideWhenWide: true }) as LoadoutGame

  afterEach(() => {
    mockWindow = PORTRAIT
  })

  it('sits two players face to face in a portrait window, whichever the game', async () => {
    expect((await seatModeFor(faceToFaceGame, 'person', PORTRAIT)).orientationMode).toBe('faceToFace')
    expect((await seatModeFor(sideBySideGame, 'person', PORTRAIT)).orientationMode).toBe('faceToFace')
  })

  it('keeps two players face to face in a wide window unless the game seats them side by side there', async () => {
    expect((await seatModeFor(faceToFaceGame, 'person', LANDSCAPE)).orientationMode).toBe('faceToFace')
    expect(await seatModeFor(sideBySideGame, 'person', LANDSCAPE)).toEqual({ orientationMode: 'sideBySide', p1OnRight: false, resolved: true, upsideDown: false })
  })

  it("follows the window with one person, whatever the game's two-player seating", async () => {
    expect((await seatModeFor(faceToFaceGame, 'cpu', LANDSCAPE)).orientationMode).toBe('sideBySide')
    expect((await seatModeFor(faceToFaceGame, 'cpu', PORTRAIT)).orientationMode).toBe('faceToFace')
  })
})
