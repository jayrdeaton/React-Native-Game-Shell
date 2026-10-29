import type { Href } from 'expo-router'

// The shell's own routes, the ones every pack's src/app/ has (play/[game], loadout/[game], stats,
// profiles). An app with expo-router's typed routes type-checks this source against its own route tree
// (its tsc reads the package's src/), and an app moving onto the shell (Solitaire) has these routes only
// part of the way through. So they're handed to expo-router as plain Hrefs, not checked against it.
export const playHref = (game: string) => ({ pathname: '/play/[game]', params: { game } }) as unknown as Href
export const loadoutHref = (game: string) => ({ pathname: '/loadout/[game]', params: { game } }) as unknown as Href
export const STATS_HREF = '/stats' as unknown as Href
export const PROFILES_HREF = '/profiles' as unknown as Href
