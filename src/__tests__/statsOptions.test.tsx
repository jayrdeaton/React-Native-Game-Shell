import type { AlignResult } from '@tastic/hud/chrome'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { StatsScreen } from '../screens/StatsScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import { GUEST_PLAYER_ID, type PackDefinition, type PackStatsSectionsProps } from '../types'

// The stats screen's options for a pack for one player at a time (Solitaire's) and the fixes it
// brought to every pack: a guest's own stats and the screen opening on seat 1's player, one achievement
// list across the pack's games, tabs of the pack's own, a Reset that follows the player picker, game
// names left off where the sections name their game, the screen drawn over a Backdrop; and, for every
// pack, a press anywhere closing a picker's menu and the column capped in the wide layout. The real
// screen over the real store and pack; hud's stats screen and turned frame, the profiles and the
// pickers record what they're handed (a picker opens its menu on a press).

let mockProfiles: { id: string; name: string; color: string; tag: string; createdAt: number; updatedAt: number }[] = []
let mockSeatOne: string | null = null
const mockStatsScreen = jest.fn()
const mockFrame = jest.fn()
const mockPicker = jest.fn()
const mockTabs = jest.fn()

jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))
jest.mock('@tastic/hud/chrome', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/hud/chrome'),
    BaseStatsScreen: ({ children, ...props }: { children: ReactNode }) => {
      mockStatsScreen(props)
      return <RNView testID='stats'>{children}</RNView>
    },
    RotatedFrame: ({ children, ...props }: { children: ReactNode }) => {
      mockFrame(props)
      return <RNView testID='frame'>{children}</RNView>
    }
  }
})
// The tabs record their buttons and draw each as a pressable label.
jest.mock('react-native-paper', () => {
  const { Pressable: RNPressable, Text: RNText, View: RNView } = require('react-native')
  return {
    ...jest.requireActual('react-native-paper'),
    SegmentedButtons: (props: { buttons: { value: string; label: string }[]; onValueChange: (value: string) => void }) => {
      mockTabs(props)
      return (
        <RNView>
          {props.buttons.map((button) => (
            <RNPressable key={button.value} onPress={() => props.onValueChange(button.value)}>
              <RNText>{button.label}</RNText>
            </RNPressable>
          ))}
        </RNView>
      )
    }
  }
})
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: mockProfiles, lastSelected: { 1: mockSeatOne, 2: null } }) }))
jest.mock('@tastic/profile', () => {
  const { Pressable: RNPressable } = require('react-native')
  return {
    ...jest.requireActual('@tastic/profile'),
    OptionPicker: (props: { id: string; host: { toggle: (id: string) => void } }) => {
      mockPicker(props)
      return <RNPressable testID={props.id} onPress={() => props.host.toggle(props.id)} />
    }
  }
})

const ADA = { id: 'ada', name: 'Ada', color: '#ff0000', tag: 'ADA', createdAt: 0, updatedAt: 0 }

// Each game's sections and achievement list say whose they are.
const gameSections = (id: string) =>
  function Sections({ profileId }: { profileId: string | null }) {
    return <Text testID={`stats-${id}`}>{String(profileId)}</Text>
  }
const games = [standInGame('klondike', { StatsSections: gameSections('klondike'), AchievementList: undefined, resetStats: undefined }), standInGame('spider', { StatsSections: gameSections('spider'), AchievementList: undefined, resetStats: undefined })]

const lastPicker = (id: string) =>
  mockPicker.mock.calls
    .map(([props]) => props)
    .filter((props) => props.id === id)
    .pop()
const lastStatsScreen = () => mockStatsScreen.mock.lastCall![0]
const pick = async (pickerId: string, value: string) => act(async () => lastPicker(pickerId).onChange(value))

async function renderStats(overrides: Partial<PackDefinition> = {}, pack = standInPack(games, overrides)) {
  await render(<StatsScreen />, { wrapper: shellWrapper(pack, standInStore(pack)) })
}

beforeEach(() => {
  mockProfiles = [ADA]
  mockSeatOne = null
  mockStatsScreen.mockClear()
  mockFrame.mockClear()
  mockPicker.mockClear()
  mockTabs.mockClear()
})

describe("a guest's own stats (guestStats)", () => {
  it('offer Guest between Everyone and the profiles, and hand the sections the guest id', async () => {
    await renderStats({ guestStats: true })

    expect(lastPicker('stats-player').options.map((option: { value: string }) => option.value)).toEqual(['__everyone__', GUEST_PLAYER_ID, 'ada'])
    expect(screen.getByTestId('stats-klondike')).toHaveTextContent(GUEST_PLAYER_ID)
  })

  it("open the screen on seat 1's profile", async () => {
    mockSeatOne = 'ada'
    await renderStats({ guestStats: true })

    expect(lastPicker('stats-player').value).toBe('ada')
    expect(screen.getByTestId('stats-klondike')).toHaveTextContent('ada')
  })

  it('show Everyone, with no picker, while there is no profile', async () => {
    mockProfiles = []
    await renderStats({ guestStats: true })

    expect(lastPicker('stats-player')).toBeUndefined()
    expect(screen.getByTestId('stats-klondike')).toHaveTextContent('null')
  })

  it('are left out by default: no Guest, and the screen opens on Everyone', async () => {
    mockSeatOne = 'ada'
    await renderStats()

    expect(lastPicker('stats-player').options.map((option: { value: string }) => option.value)).toEqual(['__everyone__', 'ada'])
    expect(screen.getByTestId('stats-klondike')).toHaveTextContent('null')
  })
})

describe("the pack's own achievement list", () => {
  const AchievementList = ({ profileId }: { profileId: string | null }) => <Text testID='pack-achievements'>{String(profileId)}</Text>

  it('is the Achievements tab, for the player picked, with no game picker', async () => {
    await renderStats({ AchievementList })
    await pick('stats-player', 'ada')
    await act(async () => fireEvent.press(screen.getByText('Achievements')))

    expect(screen.getByTestId('pack-achievements')).toHaveTextContent('ada')
    expect(screen.queryByTestId('stats-game')).toBeNull()
    expect(screen.queryByTestId('stats-klondike')).toBeNull()
  })
})

describe("the pack's own tabs", () => {
  const records = jest.fn((_props: PackStatsSectionsProps) => <View testID='records' />)

  it('sit between Stats and Achievements, label-wide with no icons, and get both filters', async () => {
    await renderStats({ statsTabs: [{ value: 'records', label: 'Records', Content: records }] })
    await act(async () => fireEvent.press(screen.getByText('Records')))
    await pick('stats-game', 'spider')

    expect(screen.getByTestId('records')).toBeTruthy()
    expect(records.mock.lastCall![0]).toEqual({ profileId: null, gameId: 'spider' })
    expect(lastStatsScreen().title).toBe('Records')
    expect(screen.queryByTestId('stats-klondike')).toBeNull()
    const buttons = mockTabs.mock.lastCall![0].buttons
    expect(buttons.map((button: { value: string }) => button.value)).toEqual(['stats', 'records', 'achievements'])
    for (const button of buttons) {
      expect(button.icon).toBeUndefined()
      expect(button.style).toEqual(expect.objectContaining({ flexBasis: 'auto', flexGrow: 1 }))
    }
  })

  it('leave a pack without any with its two tabs, icons and all', async () => {
    await renderStats()

    expect(mockTabs.mock.lastCall![0].buttons).toEqual([expect.objectContaining({ value: 'stats', icon: 'chart-box-outline' }), expect.objectContaining({ value: 'achievements', icon: 'trophy-outline' })])
  })
})

describe("the pack's own Reset", () => {
  const reset = jest.fn()
  const labels = (name: string | null) => ({ label: name ? `Reset ${name}'s Stats` : 'Reset All Stats', title: name ? `Reset ${name}?` : 'Reset Everything?', body: name ? `Erases ${name}'s stats.` : 'Erases everything.' })
  const pack = { guestStats: true, resetStats: { useReset: () => reset, labels } }

  beforeEach(() => reset.mockClear())

  it('follows the player picker: one player by name, Guest, or everyone', async () => {
    await renderStats(pack)
    expect(lastStatsScreen()).toEqual(expect.objectContaining({ resetLabel: "Reset Guest's Stats", resetConfirmTitle: 'Reset Guest?' }))
    await act(async () => lastStatsScreen().onReset())
    expect(reset).toHaveBeenLastCalledWith(GUEST_PLAYER_ID)

    await pick('stats-player', 'ada')
    expect(lastStatsScreen().resetLabel).toBe("Reset Ada's Stats")
    await act(async () => lastStatsScreen().onReset())
    expect(reset).toHaveBeenLastCalledWith('ada')

    await pick('stats-player', '__everyone__')
    expect(lastStatsScreen()).toEqual(expect.objectContaining({ resetLabel: 'Reset All Stats', resetConfirmBody: 'Erases everything.' }))
    await act(async () => lastStatsScreen().onReset())
    expect(reset).toHaveBeenLastCalledWith(null)
  })

  it("is each shown game's own by default, skipping a game without one", async () => {
    const resetKlondike = jest.fn(() => ({ type: 'klondike/reset' }))
    await renderStats({}, standInPack([standInGame('klondike', { resetStats: resetKlondike }), standInGame('spider', { resetStats: undefined })]))

    expect(lastStatsScreen().resetLabel).toBe('Reset All Stats')
    await act(async () => lastStatsScreen().onReset())
    expect(resetKlondike).toHaveBeenCalledTimes(1)
  })
})

describe("the pickers' menu placement", () => {
  const placement = (open: boolean): AlignResult => ({ align: 'center', verticalAlign: open ? 'above' : 'below', maxHeight: 300, measured: true, triggerRef: createRef() })

  it("is the pack's own where it has one, each picker told when its own menu opens", async () => {
    await renderStats({ usePickerAlign: jest.fn(placement) })
    expect(lastPicker('stats-player').alignOverride.verticalAlign).toBe('below')

    await act(async () => fireEvent.press(screen.getByTestId('stats-game')))
    expect(lastPicker('stats-game').alignOverride.verticalAlign).toBe('above')
    expect(lastPicker('stats-player').alignOverride.verticalAlign).toBe('below')
  })

  it("is hud's own by default", async () => {
    await renderStats()

    expect(lastPicker('stats-game').alignOverride).toBeUndefined()
  })
})

describe('game names on All Games', () => {
  it("head each game's sections by default, and are left out with statsGameTitles false", async () => {
    await renderStats()
    expect(screen.getByText('Game klondike')).toBeTruthy()

    await renderStats({ statsGameTitles: false })
    expect(screen.queryByText('Game klondike')).toBeNull()
    expect(screen.getByTestId('stats-klondike')).toBeTruthy()
  })
})

describe("closing a picker's menu", () => {
  it('takes a press anywhere nothing else takes, the header included', async () => {
    await renderStats()
    const pressAway = screen.getByTestId('stats-press-away')
    expect(pressAway.props.onStartShouldSetResponder()).toBe(false)

    await act(async () => fireEvent.press(screen.getByTestId('stats-game')))
    expect(screen.getByLabelText('Dismiss')).toBeTruthy()
    expect(pressAway.props.onStartShouldSetResponder()).toBe(true)

    await act(async () => pressAway.props.onResponderRelease())
    expect(screen.queryByLabelText('Dismiss')).toBeNull()
  })
})

describe('the screen', () => {
  it('turns with the phone, its reset confirm in the frame and its column capped in the wide layout', async () => {
    await renderStats()

    expect(mockFrame).toHaveBeenLastCalledWith(expect.objectContaining({ rotatedSafeArea: true, portalHost: true, maxContentWidth: 640 }))
    expect(lastStatsScreen().rotation).toBe(0)
  })

  it("draws over the pack's Backdrop in its foreground, its tabs and pickers on a surface", async () => {
    await renderStats({ Backdrop: () => null, foreground: '#F5F1E6' })

    expect(lastStatsScreen()).toEqual(expect.objectContaining({ bg: 'transparent', fg: '#F5F1E6' }))
    expect(StyleSheet.flatten(lastPicker('stats-game').triggerStyle)).toEqual(expect.objectContaining({ borderRadius: 999, backgroundColor: expect.any(String) }))
  })

  it('keeps the opaque page and plain pickers by default', async () => {
    await renderStats()

    expect(lastStatsScreen().bg).toBeUndefined()
    expect(lastPicker('stats-game').triggerStyle).toBeUndefined()
  })
})
