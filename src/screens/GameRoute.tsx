import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import { useLastActiveGame } from '../hooks/useLastActiveGame'
import { usePackGame } from '../PackContext'
import type { GameDefinition } from '../types'
import { type LoadoutGame, LoadoutScreen } from './LoadoutScreen'

// The game routes, loadout/[game] and play/[game]: a game's loadout and its play screen, by id. An id
// the pack doesn't have (a stale link, a web URL typed by hand) goes Home. The game id comes second,
// never first: expo-router strips the web build's base path off the front of an in-app link as well
// as the address bar, so a route starting with a game id the same as the base path (boxhockey/loadout
// under /boxhockey, lightcycles/loadout under /lightcycles) would lose that segment and land on
// /loadout, "Unmatched Route".
export function LoadoutRoute() {
  const { game: id } = useLocalSearchParams<{ game: string }>()
  const game = usePackGame(id)
  if (!game) return <Redirect href='/' />
  // A game with nothing to set up has no loadout (GameDefinition.useLoadout): a link to one plays it.
  if (!hasLoadout(game)) return <Redirect href={{ pathname: '/play/[game]', params: { game: game.id } }} />
  return <LoadoutScreen key={game.id} game={game} />
}

function hasLoadout(game: GameDefinition): game is LoadoutGame {
  return !!game.useLoadout
}

export function PlayRoute() {
  const { game: id } = useLocalSearchParams<{ game: string }>()
  const game = usePackGame(id)
  useResumePoint(game?.resumable ? game.id : null)
  if (!game) return <Redirect href='/' />
  const { PlayScreen } = game
  return <PlayScreen key={game.id} />
}

// A resumable game's play screen (GameDefinition.resumable) is where a cold launch comes back to:
// remembered as it mounts, and forgotten when it unmounts, which is the player backing out of it
// (its own back, hardware back or a browser back). Backgrounding the app leaves the screen mounted,
// so it stays remembered. Runs once per play screen: the context's functions never change.
function useResumePoint(gameId: string | null) {
  const { setLastActiveGame, clearLastActiveGame } = useLastActiveGame()
  useEffect(() => {
    if (!gameId) return
    setLastActiveGame(gameId)
    return clearLastActiveGame
  }, [gameId, setLastActiveGame, clearLastActiveGame])
}
