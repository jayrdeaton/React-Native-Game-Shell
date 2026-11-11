import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { ScrollView, StyleSheet, View } from 'react-native'

import { HomeScreen } from '../screens/HomeScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { HomeTab, PackDefinition, PackGameDefinition } from '../types'

// Home's tabs (PackDefinition.homeTabs, Solitaire's Solitaire | Two Player): one tab's games at a time
// from a switch over the rows, or over the grid on a wide screen; none in a pack without them. The real
// Home over the real store and pack, with the window, insets, focus, router, How to Play host, Settings,
// seat colors and seat 1's button stood in, and Paper's switch a recording stand-in that presses by
// label. Auto-paper's fading scroller is the real one, over React Native's mocked ScrollView, whose
// scrollTo every instance shares.

let mockWindow = { width: 402, height: 874 }
let mockFocused = true
const mockTabs = jest.fn()

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ ...mockWindow, scale: 1, fontScale: 1 }) }))
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, useIsFocused: () => mockFocused, Redirect: () => null }))
jest.mock('../components/GuideHost', () => ({ useGameGuide: () => ({ openFirstTime: jest.fn(), openFor: jest.fn(), openPack: jest.fn(), autoShowPack: jest.fn() }) }))
jest.mock('../components/SettingsDialog', () => ({ SettingsDialog: () => null }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], lastSelected: { 1: null, 2: null }, selectProfile: jest.fn() }) }))
jest.mock('../hooks/useSeatColors', () => ({ useSeatColors: () => ({ p1Color: '#2196f3', p2Color: '#f44336', handleP1ColorChange: jest.fn() }) }))
jest.mock('@tastic/profile', () => ({ ...jest.requireActual('@tastic/profile'), ProfilePicker: () => null }))
jest.mock('react-native-paper', () => {
  const { Pressable: RNPressable, Text: RNText, View: RNView } = require('react-native')
  return {
    ...jest.requireActual('react-native-paper'),
    SegmentedButtons: (props: { value: string; buttons: { value: string; label: string }[]; onValueChange: (value: string) => void }) => {
      mockTabs(props)
      return (
        <RNView testID='home-tabs'>
          {props.buttons.map((button) => (
            <RNPressable key={button.value} accessibilityRole='tab' onPress={() => props.onValueChange(button.value)}>
              <RNText>{button.label}</RNText>
            </RNPressable>
          ))}
        </RNView>
      )
    }
  }
})

const PHONE = { width: 402, height: 874 }
const PHONE_SIDEWAYS = { width: 874, height: 402 }

const preview = () => <View />
// Two games for one player and one for two, as Solitaire's; the tiled pack's have previews.
const klondike = standInGame('klondike', { guide: undefined, useLoadout: undefined, seatTwo: undefined })
const spider = standInGame('spider', { guide: undefined, useLoadout: undefined, seatTwo: undefined })
const ratslap = standInGame('ratslap')
const GAMES = [klondike, ratslap, spider]
const TILED_GAMES = GAMES.map((game) => ({ ...game, Preview: preview }))
const TABS: readonly HomeTab[] = [
  { label: 'Solitaire', includes: (game) => !game.seatTwo },
  { label: 'Two Player', includes: (game) => !!game.seatTwo }
]

async function renderHome(overrides: Partial<PackDefinition> = {}, games: readonly PackGameDefinition[] = GAMES) {
  const pack = standInPack(games, overrides)
  return render(<HomeScreen />, { wrapper: shellWrapper(pack, standInStore(pack)) })
}

// The games on screen, in order: a hidden one is out of the layout and out of a screen reader's way.
const shown = () => screen.queryAllByRole('button').flatMap((button) => (/^Game \w+$/.test(button.props.accessibilityLabel) ? [button.props.accessibilityLabel] : []))
const lastTabs = () => mockTabs.mock.lastCall![0]
const pressTab = (label: string) => act(async () => fireEvent.press(screen.getByText(label)))

beforeEach(() => {
  mockWindow = PHONE
  mockFocused = true
  mockTabs.mockClear()
})

describe('a pack without tabs (PuckTastic, DuelTastic)', () => {
  it('shows every game with no switch', async () => {
    await renderHome()

    expect(screen.queryByTestId('home-tabs')).toBeNull()
    expect(shown()).toEqual(['Game klondike', 'Game ratslap', 'Game spider'])
  })

  it('and so does a pack with a single tab', async () => {
    await renderHome({ homeTabs: TABS.slice(0, 1) })

    expect(screen.queryByTestId('home-tabs')).toBeNull()
    expect(shown()).toEqual(['Game klondike', 'Game ratslap', 'Game spider'])
  })
})

describe("a pack's tabs", () => {
  it("open on the first, showing only its games, in the pack's order", async () => {
    await renderHome({ homeTabs: TABS })

    expect(lastTabs().buttons.map((button: { label: string }) => button.label)).toEqual(['Solitaire', 'Two Player'])
    expect(lastTabs().value).toBe('Solitaire')
    expect(shown()).toEqual(['Game klondike', 'Game spider'])
  })

  it("show another tab's games once it's pressed", async () => {
    await renderHome({ homeTabs: TABS })
    await pressTab('Two Player')

    expect(lastTabs().value).toBe('Two Player')
    expect(shown()).toEqual(['Game ratslap'])

    await pressTab('Solitaire')
    expect(shown()).toEqual(['Game klondike', 'Game spider'])
  })

  it("sit on the theme's surface over a backdrop, as the stats screen's do, and plain without one", async () => {
    const background = () => StyleSheet.flatten(lastTabs().style).backgroundColor

    await renderHome({ homeTabs: TABS })
    expect(background()).toBeUndefined()

    await renderHome({ homeTabs: TABS, Backdrop: () => null })
    expect(background()).toEqual(expect.any(String))
  })

  it('round their ends at 19pt, so iOS draws the end segments with no line across them, and so does the surface behind', async () => {
    await renderHome({ homeTabs: TABS, Backdrop: () => null })

    expect(lastTabs().theme).toEqual({ roundness: 3.8 })
    expect(StyleSheet.flatten(lastTabs().style).borderRadius).toBe(19)
  })

  it('sit over the grid on a wide screen, where they pick the tiles shown', async () => {
    mockWindow = PHONE_SIDEWAYS
    await renderHome({ homeTabs: TABS }, TILED_GAMES)

    expect(screen.getByTestId('home-tabs')).toBeTruthy()
    expect(shown()).toEqual(['Game klondike', 'Game spider'])
    await pressTab('Two Player')
    expect(shown()).toEqual(['Game ratslap'])
  })

  it('keep the tab picked while Home is covered and across a turn between the column and the grid', async () => {
    const view = await renderHome({ homeTabs: TABS }, TILED_GAMES)
    await pressTab('Two Player')

    mockFocused = false
    await act(async () => view.rerender(<HomeScreen />))
    mockFocused = true
    mockWindow = PHONE_SIDEWAYS
    await act(async () => view.rerender(<HomeScreen />))

    expect(lastTabs().value).toBe('Two Player')
    expect(shown()).toEqual(['Game ratslap'])
  })
})

describe('a switch to a shorter tab while scrolled down', () => {
  // The column's scroller: the host element above the tabs (or a game, with none) whose props carry a
  // content-size handler.
  const scroller = () => {
    let node = screen.queryByTestId('home-tabs') ?? screen.getByLabelText('Game klondike')
    while (!node.props.onContentSizeChange) node = node.parent!
    return node
  }
  const scrollTo = ScrollView.prototype.scrollTo as jest.Mock

  beforeEach(() => scrollTo.mockClear())

  it("pulls the offset back in to the shorter content's end (iOS leaves it past the end)", async () => {
    await renderHome({ homeTabs: TABS })
    await act(async () => {
      scroller().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } } })
      scroller().props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 500 } } })
    })

    await pressTab('Two Player')
    await act(async () => scroller().props.onContentSizeChange(402, 1000))

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ y: 126, animated: false })
  })

  it("leaves an offset within the content's end where it is", async () => {
    await renderHome({ homeTabs: TABS })
    await act(async () => {
      scroller().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } } })
      scroller().props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 100 } } })
    })

    await pressTab('Two Player')
    await act(async () => scroller().props.onContentSizeChange(402, 1000))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('is left alone in a pack without tabs, whose content never shrinks', async () => {
    await renderHome()
    await act(async () => {
      scroller().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } } })
      scroller().props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 500 } } })
      scroller().props.onContentSizeChange(402, 1000)
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
