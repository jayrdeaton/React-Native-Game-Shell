import type { AlignResult } from '@tastic/hud/chrome'
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { createRef } from 'react'
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { HomeScreen } from '../screens/HomeScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { GameRulesProps, PackDefinition } from '../types'

// Home's options for a pack for one player at a time (Solitaire's) and the fixes it brought to every
// pack: a game's rules sheet on its tile, seat 1's labels, the pack's own How to Play shown on a first
// launch and from Settings, a Backdrop under a transparent Home drawn in the pack's foreground, every
// profile color through previewColor; and, for every pack, the press-away overlay mounted where a press
// on a row reaches it, the menu closing on a turn, and both scrollers fading at an edge. The real Home
// over the real store and pack; the window, insets, rotation, router, How to Play host, Settings,
// seat colors and seat 1's button are stand-ins (the button opens its menu on a press), and so are
// auto-paper's fading scroller and the corner buttons, which record what they're handed.

let mockWindow = { width: 402, height: 874 }
let mockRotation = 0
const mockGuide = { openFirstTime: jest.fn((_id: string, next: () => void) => next()), openFor: jest.fn(), openPack: jest.fn(), autoShowPack: jest.fn() }
const mockSettings = jest.fn((_props: { onShowHowToPlay?: () => void }) => null)
const mockPicker = jest.fn()
const mockIconColors: Record<string, string> = {}

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ ...mockWindow, scale: 1, fontScale: 1 }) }))
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('@tastic/core', () => ({ ...jest.requireActual('@tastic/core'), useRotation: () => mockRotation }))
jest.mock('@rific/auto-paper', () => {
  const { View: RNView } = require('react-native')
  return { ...jest.requireActual('@rific/auto-paper'), FadingScrollView: ({ children }: { children: unknown }) => <RNView testID='fading-scroller'>{children}</RNView> }
})
jest.mock('@rific/feedback-press', () => {
  const { Pressable: RNPressable } = require('react-native')
  return {
    ...jest.requireActual('@rific/feedback-press'),
    IconButton: ({ accessibilityLabel, iconColor, onPress }: { accessibilityLabel: string; iconColor: string; onPress: () => void }) => {
      mockIconColors[accessibilityLabel] = iconColor
      return <RNPressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
    }
  }
})
jest.mock('expo-router', () => {
  const { Text: RNText } = require('react-native')
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useIsFocused: () => true,
    Redirect: ({ href }: { href: unknown }) => <RNText testID='redirect'>{JSON.stringify(href)}</RNText>
  }
})
jest.mock('../components/GuideHost', () => ({ useGameGuide: () => mockGuide }))
jest.mock('../components/SettingsDialog', () => ({ SettingsDialog: (props: { onShowHowToPlay?: () => void }) => mockSettings(props) }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], lastSelected: { 1: null, 2: null }, selectProfile: jest.fn() }) }))
jest.mock('../hooks/useSeatColors', () => ({ useSeatColors: () => ({ p1Color: '#2196f3', p2Color: '#f44336', handleP1ColorChange: jest.fn() }) }))
jest.mock('@tastic/profile', () => {
  const { Pressable: RNPressable } = require('react-native')
  return {
    ...jest.requireActual('@tastic/profile'),
    ProfilePicker: (props: { idPrefix: string; host: { toggle: (id: string) => void } }) => {
      mockPicker(props)
      return <RNPressable testID='seat-1' onPress={() => props.host.toggle(`${props.idPrefix}-profile`)} />
    }
  }
})

const PHONE = { width: 402, height: 874 }
const PHONE_SIDEWAYS = { width: 874, height: 402 }

const KlondikeRules = ({ onDismiss }: GameRulesProps) => (
  <Pressable testID='klondike-rules' onPress={onDismiss}>
    <Text>Build down in alternating colors.</Text>
  </Pressable>
)
const klondike = standInGame('klondike', { Rules: KlondikeRules, guide: undefined, useLoadout: undefined, seatTwo: undefined })
const spider = standInGame('spider', { guide: undefined })
const pong = standInGame('pong')

const lastPicker = () => mockPicker.mock.lastCall![0]

async function renderHome(overrides: Partial<PackDefinition> = {}, lastActiveGameId: string | null = null) {
  const pack = standInPack([klondike, spider, pong], overrides)
  return render(<HomeScreen />, { wrapper: shellWrapper(pack, standInStore(pack, lastActiveGameId)) })
}

beforeEach(() => {
  mockWindow = PHONE
  mockRotation = 0
  Object.values(mockGuide).forEach((mock) => mock.mockClear())
  mockSettings.mockClear()
  mockPicker.mockClear()
})

describe("a pack's own How to Play on Home", () => {
  it('shows by itself as Home opens, but never over a game a cold launch resumes', async () => {
    await renderHome({ guide: { version: 1, selectVersionSeen: () => 0, markSeen: () => ({ type: 'seen' }), getSteps: () => [] } })
    expect(mockGuide.autoShowPack).toHaveBeenCalledTimes(1)

    mockGuide.autoShowPack.mockClear()
    await renderHome({ guide: { version: 1, selectVersionSeen: () => 0, markSeen: () => ({ type: 'seen' }), getSteps: () => [] }, games: [standInGame('klondike', { resumable: true })] }, 'klondike')
    expect(screen.getByTestId('redirect')).toBeTruthy()
    expect(mockGuide.autoShowPack).not.toHaveBeenCalled()
  })

  it("is Home's Settings How to Play row, where the pack has one", async () => {
    await renderHome({ guide: { version: 1, selectVersionSeen: () => 0, markSeen: () => ({ type: 'seen' }), getSteps: () => [] } })
    expect(mockSettings.mock.lastCall![0].onShowHowToPlay).toBe(mockGuide.openPack)

    await renderHome()
    expect(mockSettings.mock.lastCall![0].onShowHowToPlay).toBeUndefined()
  })
})

describe("a tile's rules button", () => {
  it("opens the game's rules sheet where it has one, inside Home's frame", async () => {
    await renderHome()
    await act(async () => fireEvent.press(screen.getByLabelText('Game klondike rules')))

    expect(screen.getByTestId('klondike-rules')).toBeTruthy()
    expect(mockGuide.openFor).not.toHaveBeenCalled()
    await act(async () => fireEvent.press(screen.getByTestId('klondike-rules')))
    expect(screen.queryByTestId('klondike-rules')).toBeNull()
  })

  it("shows a game's How to Play cards where it has no rules sheet", async () => {
    await renderHome()
    await act(async () => fireEvent.press(screen.getByLabelText('Game pong rules')))

    expect(mockGuide.openFor).toHaveBeenCalledWith('pong')
  })

  it('is left off a game with neither', async () => {
    await renderHome()

    expect(screen.queryByLabelText('Game spider rules')).toBeNull()
  })
})

describe("seat 1's button", () => {
  it('says P1 for a guest by default, and what the pack says where it says', async () => {
    await renderHome()
    expect(lastPicker()).toEqual(expect.objectContaining({ guestLabel: 'P1', nullLabel: undefined }))

    await renderHome({ guestLabel: 'GUEST', nullLabel: 'Guest' })
    expect(lastPicker()).toEqual(expect.objectContaining({ guestLabel: 'GUEST', nullLabel: 'Guest' }))
  })

  it("draws seat 1's color and every swatch through the pack's previewColor", async () => {
    await renderHome({ previewColor: (hex, dark) => `${hex}/${dark ? 'dark' : 'light'}` })

    expect(lastPicker().color).toBe('#2196f3/light')
    expect(lastPicker().colorSection.value).toBe('#2196f3')
    expect(lastPicker().colorSection.previewValue('#ff0000')).toBe('#ff0000/light')
  })

  it('draws the raw color, with no preview, in a pack without one', async () => {
    await renderHome()

    expect(lastPicker().color).toBe('#2196f3')
    expect(lastPicker().colorSection.previewValue).toBeUndefined()
  })
})

describe("seat 1's menu placement", () => {
  // A stand-in placement that says where it was asked to place what.
  const placement = (open: boolean, width: number, height: number): AlignResult => ({ align: 'center', verticalAlign: open ? 'above' : 'below', maxHeight: width + height, measured: true, triggerRef: createRef() })

  it("is hud's own by default", async () => {
    await renderHome()

    expect(lastPicker().alignOverride).toBeUndefined()
  })

  it("is the pack's own where it has one, sized from the menu the picker draws, and told when it opens", async () => {
    const usePickerAlign = jest.fn(placement)
    await renderHome({ usePickerAlign })
    expect(lastPicker().alignOverride.verticalAlign).toBe('below')
    const [, width, height] = usePickerAlign.mock.lastCall!
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)

    await act(async () => fireEvent.press(screen.getByTestId('seat-1')))
    expect(usePickerAlign.mock.lastCall![0]).toBe(true)
    expect(lastPicker().alignOverride.verticalAlign).toBe('above')
  })
})

describe("closing seat 1's menu", () => {
  const dismiss = () => screen.queryByLabelText('Dismiss')
  const zIndexOf = (element: ReturnType<typeof screen.getByLabelText>) => StyleSheet.flatten(element.props.style).zIndex

  it('takes a press on a row: upright, the overlay is in the scroller, over the rows and under the button', async () => {
    await renderHome()
    await act(async () => fireEvent.press(screen.getByTestId('seat-1')))

    const [scroller] = screen.getAllByTestId('fading-scroller')
    const overlay = within(scroller).getByLabelText('Dismiss')
    expect(zIndexOf(overlay)).toBe(5)
    await act(async () => fireEvent.press(overlay))
    expect(dismiss()).toBeNull()
  })

  it("stays the frame's child in the wide layout, outside the grid's scroller", async () => {
    mockWindow = PHONE_SIDEWAYS
    await renderHome({ games: [standInGame('klondike', { Preview: () => <View /> })] })
    await act(async () => fireEvent.press(screen.getByTestId('seat-1')))

    expect(dismiss()).toBeTruthy()
    expect(within(screen.getByTestId('fading-scroller')).queryByLabelText('Dismiss')).toBeNull()
    expect(zIndexOf(dismiss()!)).toBe(5)
  })

  it('happens on every turn of the phone, not only on a switch between layouts', async () => {
    const view = await renderHome()
    await act(async () => fireEvent.press(screen.getByTestId('seat-1')))
    expect(dismiss()).toBeTruthy()

    // A half turn keeps the upright layout, but the button moves under its menu.
    mockRotation = 180
    await act(async () => view.rerender(<HomeScreen />))
    expect(dismiss()).toBeNull()
  })
})

describe("Home's scrollers", () => {
  it('fade out at an edge while there is more past it, upright and wide', async () => {
    await renderHome()
    expect(screen.getAllByTestId('fading-scroller')).toHaveLength(1)

    mockWindow = PHONE_SIDEWAYS
    await renderHome({ games: [standInGame('klondike', { Preview: () => <View /> })] })
    expect(screen.getAllByTestId('fading-scroller')).toHaveLength(1)
  })
})

describe("a pack's Backdrop and foreground", () => {
  const rootBackground = () => StyleSheet.flatten((screen.toJSON() as unknown as { props: { style: StyleProp<ViewStyle> } }).props.style).backgroundColor
  const iconColor = (label: string) => mockIconColors[label]

  it('leave Home opaque, in black or white, with a plain button, by default', async () => {
    await renderHome()

    expect(rootBackground()).toBe('#FFFFFF')
    expect(iconColor('Settings')).toBe('#000000')
    expect(lastPicker().triggerStyle).toBeUndefined()
  })

  it('draw Home transparent over the backdrop, in the foreground, with the button on a surface', async () => {
    await renderHome({ Backdrop: () => null, foreground: '#F5F1E6' })

    expect(rootBackground()).toBe('transparent')
    expect(iconColor('Settings')).toBe('#F5F1E6')
    expect(iconColor('Stats & Achievements')).toBe('#F5F1E6')
    expect(StyleSheet.flatten(lastPicker().triggerStyle)).toEqual(expect.objectContaining({ borderRadius: 999, backgroundColor: expect.any(String) }))
  })
})
