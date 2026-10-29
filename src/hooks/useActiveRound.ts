import { useSelector } from 'react-redux'

import { usePackGame } from '../PackContext'
import type { ShellState } from '../redux/shellState'
import type { RoundMode } from '../types'

// The round a play screen is playing: committed by the loadout when every human player readied up
// (see liveplaySlice.ts). A play screen reached without one (a direct link, a web reload, or a game
// with no loadout, which Home opens straight away) plays its game's defaults: against the CPU, or
// solo in a game with no seat 2 (GameDefinition.seatTwo).
export function useActiveRound<S extends object>(game: string, defaults: S): { mode: RoundMode; settings: S } {
  const round = useSelector((state: ShellState) => state.liveplay.activeRound)
  const seated = !!usePackGame(game)?.seatTwo
  if (!round || round.game !== game) return { mode: seated ? 'vsCpu' : 'solo', settings: defaults }
  return { mode: round.mode, settings: { ...defaults, ...(round.settings as Partial<S>) } }
}
