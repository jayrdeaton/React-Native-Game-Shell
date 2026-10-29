import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import type { ReactNode } from 'react'

import { useActiveRound } from '../hooks/useActiveRound'
import { liveplayActions } from '../redux/liveplaySlice'
import { opponentActions } from '../redux/opponentSlice'
import { type LoadoutGame, LoadoutScreen } from '../screens/LoadoutScreen'
import { shellWrapper, STAND_IN_LOADOUT, standInGame, standInPack, standInStore } from '../testUtils/pack'
import { type GameGuide, roundModeFor, type SeatTwo, seatTwoFor } from '../types'

// A game for one player (no GameDefinition.seatTwo): no seat 2 button in its loadout, and every round
// solo. The loadout renders for real, with seat 2's real button; what needs a native runtime or
// another provider is replaced: the insets, expo-router (its router records each push, a focus effect
// runs as an effect), the How to Play host and the Settings dialog, the profiles and seat colors, and
// hud's seat 1 panel and Ready button, and @tastic/profile's menu button, as recording stand-ins.

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
jest.mock('@tastic/hud/lobby', () => {
  const { Pressable: RNPressable, View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/hud/lobby'),
    PlayerSetupPanel: () => <RNView testID='seat-1' />,
    ReadyButton: ({ onToggleReady }: { onToggleReady: () => void }) => <RNPressable testID='ready' onPress={onToggleReady} />
  }
})
jest.mock('@tastic/hud/chrome', () => ({ ...jest.requireActual('@tastic/hud/chrome'), CornerActionButtons: () => null }))
// The panels' fade runs on Reanimated, which the package's mock doesn't animate: the layout follows
// the reading at once, and 2 Player's two halves are both drawn.
jest.mock('@tastic/split-screen', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/split-screen'),
    useDualZoneLayout: (orientationMode: string, p1OnRight: boolean, _resolved: boolean, upsideDown: boolean) => ({ panelLayout: { orientationMode, p1OnRight, upsideDown }, panelFadeStyle: {} }),
    DualZoneLayout: ({ p1, p2 }: { p1: ReactNode; p2: ReactNode }) => (
      <RNView>
        {p1}
        {p2}
      </RNView>
    )
  }
})
const mockOptionPicker = jest.fn()
jest.mock('@tastic/profile', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/profile'),
    OptionPicker: (props: { id: string }) => {
      mockOptionPicker(props)
      return <RNView testID={props.id} />
    }
  }
})

const SEAT_TWO: SeatTwo[] = ['cpu', 'person', 'nobody']

beforeEach(() => {
  jest.mocked(router.push).mockClear()
  mockOptionPicker.mockClear()
})

describe('seatTwoFor', () => {
  it('reads every saved choice as nobody, so a solo round, in a game with no seat 2', () => {
    for (const saved of SEAT_TWO) {
      expect(seatTwoFor(saved, undefined)).toBe('nobody')
      expect(roundModeFor(seatTwoFor(saved, undefined))).toBe('solo')
    }
  })

  it("keeps a game's own choice, and reads one it doesn't offer as the CPU", () => {
    expect(seatTwoFor('person', ['cpu', 'person'])).toBe('person')
    expect(seatTwoFor('nobody', ['cpu', 'person'])).toBe('cpu')
  })
})

describe('useActiveRound', () => {
  const freecell = standInGame('freecell', { seatTwo: undefined, twoPlayerSeats: undefined })
  const pong = standInGame('pong')
  const pack = standInPack([freecell, pong])

  const roundFor = async (game: string, store = standInStore(pack)) => (await renderHook(() => useActiveRound(game, { speed: 'normal' }), { wrapper: shellWrapper(pack, store) })).result.current

  it('plays solo in a game with no seat 2 when no round was committed (Home opens it straight away)', async () => {
    expect(await roundFor('freecell')).toEqual({ mode: 'solo', settings: { speed: 'normal' } })
  })

  it('plays the CPU in a game with seats when no round was committed, as before', async () => {
    expect((await roundFor('pong')).mode).toBe('vsCpu')
  })

  it('plays the round the loadout committed', async () => {
    const store = standInStore(pack)
    store.dispatch(liveplayActions.setActiveRound({ game: 'freecell', mode: 'solo', settings: { speed: 'fast' } }))
    expect(await roundFor('freecell', store)).toEqual({ mode: 'solo', settings: { speed: 'fast' } })
  })
})

describe("a game's How to Play", () => {
  const { GuideHost } = jest.requireActual('../components/GuideHost') as typeof import('../components/GuideHost')

  it('describes a solo round in a game with no seat 2, whatever seat 2 was last set to', async () => {
    const getSteps = jest.fn(() => [])
    const guide: GameGuide = { version: 1, selectVersionSeen: () => 1, markSeen: () => ({ type: 'test/markSeen' }), selectInput: () => ({}), getSteps }
    const pack = standInPack([standInGame('freecell', { seatTwo: undefined, guide })])
    const store = standInStore(pack)
    store.dispatch(opponentActions.setSeatTwo('person'))
    const Wrapper = shellWrapper(pack, store)

    await render(
      <Wrapper>
        <GuideHost>{null}</GuideHost>
      </Wrapper>
    )

    expect(getSteps).toHaveBeenCalledWith({}, expect.objectContaining({ mode: 'solo' }))
  })
})

describe('the loadout', () => {
  async function renderLoadout(game: LoadoutGame) {
    const pack = standInPack([game])
    const store = standInStore(pack)
    await render(<LoadoutScreen game={game} />, { wrapper: shellWrapper(pack, store) as (props: { children: ReactNode }) => ReactNode })
    return store
  }

  it('has no seat 2 button in a game with no seat 2, and Ready starts a solo round', async () => {
    const game = standInGame('freecell', { seatTwo: undefined, twoPlayerSeats: undefined, useLoadout: () => ({ ...STAND_IN_LOADOUT, cpuDifficulty: undefined }) }) as LoadoutGame
    const store = await renderLoadout(game)

    expect(screen.getByTestId('seat-1')).toBeTruthy()
    expect(screen.queryByTestId('p2-seat')).toBeNull()

    await act(async () => fireEvent.press(screen.getByTestId('ready')))

    expect(store.getState().liveplay.activeRound).toEqual({ game: 'freecell', mode: 'solo', settings: STAND_IN_LOADOUT.roundSettings })
    expect(router.push).toHaveBeenCalledWith({ pathname: '/play/[game]', params: { game: 'freecell' } })
  })

  it('keeps seat 2 in a game with one', async () => {
    await renderLoadout(standInGame('pong') as LoadoutGame)

    expect(screen.getByTestId('p2-seat')).toBeTruthy()
  })

  it("offers one plain CPU for seat 2 when the game's CPU has no levels", async () => {
    const game = standInGame('war', { seatTwo: ['cpu', 'person'], useLoadout: () => ({ ...STAND_IN_LOADOUT, cpuDifficulty: undefined }) }) as LoadoutGame
    await renderLoadout(game)

    const seatTwo = mockOptionPicker.mock.calls.map(([props]) => props).find((props) => props.id === 'p2-seat')
    expect(seatTwo.options[0]).toEqual({ value: 'cpu:', label: 'CPU', icon: 'robot' })
    expect(seatTwo.value).toBe('cpu:')
  })
})
