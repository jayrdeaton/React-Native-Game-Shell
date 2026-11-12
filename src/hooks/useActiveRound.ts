import { useSelector } from 'react-redux'

import { usePackGame } from '../PackContext'
import { DEFAULT_OPPONENT } from '../redux/opponentSlice'
import type { ShellState } from '../redux/shellState'
import { type RoundMode, roundModeFor, seatTwoFor } from '../types'

// The round a play screen is playing: committed by the loadout when every human player readied up
// (see liveplaySlice.ts). A play screen reached without one (a direct link, a web reload, or a game
// with no loadout, which Home opens straight away) plays its game's defaults: a fresh install's seat
// 2 as that game reads it (seatTwoFor), so against the CPU, solo in a game with no seat 2
// (GameDefinition.seatTwo), and the game's first choice in one without a CPU.
export function useActiveRound<S extends object>(game: string, defaults: S): { mode: RoundMode; settings: S } {
  const round = useSelector((state: ShellState) => state.liveplay.activeRound)
  const choices = usePackGame(game)?.seatTwo
  if (!round || round.game !== game) return { mode: roundModeFor(seatTwoFor(DEFAULT_OPPONENT.seatTwo, choices)), settings: defaults }
  return { mode: round.mode, settings: { ...defaults, ...(round.settings as Partial<S>) } }
}
