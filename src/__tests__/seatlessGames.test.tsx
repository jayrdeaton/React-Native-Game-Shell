import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import type { ReactNode } from 'react'

import { useActiveRound } from '../hooks/useActiveRound'
import { liveplayActions } from '../redux/liveplaySlice'
import { opponentActions } from '../redux/opponentSlice'
import { type LoadoutGame, LoadoutScreen } from '../screens/LoadoutScreen'
import { shellWrapper, STAND_IN_LOADOUT, standInGame, standInPack, standInStore } from '../testUtils/pack'
import { type GameGuide, type RoundMode, roundModeFor, type SeatTwo, seatTwoFor } from '../types'

// A game for one player (no GameDefinition.seatTwo): no opponent button in its loadout, and every round
// solo. The loadout renders for real, with player 1's real opponent button; what needs a native runtime or
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

  it("keeps a game's own choice, and reads one it doesn't offer as the CPU in a game with one", () => {
    expect(seatTwoFor('person', ['cpu', 'person'])).toBe('person')
    expect(seatTwoFor('nobody', ['cpu', 'person'])).toBe('cpu')
    // CardTastic's real-time games at a computer offer the CPU alone.
    expect(seatTwoFor('person', ['cpu'])).toBe('cpu')
    // The order of a game's choices doesn't matter while it has a CPU.
    expect(seatTwoFor('nobody', ['person', 'cpu'])).toBe('cpu')
  })
})

// A game with seat 2 but no CPU (Labyrinth: Solo or a person). The pack's saved seat 2 starts on the CPU
// on a fresh install (DEFAULT_OPPONENT), which such a game has to read as one of its own choices.
describe('a game with seat 2 but no CPU', () => {
  const NO_CPU: SeatTwo[] = ['nobody', 'person']

  it("reads a saved CPU as the game's first choice, and keeps a choice it offers", () => {
    expect(seatTwoFor('cpu', NO_CPU)).toBe('nobody')
    expect(roundModeFor(seatTwoFor('cpu', NO_CPU))).toBe('solo')
    expect(seatTwoFor('cpu', ['person', 'nobody'])).toBe('person')
    expect(seatTwoFor('cpu', ['person'])).toBe('person')
    expect(seatTwoFor('person', NO_CPU)).toBe('person')
    expect(seatTwoFor('nobody', NO_CPU)).toBe('nobody')
    expect(seatTwoFor('nobody', ['person'])).toBe('person')
  })

  it("plays the game's first choice when no round was committed, never the CPU", async () => {
    const maze = standInGame('maze', { seatTwo: NO_CPU })
    const trial = standInGame('trial', { seatTwo: ['person', 'nobody'] })
    const pack = standInPack([maze, trial])
    const roundFor = async (game: string) => (await renderHook(() => useActiveRound(game, {}), { wrapper: shellWrapper(pack, standInStore(pack)) })).result.current.mode

    expect(await roundFor('maze')).toBe('solo')
    expect(await roundFor('trial')).toBe('twoPlayer')
  })

  it('describes a solo round in its How to Play on a fresh install', async () => {
    const { GuideHost } = jest.requireActual('../components/GuideHost') as typeof import('../components/GuideHost')
    const getSteps = jest.fn(() => [])
    const guide: GameGuide = { version: 1, selectVersionSeen: () => 1, markSeen: () => ({ type: 'test/markSeen' }), selectInput: () => ({}), getSteps }
    const pack = standInPack([standInGame('maze', { seatTwo: NO_CPU, guide })])
    const store = standInStore(pack)
    expect(store.getState().opponent.seatTwo).toBe('cpu')
    const Wrapper = shellWrapper(pack, store)

    await render(
      <Wrapper>
        <GuideHost>{null}</GuideHost>
      </Wrapper>
    )

    expect(getSteps).toHaveBeenCalledWith({}, expect.objectContaining({ mode: 'solo' }))
  })

  describe('its loadout', () => {
    const useLoadout = jest.fn((_mode: RoundMode) => ({ ...STAND_IN_LOADOUT, cpuDifficulty: undefined }))
    const maze = standInGame('maze', { seatTwo: NO_CPU, useLoadout }) as LoadoutGame
    const lastOpponent = () =>
      mockOptionPicker.mock.calls
        .map(([props]) => props)
        .filter((props) => props.id === 'p1-opponent')
        .at(-1)

    async function renderMaze() {
      const pack = standInPack([maze])
      const store = standInStore(pack)
      await render(<LoadoutScreen game={maze} />, { wrapper: shellWrapper(pack, store) as (props: { children: ReactNode }) => ReactNode })
      return store
    }

    beforeEach(() => useLoadout.mockClear())

    it('opens on Solo on a fresh install, with no CPU in the menu, and Ready starts a solo round', async () => {
      const store = await renderMaze()

      expect(lastOpponent().options).toEqual([
        { value: 'nobody', label: 'Solo', icon: 'account-off-outline', dividerBefore: true },
        { value: 'person', label: 'Player', icon: 'account-outline', dividerBefore: true }
      ])
      expect(lastOpponent().value).toBe('nobody')
      expect(lastOpponent().colorSection).toBeUndefined()
      expect(useLoadout).toHaveBeenLastCalledWith('solo')

      await act(async () => fireEvent.press(screen.getByTestId('ready')))

      expect(store.getState().liveplay.activeRound).toEqual({ game: 'maze', mode: 'solo', settings: STAND_IN_LOADOUT.roundSettings })
      // The pack's saved seat 2 stays the CPU for its other games: only a pick changes it.
      expect(store.getState().opponent.seatTwo).toBe('cpu')
    })

    it('makes the round 2 Player when Player is picked', async () => {
      const store = await renderMaze()

      await act(async () => lastOpponent().onChange('person'))

      expect(store.getState().opponent.seatTwo).toBe('person')
      expect(lastOpponent().value).toBe('person')
      expect(useLoadout).toHaveBeenLastCalledWith('twoPlayer')
    })
  })
})

describe('useActiveRound', () => {
  const freecell = standInGame('freecell', { seatTwo: undefined })
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

  it('has no opponent button in a game with no seat 2, and Ready starts a solo round', async () => {
    const game = standInGame('freecell', { seatTwo: undefined, useLoadout: () => ({ ...STAND_IN_LOADOUT, cpuDifficulty: undefined }) }) as LoadoutGame
    const store = await renderLoadout(game)

    expect(screen.getByTestId('seat-1')).toBeTruthy()
    expect(screen.queryByTestId('p1-opponent')).toBeNull()

    await act(async () => fireEvent.press(screen.getByTestId('ready')))

    expect(store.getState().liveplay.activeRound).toEqual({ game: 'freecell', mode: 'solo', settings: STAND_IN_LOADOUT.roundSettings })
    expect(router.push).toHaveBeenCalledWith({ pathname: '/play/[game]', params: { game: 'freecell' } })
  })

  it('keeps the opponent button in a game with seat 2', async () => {
    await renderLoadout(standInGame('pong') as LoadoutGame)

    expect(screen.getByTestId('p1-opponent')).toBeTruthy()
  })

  it("offers one plain CPU for seat 2 when the game's CPU has no levels", async () => {
    const game = standInGame('war', { seatTwo: ['cpu', 'person'], useLoadout: () => ({ ...STAND_IN_LOADOUT, cpuDifficulty: undefined }) }) as LoadoutGame
    await renderLoadout(game)

    const seatTwo = mockOptionPicker.mock.calls.map(([props]) => props).find((props) => props.id === 'p1-opponent')
    expect(seatTwo.options[0]).toEqual({ value: 'cpu:', label: 'CPU', icon: 'robot' })
    expect(seatTwo.value).toBe('cpu:')
  })
})
