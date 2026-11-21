import { router, Stack } from 'expo-router'
import { act, renderRouter, screen } from 'expo-router/testing-library'
import { AppState, BackHandler, Text } from 'react-native'

import { safeBack } from '../navigation'
import { PlayRoute } from '../screens/GameRoute'
import { HomeScreen } from '../screens/HomeScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { PackDefinition } from '../types'

// A cold launch back into a resumable game, under expo-router's real in-memory router: the stack it
// leaves is what decides which way every back slides on iOS. A pop slides back. A replace slides in as a
// push unless the screen says otherwise, so a resume that replaced Home (a Redirect) left the game alone on
// the stack, and its back to the setup screen and that one's back to Home each had to replace the screen
// and came in from the right, as if going forward (and Android's back closed the app). Home and the play
// route are the real ones; Home's heavier neighbours are stood in for, as in homeScreen.test.tsx.

jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('../components/GuideHost', () => ({ useGameGuide: () => ({ openFirstTime: jest.fn(), openFor: jest.fn(), openPack: jest.fn(), autoShowPack: jest.fn() }) }))
jest.mock('../components/SettingsDialog', () => ({ SettingsDialog: () => null }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], lastSelected: { 1: null, 2: null }, selectProfile: jest.fn() }) }))
jest.mock('../hooks/useSeatColors', () => ({ useSeatColors: () => ({ p1Color: '#2196f3', p2Color: '#f44336', handleP1ColorChange: jest.fn() }) }))
jest.mock('@tastic/profile', () => ({ ...jest.requireActual('@tastic/profile'), ProfilePicker: () => null }))

// Android's back, as the router's container hears it (React Native's BackHandler is a no-op off Android).
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]
const backListeners: BackListener[] = []
jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
  backListeners.push(handler)
  return { remove: () => backListeners.splice(backListeners.indexOf(handler), 1) }
})
async function pressAndroidBack() {
  await act(async () => {
    for (const handler of [...backListeners].reverse()) if (handler({} as Parameters<BackListener>[0])) return
  })
}

const HeroTitle = () => <Text>Home menu</Text>
const solitaire = standInGame('solitaire', { resumable: true, seatTwo: undefined })
const bare = standInGame('bare', { resumable: true, seatTwo: undefined, useLoadout: undefined })

const ROUTES = {
  _layout: () => <Stack />,
  index: HomeScreen,
  'loadout/[game]': () => <Text>Setup screen</Text>,
  'play/[game]': PlayRoute
}

async function launch(lastActiveGameId: string, overrides: Partial<PackDefinition> = {}) {
  const pack = standInPack([solitaire, bare], { HeroTitle, ...overrides })
  const store = standInStore(pack, lastActiveGameId)
  const rendered = await renderRouter(ROUTES, { initialUrl: '/', wrapper: shellWrapper(pack, store) })
  return { ...rendered, store }
}

type RouteState = { name: string; key: string; state?: { routes: RouteState[] } }

// The root stack (expo-router keeps it under its own __root route) as route names and keys, bottom first.
function stack(rendered: Awaited<ReturnType<typeof launch>>) {
  let routes = rendered.getRouterState()!.routes as RouteState[]
  while (routes.length === 1 && routes[0].name === '__root' && routes[0].state) routes = routes[0].state.routes
  return routes.map((route) => ({ name: route.name, key: route.key }))
}

// The react-native preset's AppState mock has a jest.fn for currentState; the play route reads it as it
// unmounts, and only forgets the game while the app is in use.
const presetCurrentState = AppState.currentState
afterAll(() => Object.assign(AppState, { currentState: presetCurrentState }))

let warn: jest.SpyInstance
let error: jest.SpyInstance
beforeEach(() => {
  Object.assign(AppState, { currentState: 'active' })
  backListeners.length = 0
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  error = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  // A navigation the router couldn't handle (a GO_BACK with nothing beneath) warns or errors.
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  warn.mockRestore()
  error.mockRestore()
})

describe('a cold launch back into a game', () => {
  it('lands on the game with its setup screen and Home beneath it', async () => {
    const rendered = await launch('solitaire')

    expect(rendered.getPathname()).toBe('/play/solitaire')
    expect(stack(rendered).map((route) => route.name)).toEqual(['index', 'loadout/[game]', 'play/[game]'])
    expect(screen.getByTestId('play-solitaire')).toBeTruthy()
    // Home drew its menu beneath once the game covered it, ready for the way back.
    expect(screen.getByText('Home menu', { includeHiddenElements: true })).toBeTruthy()
  })

  it('pops back to the setup screen and then to the same Home, each a pop and never a replace', async () => {
    const rendered = await launch('solitaire')
    const [home, setup] = stack(rendered)

    // The game's own back (CardTastic's back arrow is this dismissTo).
    await act(async () => router.dismissTo({ pathname: '/loadout/[game]', params: { game: 'solitaire' } }))
    expect(rendered.getPathname()).toBe('/loadout/solitaire')
    expect(stack(rendered)).toEqual([home, setup])
    // Backing out of the game forgot it: a relaunch now opens on Home.
    expect(rendered.store.getState().lastActiveGame.gameId).toBeNull()

    // The setup screen's back.
    await act(async () => safeBack())
    expect(rendered.getPathname()).toBe('/')
    expect(stack(rendered)).toEqual([home])
    expect(screen.getByText('Home menu')).toBeTruthy()
  })

  it("takes Android's back to the setup screen, then Home, instead of closing the app", async () => {
    const rendered = await launch('solitaire')

    await pressAndroidBack()
    expect(rendered.getPathname()).toBe('/loadout/solitaire')
    await pressAndroidBack()
    expect(rendered.getPathname()).toBe('/')
  })

  it('puts a game with nothing to set up straight over Home', async () => {
    const rendered = await launch('bare')

    expect(stack(rendered).map((route) => route.name)).toEqual(['index', 'play/[game]'])
    const [home] = stack(rendered)
    await act(async () => safeBack())
    expect(stack(rendered)).toEqual([home])
  })

  it('goes where the pack says, with the setup screen still beneath it', async () => {
    const rendered = await launch('solitaire', { resumeHref: (game) => ({ pathname: '/play/[game]', params: { game, daily: '2026-11-21' } }) as never })

    expect(rendered.getPathnameWithParams()).toBe('/play/solitaire?daily=2026-11-21')
    expect(stack(rendered).map((route) => route.name)).toEqual(['index', 'loadout/[game]', 'play/[game]'])
  })
})
