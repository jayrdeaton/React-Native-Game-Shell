import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { SettingsDialog } from '../components/SettingsDialog'
import { StatsScreen } from '../screens/StatsScreen'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { PackDefinition, PackStatsSectionsProps } from '../types'

// What a pack adds to every game's screens: its own Settings sections (PackDefinition.SettingsSections,
// under the rows a play screen adds itself) and its own section on the stats screen
// (PackDefinition.StatsSections). hud's Settings sheet and stats page are stand-ins that draw what
// they're handed; @tastic/profile's filter buttons record their props so a test can pick a filter.

jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))
jest.mock('@rific/toaster', () => ({ ...jest.requireActual('@rific/toaster'), useUpdateErrorToast: () => () => {} }))
jest.mock('@tastic/hud', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/hud'),
    BaseSettingsDialog: ({ children }: { children: ReactNode }) => <RNView testID='settings'>{children}</RNView>,
    BaseStatsScreen: ({ children }: { children: ReactNode }) => <RNView testID='stats'>{children}</RNView>
  }
})
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [{ id: 'ada', name: 'Ada', color: '#ff0000', tag: 'ADA', createdAt: 0, updatedAt: 0 }] }) }))
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

// Every test id in the tree, in the order it's drawn.
function testIds(): string[] {
  const ids: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    const { props, children } = node as { props?: { testID?: string }; children?: unknown }
    if (props?.testID) ids.push(props.testID)
    walk(children)
  }
  walk(screen.toJSON())
  return ids
}

async function renderIn(pack: PackDefinition, ui: ReactNode) {
  await render(<>{ui}</>, { wrapper: shellWrapper(pack, standInStore(pack)) })
}

describe("the pack's Settings sections", () => {
  const PackSections = () => <View testID='pack-sections' />

  it('follow the rows a play screen adds, in every Settings dialog', async () => {
    const pack = standInPack([standInGame('klondike')], { SettingsSections: PackSections })
    await renderIn(
      pack,
      <SettingsDialog visible onDismiss={() => {}}>
        <View testID='game-rows' />
      </SettingsDialog>
    )

    expect(testIds()).toEqual(['settings', 'game-rows', 'pack-sections'])
  })

  it('show in a Settings dialog with no rows of a play screen (Home, a loadout)', async () => {
    const pack = standInPack([standInGame('klondike')], { SettingsSections: PackSections })
    await renderIn(pack, <SettingsDialog visible onDismiss={() => {}} />)

    expect(testIds()).toEqual(['settings', 'pack-sections'])
  })

  it("leave a pack without any (PuckTastic's, DuelTastic's) with the shell's rows alone", async () => {
    await renderIn(standInPack([standInGame('pong')]), <SettingsDialog visible onDismiss={() => {}} />)

    expect(testIds()).toEqual(['settings'])
  })
})

describe("the pack's stats section", () => {
  const packStats = jest.fn((_props: PackStatsSectionsProps) => <View testID='pack-stats' />)
  const gameStats = (id: string) => () => <Text testID={`stats-${id}`}>{id}</Text>
  const pack = standInPack([standInGame('klondike', { StatsSections: gameStats('klondike') }), standInGame('spider', { StatsSections: gameStats('spider') })], { StatsSections: packStats })

  // The filter's latest props: its onChange is the screen's current one.
  const pick = async (pickerId: string, value: string) => {
    const picker = mockOptionPicker.mock.calls
      .map(([props]) => props)
      .filter((props) => props.id === pickerId)
      .pop()
    await act(async () => picker.onChange(value))
  }

  beforeEach(() => {
    packStats.mockClear()
    mockOptionPicker.mockClear()
  })

  it("comes first on the Stats tab, across every game and player, above each game's own", async () => {
    await renderIn(pack, <StatsScreen />)

    expect(packStats.mock.lastCall?.[0]).toEqual({ profileId: null, gameId: null })
    const ids = testIds()
    expect(ids.indexOf('pack-stats')).toBeLessThan(ids.indexOf('stats-klondike'))
    expect(ids).toContain('stats-spider')
  })

  it("follows the screen's player and game filters", async () => {
    await renderIn(pack, <StatsScreen />)

    await pick('stats-game', 'spider')
    expect(packStats.mock.lastCall?.[0]).toEqual({ profileId: null, gameId: 'spider' })

    await pick('stats-player', 'ada')
    expect(packStats.mock.lastCall?.[0]).toEqual({ profileId: 'ada', gameId: 'spider' })
  })

  it('stays off the Achievements tab', async () => {
    await renderIn(pack, <StatsScreen />)
    await act(async () => fireEvent.press(screen.getByText('Achievements')))

    expect(screen.queryByTestId('pack-stats')).toBeNull()
  })
})
