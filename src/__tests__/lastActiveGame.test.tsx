import { configureStore } from '@reduxjs/toolkit'
import { renderHook } from '@testing-library/react-native'
import { ReactNode } from 'react'
import { Provider } from 'react-redux'

import { LastActiveGameProvider, useLastActiveGame } from '../hooks/useLastActiveGame'
import lastActiveGame, { lastActiveGameActions } from '../redux/lastActiveGameSlice'

// Solitaire's own tests of the provider (src/__tests__/stores/lastActiveGame.test.tsx), ported with it.

// A store holding just this slice, seeded the way a rehydrated store would be.
async function setup(initialValue: string | null) {
  const store = configureStore({ reducer: { lastActiveGame } })
  store.dispatch(lastActiveGameActions.setGameId(initialValue))
  let renders = 0
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <LastActiveGameProvider>{children}</LastActiveGameProvider>
    </Provider>
  )
  const view = await renderHook(
    () => {
      renders++
      return useLastActiveGame()
    },
    { wrapper }
  )
  return { store, renders: () => renders, ...view }
}

describe('LastActiveGameProvider', () => {
  it('hands the persisted game to the first consumer exactly once (a cold-launch resume is one-shot)', async () => {
    const { result } = await setup('klondike')

    expect(result.current.consumeResumeGame()).toBe('klondike')
    expect(result.current.consumeResumeGame()).toBeNull()
  })

  it('has nothing to resume when no game was active', async () => {
    const { result } = await setup(null)

    expect(result.current.consumeResumeGame()).toBeNull()
  })

  // A launch straight into a game (deep link) while the store says a different game was last active must
  // not let a later Home mount bounce the player into that stale game.
  it('drops a pending resume as soon as any game is entered, and stores the new game', async () => {
    const { result, store } = await setup('klondike')

    result.current.setLastActiveGame('spider')

    expect(store.getState().lastActiveGame.gameId).toBe('spider')
    expect(result.current.consumeResumeGame()).toBeNull()
  })

  it('drops a pending resume when the player backs out, and clears the stored game', async () => {
    const { result, store } = await setup('golf')

    result.current.clearLastActiveGame()

    expect(store.getState().lastActiveGame.gameId).toBeNull()
    expect(result.current.consumeResumeGame()).toBeNull()
  })

  // The whole point of the provider not being React state (and never selecting the slice): every game
  // mount/unmount calls set/clear, and any re-render there would re-render every consumer (each Home in
  // the stack, every play screen), which is how going Home used to rebuild whole menus in Solitaire.
  it('never re-renders consumers or changes its context value when set/clear write the store', async () => {
    const { result, renders } = await setup('klondike')
    const first = result.current
    const rendersBefore = renders()

    result.current.setLastActiveGame('yukon')
    result.current.clearLastActiveGame()

    expect(renders()).toBe(rendersBefore)
    expect(result.current).toBe(first)
  })

  it('never rewrites an unchanged value', async () => {
    const { result, store } = await setup('klondike')
    const dispatch = jest.spyOn(store, 'dispatch')

    result.current.setLastActiveGame('klondike')

    expect(dispatch).not.toHaveBeenCalled()
  })

  // A pack with no resumable game never mounts the key (createPackStore.ts).
  it('reads nothing to resume from a store without the key', async () => {
    const store = configureStore({ reducer: { other: (state: number = 0) => state } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <LastActiveGameProvider>{children}</LastActiveGameProvider>
      </Provider>
    )
    const { result } = await renderHook(() => useLastActiveGame(), { wrapper })

    expect(result.current.consumeResumeGame()).toBeNull()
  })
})
