import { createSettingsSlice } from '@rific/core'

import type { SeatTwo } from '../types'

// Who sits in seat 2, for the whole pack: picked from player 1's opponent button in any game's loadout and
// kept from one game to the next and across relaunches, since it's usually the same two people.
// A fresh install starts on the CPU, so one person (App Review included) can tap a game and play.
// A game that doesn't offer the saved choice reads it as the CPU, or as its first choice in a game
// with no CPU, so a fresh install opens a CPU-less game on that (see types.ts' seatTwoFor).
export interface OpponentState {
  seatTwo: SeatTwo
}

export const DEFAULT_OPPONENT: OpponentState = { seatTwo: 'cpu' }

const { actions, reducer } = createSettingsSlice<OpponentState>('opponent', {
  initialState: DEFAULT_OPPONENT
})

export const opponentActions = actions
export default reducer
