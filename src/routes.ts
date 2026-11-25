import type { Href } from 'expo-router'

import type { Seat } from './types'

// The shell's own routes, the ones every pack's src/app/ has (play/[game], loadout/[game], stats,
// profiles, profile/[id]). An app with expo-router's typed routes type-checks this source against its own route tree
// (its tsc reads the package's src/), and an app moving onto the shell (Solitaire) has these routes only
// part of the way through. So they're handed to expo-router as plain Hrefs, not checked against it.
export const playHref = (game: string) => ({ pathname: '/play/[game]', params: { game } }) as unknown as Href
export const loadoutHref = (game: string) => ({ pathname: '/loadout/[game]', params: { game } }) as unknown as Href
export const STATS_HREF = '/stats' as unknown as Href
// The roster, opened by no seat (the stats screen's Manage).
export const PROFILES_HREF = '/profiles' as unknown as Href
// The roster, opened by a seat: its picker's Manage, or Settings' Profiles row for seat 1's guest. The seat rides along to New
// Profile, and the profile made there is picked for it (Jay, 2026-11-16 in HexFleet: a new profile is selected in the seat that
// went to make it).
export const profilesHref = (seat: Seat) => ({ pathname: '/profiles', params: { seat: String(seat) } }) as unknown as Href
// One profile's Edit Profile screen: a profile's id, or @tastic/profile's NEW_PROFILE_ID ('new') for New Profile, with the seat
// that opened the roster for a new one.
export const profileHref = (id: string, seat?: Seat | null) => ({ pathname: '/profile/[id]', params: seat ? { id, seat: String(seat) } : { id } }) as unknown as Href
// The seat a profiles route was opened for (its `seat` param), or null: none, or anything but 1 or 2.
export const seatParam = (value: string | string[] | undefined): Seat | null => (value === '1' ? 1 : value === '2' ? 2 : null)
