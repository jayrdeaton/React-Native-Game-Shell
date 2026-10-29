import { createSettingsSlice } from '@rific/core'

// The play screen the player was last on, so a cold launch can drop them straight back onto it (see
// GameDefinition.resumable). Read once and written only through hooks/useLastActiveGame.tsx, which
// deliberately never subscribes to it (see that file for why). Mounted only in a pack with a
// resumable game (createPackStore.ts). From Solitaire's own, which keeps its game ids.
export type LastActiveGameState = { gameId: string | null }

const { actions, reducer } = createSettingsSlice<LastActiveGameState>('lastActiveGame', { initialState: { gameId: null } })

export const lastActiveGameActions = actions
export default reducer
