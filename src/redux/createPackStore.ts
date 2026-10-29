import AsyncStorage from '@react-native-async-storage/async-storage'
import { combineReducers, configureStore, type Middleware, type Reducer } from '@reduxjs/toolkit'
import { FLUSH, PAUSE, PERSIST, type PersistedState, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist'

import type { PackDefinition, PackGameDefinition } from '../types'
import lastActiveGame from './lastActiveGameSlice'
import { createShellReducers } from './shellState'

const hasError = (action: unknown): action is { error?: unknown } => typeof action === 'object' && action !== null && 'error' in action && Boolean(action.error)

const errorMiddleware: Middleware = () => (next) => (action) => {
  if (!hasError(action)) return next(action)
  return action
}

export interface PackStoreConfig {
  // On web every Tastic app shares one origin (games.infinitetoken.com) and so one localStorage,
  // where AsyncStorage keeps this state under keyPrefix + 'root': the default prefix would make every
  // app's state the same persist:root. REHYDRATE still reports key 'root'. It applies on native too.
  // This is the only key the pack writes itself (the shared profile roster is @tastic/profile's,
  // shared on purpose).
  keyPrefix: string
  // redux-persist's migrate, run on the saved store before it rehydrates (see pack.ts).
  migrate?: (state: PersistedState, version: number) => Promise<PersistedState>
  // Keys left out of the root entry, beside liveplay: keys that persist themselves (a key whose reducer
  // is its own persistReducer, saving each game's board to an entry of its own), so they aren't written
  // into the root entry too.
  blacklist?: readonly string[]
  // State paths the dev serializability check skips (keys too big to walk on every action, such as
  // saved boards).
  serializableIgnoredPaths?: readonly string[]
  // The pack's own middleware, after the shell's.
  middleware?: readonly Middleware[]
}

// What the store is built from: the pack's games (each mounts its own keys, GameDefinition.reducers,
// and whether one is resumable decides the resume key), the pack's own keys (PackDefinition.reducers),
// and the seat colors and appearance the shell's own keys start from.
export type PackStoreSource = Pick<PackDefinition, 'seatColors' | 'appearance' | 'seatTheme' | 'reducers'> & { games: readonly Pick<PackGameDefinition, 'reducers' | 'resumable'>[] }

// The pack's one Redux store, persisted with redux-persist: the shell's keys (shellState.ts), the
// pack's own, and every game's own.
export function createPackStore(pack: PackStoreSource, { keyPrefix, migrate, blacklist = [], serializableIgnoredPaths = [], middleware = [] }: PackStoreConfig) {
  const gameReducers: Record<string, Reducer> = Object.assign({}, ...pack.games.map((game) => game.reducers))
  // Which play screen the player was last on, for a cold launch to resume (GameDefinition.resumable).
  // Only in a pack with a resumable game, so a pack without one saves exactly what it did before.
  const resumeReducers: Record<string, Reducer> = pack.games.some((game) => game.resumable) ? { lastActiveGame } : {}
  const rootReducer = combineReducers({ ...createShellReducers(pack), ...resumeReducers, ...pack.reducers, ...gameReducers })

  const persistedReducer = persistReducer(
    {
      key: 'root',
      keyPrefix,
      storage: AsyncStorage,
      // redux-persist defaults `timeout` to 5000ms: a failsafe setTimeout scheduled on every PERSIST
      // dispatch to force-resolve rehydrate if storage never responds. It's never cleared once
      // rehydrate resolves normally (only guarded by an internal `_sealed` flag), so it sits as a
      // pending timer for up to 5s after every store creation - under Jest that's a real open handle
      // ("A worker process has failed to exit gracefully"). Disabling it (falsy timeout skips the
      // setTimeout call entirely) is redux-persist's own documented way to opt out; AsyncStorage reads
      // failing to ever resolve at all isn't a failure mode worth a 5s failsafe for.
      timeout: 0,
      // liveplay is per-round state that must never survive a relaunch (see liveplaySlice.ts).
      blacklist: ['liveplay', ...blacklist],
      migrate
    },
    rootReducer
  )

  const store = configureStore({
    middleware: (getDefaultMiddleware) => {
      const defaultMiddleware = getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
          ignoredPaths: [...serializableIgnoredPaths]
        }
      })
      return defaultMiddleware.concat(errorMiddleware, ...middleware)
    },
    reducer: persistedReducer
  })

  const persistor = persistStore(store)
  return { store, persistor }
}

export type PackStore = ReturnType<typeof createPackStore>['store']
