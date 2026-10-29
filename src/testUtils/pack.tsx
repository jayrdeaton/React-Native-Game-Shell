import { configureStore } from '@reduxjs/toolkit'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Provider } from 'react-redux'

import { LastActiveGameProvider } from '../hooks/useLastActiveGame'
import { PackProvider } from '../PackContext'
import lastActiveGame from '../redux/lastActiveGameSlice'
import { createShellReducers } from '../redux/shellState'
import type { GameDefinition, GameLoadout, GuidelessGameDefinition, PackDefinition, PackGameDefinition } from '../types'

// Stand-ins for the screens' tests: a game and a pack with every required field, which a test
// overrides with what it's about (a game with no seats, no loadout, a preview, a resume).

// A loadout with nothing in it but its round settings.
export const STAND_IN_LOADOUT: GameLoadout = {
  roundSettings: { speed: 'normal' },
  options: () => null,
  optionIds: [],
  randomize: () => {},
  reset: () => {},
  seatControl: () => undefined,
  cpuDifficulty: { value: 'normal', options: [{ value: 'normal', label: 'Normal', icon: 'robot' }], onChange: () => {} }
}

// A two-seat game like PuckTastic's and DuelTastic's: a loadout, the CPU or a person in seat 2.
// Its icon and play screen say whose they are, by test id.
// Overridden with `guide: undefined`, it's a game the pack's own guide teaches.
export function standInGame(id: string, overrides: Partial<Omit<GameDefinition, 'guide'>> & { guide: undefined }): GuidelessGameDefinition
export function standInGame(id: string, overrides?: Partial<GameDefinition>): GameDefinition
export function standInGame(id: string, overrides: Partial<GameDefinition> = {}): PackGameDefinition {
  return {
    id,
    title: `Game ${id}`,
    blurb: `What ${id} is.`,
    icon: () => <View testID={`icon-${id}`} />,
    seatTwo: ['cpu', 'person'],
    twoPlayerSeats: { faceToFaceOnWeb: true, followUpsideDown: false },
    reducers: {},
    Provider: ({ children }) => children,
    useLoadout: () => STAND_IN_LOADOUT,
    PlayScreen: () => <Text testID={`play-${id}`}>{id}</Text>,
    StatsSections: () => null,
    AchievementList: () => null,
    resetStats: () => ({ type: 'test/resetStats' }),
    guide: { version: 1, selectVersionSeen: () => 1, markSeen: () => ({ type: 'test/markSeen' }), selectInput: () => ({}), getSteps: () => [] },
    ...overrides
  }
}

export function standInPack(games: readonly PackGameDefinition[], overrides: Partial<PackDefinition> = {}): PackDefinition {
  return {
    name: 'TestTastic',
    wordmark: ['Test', 'Tastic'],
    colorCaption: 'TestTastic only',
    games,
    seatColors: { 1: '#2196f3', 2: '#f44336' },
    HeroTitle: () => null,
    otaVersion: 1,
    ...overrides
  }
}

// The shell's own keys (and the resume key every pack with a resumable game has), unpersisted.
export function standInStore(pack: PackDefinition, lastActiveGameId: string | null = null) {
  return configureStore({
    reducer: { ...createShellReducers(pack), lastActiveGame, ...pack.reducers },
    preloadedState: { lastActiveGame: { gameId: lastActiveGameId } }
  })
}

export type StandInStore = ReturnType<typeof standInStore>

// What RootLayout puts around every screen that the screens under test read: the store, the pack and
// the resume point.
export function shellWrapper(pack: PackDefinition, store: StandInStore) {
  return function ShellWrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <PackProvider pack={pack}>
          <LastActiveGameProvider>{children}</LastActiveGameProvider>
        </PackProvider>
      </Provider>
    )
  }
}
