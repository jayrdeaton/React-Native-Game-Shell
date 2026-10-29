import { getThirdColor, type ThemeSettings, useAutoPaperTheme, useThemeSettings } from '@rific/auto-paper'
import { avoidSeatColorClash, type Profile, profileSeatColor } from '@tastic/profile'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { Action, Dispatch } from 'redux'

import { usePack } from '../PackContext'
import { seatColorsActions } from '../redux/seatColorsSlice'
import type { ShellState } from '../redux/shellState'
import type { Seat } from '../types'
import { useProfiles } from './useProfiles'

type ThemeColors = Pick<ThemeSettings, 'color' | 'harmony'>

// Whether a theme already has the colors (and harmony) a seat change would set: skipped, so a re-run
// with nothing new writes nothing.
function sameTheme(current: ThemeColors, next: Partial<ThemeColors>): boolean {
  const a = current.color
  const b = next.color
  const sameColor = typeof a === 'string' || typeof b === 'string' ? typeof a === typeof b && String(a).toLowerCase() === String(b).toLowerCase() : !!a && !!b && a.primary.toLowerCase() === b.primary.toLowerCase() && a.secondary.toLowerCase() === b.secondary.toLowerCase()
  return sameColor && (next.harmony === undefined || next.harmony === current.harmony)
}

// Both seats' live colors and the handlers that change them, for Home's who's-playing button and the
// loadout's seat buttons. `p2IsHuman` says whether seat 2 is a person (a guest or a profile) or the
// CPU, which decides where seat 2's color comes from.
//
// The theme follows the seats. By default it's a triad of the two seat colors, and each seat's live
// color is read back from it (its primary and secondary). A pack with its own seatTheme (a muted seed
// from seat 1's color, say) gets that instead, applied again when dark mode flips, and each seat's
// color comes from where it's remembered (the seatColors key), since the theme no longer holds the
// raw colors: seat 2 keeps its own color rather than the harmony's.
export function useSeatColors(p2IsHuman: boolean) {
  const { dark, colors: themeColors } = useAutoPaperTheme()
  const { settings: themeSettings, set: setThemeColor } = useThemeSettings()
  const { profiles, lastSelected } = useProfiles()
  // What @tastic/profile's avoidSeatColorClash moves seat 2 to when both seats land on one color: a
  // profile picked for one seat can be saved as the other seat's color, with no swap step behind it.
  // The pack's own seat colors, which never change while it runs.
  const { seatColors, seatTheme } = usePack()
  const seatDefaultColors = [seatColors[1], seatColors[2]] as const

  // Typed explicitly because @tastic/profile's action creators return a plain `{ payload, type }`
  // interface with no index signature, which react-redux's default Dispatch<UnknownAction> rejects.
  const dispatch = useDispatch<Dispatch<Action>>()
  // A seat's live color comes from one of three independently-remembered places depending on what's
  // in that seat - a selected profile's pick in this pack (or its own saved color without one), the
  // CPU's own remembered color, or a guest's own remembered color - all in the `seatColors` slice
  // (seatColorsSlice.ts). A profile's own saved color is never written back to; only the Profiles
  // screen edits it.
  const guestColors = useSelector((state: ShellState) => state.seatColors.lastGuestColor)
  const cpuColor = useSelector((state: ShellState) => state.seatColors.lastCpuColor)
  // Each profile's own color pick in this pack, by profile id, read through @tastic/profile's
  // profileSeatColor. It follows the profile, not the seat: kept through a switch to another profile
  // and back, a move to the other seat, and a relaunch.
  const profileColors = useSelector((state: ShellState) => state.seatColors.profileColors)

  const p1Profile = profiles.find((p) => p.id === lastSelected[1]) ?? null
  const p2Profile = p2IsHuman ? (profiles.find((p) => p.id === lastSelected[2]) ?? null) : null

  // Where each seat's color is remembered: a profile's pick in this pack (or its own color), the CPU's,
  // or a guest's. Seat 2 steps aside when both seats land on one color.
  const rememberedColors = (p1Prof: Profile | null, p2Prof: Profile | null, picks: typeof profileColors, guest: typeof guestColors, cpu: string) => {
    const p1 = p1Prof ? profileSeatColor(p1Prof, picks) : guest[1]
    const p2 = avoidSeatColorClash(p1, p2Prof ? profileSeatColor(p2Prof, picks) : p2IsHuman ? guest[2] : cpu, seatDefaultColors)
    return { p1, p2 }
  }
  const remembered = rememberedColors(p1Profile, p2Profile, profileColors, guestColors, cpuColor)
  const p1Color = seatTheme ? remembered.p1 : themeColors.primary
  const p2Color = seatTheme ? remembered.p2 : themeColors.secondary

  // The theme two seat colors make: the pack's own, or the triad.
  const themeFor = useCallback((p1: string, p2: string): Partial<ThemeColors> => (seatTheme ? seatTheme({ 1: p1, 2: p2 }, dark) : { color: { primary: p1, secondary: p2, tertiary: getThirdColor(p1, p2) } }), [seatTheme, dark])

  // Mirrored for the focus effect below, so it can read each seat's current profile and remembered
  // colors without depending on them (profiles is a new array on every useProfiles() render, and
  // useFocusEffect re-runs whenever its callback's identity changes, even while still focused).
  const p1ProfileRef = useRef(p1Profile)
  const p2ProfileRef = useRef(p2Profile)
  const guestColorsRef = useRef(guestColors)
  const cpuColorRef = useRef(cpuColor)
  const profileColorsRef = useRef(profileColors)
  const themeForRef = useRef(themeFor)
  useEffect(() => {
    p1ProfileRef.current = p1Profile
  }, [p1Profile])
  useEffect(() => {
    p2ProfileRef.current = p2Profile
  }, [p2Profile])
  useEffect(() => {
    guestColorsRef.current = guestColors
  }, [guestColors])
  useEffect(() => {
    cpuColorRef.current = cpuColor
  }, [cpuColor])
  useEffect(() => {
    profileColorsRef.current = profileColors
  }, [profileColors])
  useEffect(() => {
    themeForRef.current = themeFor
  }, [themeFor])

  // Keeps each seat's live theme color matching what it's supposed to be right now: on mount, and
  // when a seat's profile changes (a pick, the swap when a seat picks the other seat's profile, or a
  // deletion from Manage), when seat 2 changes between the CPU and a person, when a profile's pick
  // changes, and when the roster resolves. profiles itself is read, not depended on (a new array on
  // every render); profiles.length stands in as a coarse "profiles finished loading" signal.
  // With a seatTheme, dark mode flipping is a reason too: the theme it makes depends on it.
  useEffect(() => {
    const next = themeFor(remembered.p1, remembered.p2)
    if (sameTheme(themeSettings, next)) return
    setThemeColor(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSelected[1], lastSelected[2], p2IsHuman, guestColors, cpuColor, profileColors, profiles.length, dark])

  // The loadout pushes the play screen and Profiles on top of itself and comes back via
  // router.back()/safeBack() - a pop that reveals this same, still-mounted screen. On every focus
  // regain, re-derive each seat's live color from its authoritative source, so editing a profile's
  // own color on the Profiles screen is picked up the instant you're back (a new color for the
  // profile drops its pick, see profileSeatColor). Keyed only on what is a real reason to reapply;
  // everything else is read through the refs above.
  useFocusEffect(
    useCallback(() => {
      const next = rememberedColors(p1ProfileRef.current, p2ProfileRef.current, profileColorsRef.current, guestColorsRef.current, cpuColorRef.current)
      setThemeColor(themeForRef.current(next.p1, next.p2))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastSelected[1], lastSelected[2], p2IsHuman, setThemeColor])
  )

  // Routes a seat's just-changed color to whichever slot owns it right now - kept as that profile's
  // pick in this pack (the pack's caption on the seat button's Color row) when a profile's in the
  // seat. Picking the profile's own color drops the pick.
  const persistSeatColor = useCallback(
    (seat: Seat, hex: string) => {
      const profile = seat === 1 ? p1Profile : p2Profile
      if (profile) {
        dispatch(seatColorsActions.setProfileColor({ profile, color: hex }))
        return
      }
      if (seat === 2 && !p2IsHuman) {
        dispatch(seatColorsActions.setLastCpuColor(hex))
        return
      }
      dispatch(seatColorsActions.setLastGuestColor({ seat, color: hex }))
    },
    [p1Profile, p2Profile, p2IsHuman, dispatch]
  )

  // Picking the other seat's exact current color swaps the two instead of no-op'ing - only reachable
  // where that picker allows it (allowSwapTaken: against the CPU only, where the other color is the
  // CPU's, not a second person's choice). Each side of a swap persists by its own seat's rule above.
  const handleP1ColorChange = useCallback(
    (hex: string) => {
      const swapped = hex.toLowerCase() === p2Color.toLowerCase()
      const nextP2 = swapped ? p1Color : p2Color
      setThemeColor(themeFor(hex, nextP2))
      persistSeatColor(1, hex)
      if (swapped) persistSeatColor(2, nextP2)
    },
    [setThemeColor, themeFor, p1Color, p2Color, persistSeatColor]
  )
  const handleP2ColorChange = useCallback(
    (hex: string) => {
      const swapped = hex.toLowerCase() === p1Color.toLowerCase()
      const nextP1 = swapped ? p2Color : p1Color
      setThemeColor(themeFor(nextP1, hex))
      persistSeatColor(2, hex)
      if (swapped) persistSeatColor(1, nextP1)
    },
    [setThemeColor, themeFor, p1Color, p2Color, persistSeatColor]
  )

  return { p1Color, p2Color, handleP1ColorChange, handleP2ColorChange }
}
