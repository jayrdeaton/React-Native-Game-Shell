import type { UnknownAction } from 'redux'
import type { PersistedState } from 'redux-persist'

import type { PackStoreSource } from '../redux/createPackStore'

type StoreModule = typeof import('../redux/createPackStore')
type LiveplayModule = typeof import('../redux/liveplaySlice')
type AsyncStorage = (typeof import('@react-native-async-storage/async-storage'))['default']

// A stand-in game: one key of its own, beside the shell's.
const gameReducer = (state: { speed: string } = { speed: 'normal' }, action: UnknownAction) => (action.type === 'test/fast' ? { speed: 'fast' } : state)

const PACK: PackStoreSource = { games: [{ reducers: { testSettings: gameReducer } }], seatColors: { 1: '#4caf50', 2: '#ff9800' } }

// redux-persist keeps each slice as its own JSON string inside the root blob.
const rootBlob = (slices: Record<string, unknown>) => JSON.stringify(Object.fromEntries([...Object.entries(slices), ['_persist', { version: -1, rehydrated: true }]].map(([key, value]) => [key, JSON.stringify(value)])))

// Builds the store against a fresh in-memory AsyncStorage mock seeded with `items`, and waits for it
// to rehydrate.
async function launch(pack: PackStoreSource, items: Record<string, string> = {}, migrate?: (state: PersistedState, version: number) => Promise<PersistedState>) {
  let loaded: StoreModule | undefined
  let liveplay: LiveplayModule | undefined
  let storage: AsyncStorage | undefined
  jest.isolateModules(() => {
    // The official mock is a plain CommonJS object (module.exports = the mock), with no `default`.
    storage = require('@react-native-async-storage/async-storage') as AsyncStorage
    // Its multiSet writes before its first await, so storage is seeded before the store reads it.
    void storage.multiSet(Object.entries(items))
    loaded = require('../redux/createPackStore') as StoreModule
    liveplay = require('../redux/liveplaySlice') as LiveplayModule
  })
  const { persistor, store } = (loaded as StoreModule).createPackStore(pack, { keyPrefix: 'test:', migrate })
  await new Promise<void>((resolve) => {
    if (persistor.getState().bootstrapped) resolve()
    else persistor.subscribe(() => persistor.getState().bootstrapped && resolve())
  })
  // Drains redux-persist's write queue, so the root blob is written and no timer outlives the test.
  await persistor.flush()
  return { store, persistor, storage: storage as AsyncStorage, liveplayActions: (liveplay as LiveplayModule).liveplayActions }
}

// A game's keys (and the pack's, and the resume key) aren't in the store's own state type, which only
// knows the shell's fixed ones.
const root = (state: unknown) => state as Record<string, unknown>

const savedSlices = async (storage: AsyncStorage) => Object.keys(JSON.parse((await storage.getItem('test:root')) ?? '{}'))

describe('createPackStore', () => {
  it("saves under the pack's own prefix and nothing else", async () => {
    const { storage } = await launch(PACK)

    expect(await storage.getAllKeys()).toEqual(['test:root'])
  })

  it("mounts each game's own keys beside the shell's", async () => {
    const { store, persistor, storage } = await launch(PACK)
    store.dispatch({ type: 'test/fast' })
    await persistor.flush()

    expect(Object.keys(root(store.getState()))).toEqual(expect.arrayContaining(['theme', 'haptic', 'sound', 'keepAwake', 'profiles', 'profileSelection', 'seatColors', 'appSettings', 'opponent', 'liveplay', 'testSettings']))
    expect(root(store.getState()).testSettings).toEqual({ speed: 'fast' })
    expect(await savedSlices(storage)).toContain('testSettings')
  })

  it('never saves liveplay', async () => {
    const { store, persistor, storage, liveplayActions } = await launch(PACK)
    store.dispatch(liveplayActions.setActivelyPlaying(true))
    await persistor.flush()

    expect(store.getState().liveplay.activelyPlaying).toBe(true)
    expect(await savedSlices(storage)).not.toContain('liveplay')
  })

  it("starts the theme and the remembered guest and CPU colors on the pack's seat colors", async () => {
    const { store } = await launch(PACK)
    const { theme, seatColors } = store.getState()

    expect(theme.color).toEqual(expect.objectContaining({ primary: '#4caf50', secondary: '#ff9800' }))
    expect(seatColors).toEqual({ lastGuestColor: { 1: '#4caf50', 2: '#ff9800' }, lastCpuColor: '#ff9800', profileColors: {} })
  })

  it("starts on the system's appearance unless the pack sets one", async () => {
    expect((await launch(PACK)).store.getState().theme.appearance).toBe('system')
    expect((await launch({ ...PACK, appearance: 'dark' })).store.getState().theme.appearance).toBe('dark')
  })

  it("mounts and saves the pack's own keys (what its Settings sections save) beside the shell's and the games'", async () => {
    const cardsReducer = (state: { back: string } = { back: 'plain' }, action: UnknownAction) => (action.type === 'test/ornate' ? { back: 'ornate' } : state)
    const { store, persistor, storage } = await launch({ ...PACK, reducers: { cards: cardsReducer } })
    store.dispatch({ type: 'test/ornate' })
    await persistor.flush()

    expect(root(store.getState()).cards).toEqual({ back: 'ornate' })
    expect(root(store.getState()).testSettings).toEqual({ speed: 'normal' })
    expect(await savedSlices(storage)).toEqual(expect.arrayContaining(['cards', 'testSettings']))
  })

  it('has no resume key in a pack without a resumable game, so its saved store is what it was', async () => {
    const { store, storage } = await launch(PACK)

    expect(root(store.getState()).lastActiveGame).toBeUndefined()
    expect(await savedSlices(storage)).not.toContain('lastActiveGame')
  })

  it('saves which play screen was last open in a pack with a resumable game, for a relaunch to read', async () => {
    const pack: PackStoreSource = { ...PACK, games: [...PACK.games, { reducers: {}, resumable: true }] }
    const { store } = await launch(pack)
    expect(root(store.getState()).lastActiveGame).toEqual({ gameId: null })

    const relaunched = await launch(pack, { 'test:root': rootBlob({ lastActiveGame: { gameId: 'klondike' } }) })
    expect(root(relaunched.store.getState()).lastActiveGame).toEqual({ gameId: 'klondike' })
  })

  it("runs the pack's migrate on the saved store before it rehydrates", async () => {
    const migrate = jest.fn(async (state: PersistedState) => ({ ...state, opponent: { seatTwo: 'person' } }) as PersistedState)
    const { store } = await launch(PACK, { 'test:root': rootBlob({ opponent: { seatTwo: 'cpu' } }) }, migrate)

    expect(migrate).toHaveBeenCalledTimes(1)
    expect(store.getState().opponent).toEqual({ seatTwo: 'person' })
  })
})
