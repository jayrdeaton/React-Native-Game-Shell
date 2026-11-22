import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AppState, type AppStateStatus, View } from 'react-native'

import { LoadoutRoute, PlayRoute } from '../screens/GameRoute'
import { computeHomeLayout, PREVIEW_ASPECT, ROW_PREVIEW_WIDTH } from '../screens/homeLayout'
import { HomeScreen, ROW_BLURB_LINES } from '../screens/HomeScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { GameDefinition, GamePreviewProps, HeroTitleProps, PackDefinition } from '../types'

// The real Home screen and game routes, with what needs a native runtime or another provider
// replaced: the window (mutable, for a wide screen), the insets, expo-router (its router records each
// push, Redirect shows where it goes, the focus is mutable for a covered Home), and Home's heavier
// neighbours (the How to Play host, which runs `next` at once, as for a guide already seen; the
// Settings dialog; the profiles and seat colors; seat 1's button). The pack, the store and the resume
// point are the real ones (testUtils/pack.tsx).

let mockWindow = { width: 402, height: 874 }
let mockFocused = true
let mockParams: Record<string, string> = {}
const mockOpenFirstTime = jest.fn((_gameId: string, next: () => void) => next())

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ ...mockWindow, scale: 1, fontScale: 1 }) }))
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => {
  const { Text } = require('react-native')
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useIsFocused: () => mockFocused,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
    Redirect: ({ href }: { href: unknown }) => <Text testID='redirect'>{JSON.stringify(href)}</Text>
  }
})
jest.mock('../components/GuideHost', () => ({ useGameGuide: () => ({ openFirstTime: mockOpenFirstTime, openFor: jest.fn(), openPack: jest.fn(), autoShowPack: jest.fn() }) }))
jest.mock('../components/SettingsDialog', () => ({ SettingsDialog: () => null }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], lastSelected: { 1: null, 2: null }, selectProfile: jest.fn() }) }))
jest.mock('../hooks/useSeatColors', () => ({ useSeatColors: () => ({ p1Color: '#2196f3', p2Color: '#f44336', handleP1ColorChange: jest.fn() }) }))
jest.mock('@tastic/profile', () => ({ ...jest.requireActual('@tastic/profile'), ProfilePicker: () => null }))

const PHONE = { width: 402, height: 874 }
const PHONE_SIDEWAYS = { width: 874, height: 402 }

// The hero records what Home hands it (its box, in the wide layout).
const mockHero = jest.fn((_props: HeroTitleProps) => null)

// A preview that records its box and says whose it is.
const previewProps = jest.fn()
function Preview(id: string) {
  return function StandInPreview(props: GamePreviewProps) {
    previewProps(id, props)
    return <View testID={`preview-${id}`} />
  }
}

const lastHeroProps = () => mockHero.mock.calls[mockHero.mock.calls.length - 1][0]

async function renderHome(pack: PackDefinition, lastActiveGameId: string | null = null) {
  const store = standInStore(pack, lastActiveGameId)
  const view = await render(<HomeScreen />, { wrapper: shellWrapper(pack, store) })
  return { store, ...view }
}

// Lets the frame Home waits for go by, so the previews it held back are drawn.
async function nextFrame() {
  await act(async () => {
    jest.runOnlyPendingTimers()
  })
}

const TITLE_STYLE = { fontFamily: 'AlphaSketch' }

beforeEach(() => {
  jest.useFakeTimers()
  mockWindow = PHONE
  mockFocused = true
  mockParams = {}
  jest.mocked(router.push).mockClear()
  mockOpenFirstTime.mockClear()
  mockHero.mockClear()
  previewProps.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

// A pack's title lettering (AlphaTastic's title font) on each game's card title, and nowhere else on it.
describe("a pack's title style", () => {
  it("letters each game's card title, leaving its blurb alone", async () => {
    const game = standInGame('trap', { blurb: 'Box the other rider in.' })
    await renderHome(standInPack([game], { titleStyle: TITLE_STYLE }))

    expect([screen.getByText(game.title).props.style].flat(Infinity)).toContainEqual(TITLE_STYLE)
    expect([screen.getByText(game.blurb).props.style].flat(Infinity)).not.toContainEqual(TITLE_STYLE)
  })
})

describe("a row's blurb", () => {
  it('wraps to three lines before it is cut off, so a narrow phone shows all of it', async () => {
    const long = standInGame('trap', { blurb: 'The classic light-trail duel. Box the other rider in.' })
    await renderHome(standInPack([long]))
    expect(screen.getByText(long.blurb).props.numberOfLines).toBe(ROW_BLURB_LINES)
    expect(ROW_BLURB_LINES).toBeGreaterThanOrEqual(3)
  })
})

describe('a game with no loadout', () => {
  const pong = standInGame('pong')
  const klondike = standInGame('klondike', { useLoadout: undefined, seatTwo: undefined })
  const pack = standInPack([pong, klondike], { HeroTitle: mockHero })

  it('opens straight to its play screen from Home, after its How to Play the first time', async () => {
    await renderHome(pack)
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Game klondike' })))

    expect(mockOpenFirstTime).toHaveBeenCalledWith('klondike', expect.any(Function))
    expect(router.push).toHaveBeenCalledWith({ pathname: '/play/[game]', params: { game: 'klondike' } })
  })

  it('leaves a game with a loadout opening its loadout', async () => {
    await renderHome(pack)
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Game pong' })))

    expect(router.push).toHaveBeenCalledWith({ pathname: '/loadout/[game]', params: { game: 'pong' } })
  })

  it('turns a link to its loadout into a link to its play screen', async () => {
    mockParams = { game: 'klondike' }
    await render(<LoadoutRoute />, { wrapper: shellWrapper(pack, standInStore(pack)) })

    expect(JSON.parse(screen.getByTestId('redirect').props.children)).toEqual({ pathname: '/play/[game]', params: { game: 'klondike' } })
  })
})

describe('a resume', () => {
  const klondike = standInGame('klondike', { resumable: true, useLoadout: undefined, seatTwo: undefined })
  const pong = standInGame('pong')
  const pack = standInPack([pong, klondike], { HeroTitle: mockHero })
  const playHref = { pathname: '/play/[game]', params: { game: 'klondike' } }

  // The react-native preset's AppState mock has a jest.fn for currentState (a string in React
  // Native), and the play route reads it as it unmounts: every case starts with the app in use.
  const presetCurrentState = AppState.currentState
  const setCurrentState = (state: AppStateStatus) => Object.assign(AppState, { currentState: state })
  beforeEach(() => setCurrentState('active'))
  afterAll(() => Object.assign(AppState, { currentState: presetCurrentState }))

  it('is used once, then cleared when the player backs out of the game', async () => {
    const store = standInStore(pack, 'klondike')
    const wrapper = shellWrapper(pack, store)

    // A cold launch: the first Home pushes the game the app was left in over itself (a game with
    // nothing to set up goes on alone), and draws nothing while it's still on top.
    await render(<HomeScreen key='launch' />, { wrapper })
    expect(jest.mocked(router.push).mock.calls).toEqual([[playHref]])
    expect(router.replace).not.toHaveBeenCalled()
    expect(mockHero).not.toHaveBeenCalled()

    // Once the game covers it, Home draws its menu beneath, for the way back.
    mockFocused = false
    await screen.rerender(<HomeScreen key='launch' />)
    expect(mockHero).toHaveBeenCalled()
    expect(jest.mocked(router.push).mock.calls).toEqual([[playHref]])

    // The play screen it lands on keeps the game remembered (a relaunch now would resume it again).
    mockParams = { game: 'klondike' }
    await screen.rerender(<PlayRoute key='play' />)
    expect(screen.getByTestId('play-klondike')).toBeTruthy()
    expect(store.getState().lastActiveGame.gameId).toBe('klondike')

    // Backing out unmounts the play screen and forgets the game; a Home mounted after that is the
    // menu, with nothing pushed.
    mockFocused = true
    mockHero.mockClear()
    jest.mocked(router.push).mockClear()
    await screen.rerender(<HomeScreen key='back' />)
    expect(store.getState().lastActiveGame.gameId).toBeNull()
    expect(router.push).not.toHaveBeenCalled()
    expect(mockHero).toHaveBeenCalled()
  })

  it("puts a game's setup screen beneath it", async () => {
    const solitaire = standInGame('solitaire', { resumable: true, seatTwo: undefined })
    const withSetup = standInPack([solitaire], { HeroTitle: mockHero })
    await render(<HomeScreen />, { wrapper: shellWrapper(withSetup, standInStore(withSetup, 'solitaire')) })

    expect(jest.mocked(router.push).mock.calls).toEqual([[{ pathname: '/loadout/[game]', params: { game: 'solitaire' } }], [{ pathname: '/play/[game]', params: { game: 'solitaire' } }]])
  })

  // iOS terminating an app it hasn't suspended yet (swiped away from the app switcher) unmounts the
  // whole tree with the app no longer active: the next launch must still resume the game.
  it.each(['background', 'inactive'] as const)('is kept when the play screen unmounts with the app %s', async (state) => {
    const store = standInStore(pack)
    mockParams = { game: 'klondike' }
    await render(<PlayRoute />, { wrapper: shellWrapper(pack, store) })
    expect(store.getState().lastActiveGame.gameId).toBe('klondike')

    setCurrentState(state)
    await screen.unmount()

    expect(store.getState().lastActiveGame.gameId).toBe('klondike')
  })

  // A pack can replace one play screen with another (CardTastic: a regular game with its Daily Deal), and the stack draws the
  // old one until its transition ends: it unmounts after the new one has set the resume point, which must stay.
  it('is kept when a play screen goes while another is up', async () => {
    const store = standInStore(pack)
    const wrapper = shellWrapper(pack, store)
    mockParams = { game: 'klondike' }
    await render(
      <>
        <PlayRoute key='regular' />
        <PlayRoute key='daily' />
      </>,
      { wrapper }
    )
    await screen.rerender(<PlayRoute key='daily' />)
    expect(store.getState().lastActiveGame.gameId).toBe('klondike')

    // The last one going is backing out
    await screen.unmount()
    expect(store.getState().lastActiveGame.gameId).toBeNull()
  })

  it('is not used again by a second Home', async () => {
    const store = standInStore(pack, 'klondike')
    const wrapper = shellWrapper(pack, store)

    await render(<HomeScreen key='first' />, { wrapper })
    jest.mocked(router.push).mockClear()
    await screen.rerender(<HomeScreen key='second' />)

    expect(router.push).not.toHaveBeenCalled()
    expect(mockHero).toHaveBeenCalled()
  })

  it('remembers a resumable game while its play screen is up, and nothing else', async () => {
    const store = standInStore(pack)
    const wrapper = shellWrapper(pack, store)

    mockParams = { game: 'pong' }
    await render(<PlayRoute key='pong' />, { wrapper })
    expect(store.getState().lastActiveGame.gameId).toBeNull()

    mockParams = { game: 'klondike' }
    await screen.rerender(<PlayRoute key='klondike' />)
    expect(store.getState().lastActiveGame.gameId).toBe('klondike')
  })

  it("drops a saved game the pack doesn't have or that doesn't resume", async () => {
    await renderHome(pack, 'pong')
    await renderHome(pack, 'gone')
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('previews', () => {
  const klondike = standInGame('klondike', { Preview: Preview('klondike') })
  const spider = standInGame('spider', { Preview: Preview('spider') })
  const pong = standInGame('pong')
  const pack = standInPack([klondike, spider, pong], { HeroTitle: mockHero })

  it("draws a game's preview in place of its icon, a frame after Home first paints", async () => {
    await renderHome(pack)

    // The first commit draws no preview, and no icon in a preview's place either.
    expect(screen.queryByTestId('preview-klondike')).toBeNull()
    expect(screen.queryByTestId('icon-klondike')).toBeNull()

    await nextFrame()

    expect(screen.getByTestId('preview-klondike')).toBeTruthy()
    expect(screen.getByTestId('preview-spider')).toBeTruthy()
    expect(screen.queryByTestId('icon-klondike')).toBeNull()
    expect(previewProps).toHaveBeenCalledWith('klondike', expect.objectContaining({ width: ROW_PREVIEW_WIDTH, height: Math.round(ROW_PREVIEW_WIDTH / PREVIEW_ASPECT), p1Color: '#2196f3', p2Color: '#f44336' }))
  })

  it('keeps the icon of a game without one', async () => {
    await renderHome(pack)
    await nextFrame()

    expect(screen.getByTestId('icon-pong')).toBeTruthy()
    expect(screen.queryByTestId('preview-pong')).toBeNull()
  })

  it('lays the games out as a grid beside the hero on a wide screen, and hands the hero its box', async () => {
    mockWindow = PHONE_SIDEWAYS
    await renderHome(pack)
    await nextFrame()

    const layout = computeHomeLayout(PHONE_SIDEWAYS.width, PHONE_SIDEWAYS.height, { top: 0, right: 0, bottom: 0, left: 0 })
    expect(layout.isWide).toBe(true)
    expect(previewProps).toHaveBeenLastCalledWith('spider', expect.objectContaining({ width: layout.previewWidth, height: Math.round(layout.previewWidth / PREVIEW_ASPECT) }))
    expect(lastHeroProps().fit).toEqual(layout.heroFit)
    // A game without a preview still gets a tile, its icon where the preview would be.
    expect(screen.getByTestId('icon-pong')).toBeTruthy()
  })

  it('holds its layout while a screen covers it, and catches up when it shows again', async () => {
    await renderHome(pack)
    expect(lastHeroProps().fit).toBeUndefined()

    // Turned sideways under a game: Home keeps its upright column.
    mockFocused = false
    mockWindow = PHONE_SIDEWAYS
    await screen.rerender(<HomeScreen />)
    expect(lastHeroProps().fit).toBeUndefined()

    // Back on Home: the grid.
    mockFocused = true
    await screen.rerender(<HomeScreen />)
    expect(lastHeroProps().fit).toBeDefined()
  })
})

describe('a pack without previews', () => {
  const games: GameDefinition[] = [standInGame('airhockey'), standInGame('boxhockey')]
  const pack = standInPack(games, { HeroTitle: mockHero })

  it('keeps its column and its icons on a wide screen, and its hero at its own size', async () => {
    mockWindow = PHONE_SIDEWAYS
    await renderHome(pack)
    await nextFrame()

    expect(screen.getByTestId('icon-airhockey')).toBeTruthy()
    expect(screen.getByTestId('icon-boxhockey')).toBeTruthy()
    expect(lastHeroProps()).not.toHaveProperty('fit')
  })
})
