import { useUpdateErrorToast } from '@rific/toaster'
import { BaseSettingsDialog } from '@tastic/hud/chrome'
import { router } from 'expo-router'
import type { ReactNode } from 'react'

import { useAppSettings } from '../hooks/useAppSettings'
import { useProfiles } from '../hooks/useProfiles'
import { usePack } from '../PackContext'
import { profileHref, PROFILES_HREF } from '../routes'

export interface SettingsDialogProps {
  visible: boolean
  onDismiss: () => void
  // Shows the How to Play row, which opens this game's cards (a loadout passes its game's opener).
  // Left out on Home, where each tile's rules button does it, and in a match, where opening
  // Settings pauses play.
  onShowHowToPlay?: () => void
  // Shows the Profile row: seat 1's profile, "Profile" over its name, opening its Edit Profile screen, or Profiles (the roster)
  // while seat 1 is Guest (Jay, 2026-11-20: straight to your own profile, especially for someone with just the one; adding a second
  // stays a seat picker's Manage away). Home and a loadout pass it; a play screen leaves it off, as How to Play, since leaving a game
  // in play for another screen would keep its clock running.
  showProfile?: boolean
  // A play screen's own rows (a game's rule variants, where it has no loadout to set them in, see
  // GameDefinition.useLoadout), above the pack's own sections.
  children?: ReactNode
}

// A pack without rules to put first (PackDefinition.useSettingsRules).
const noSettingsRules = () => null

// The pack-wide Settings dialog: everything the shell puts in it applies to every game (Edge Guard,
// theme, sound, haptics, Keep Awake), so it reads and writes the app
// settings itself. Above those, the rules of the game it's opened in (PackDefinition.useSettingsRules);
// under them, a play screen's own rows and then the pack's own sections
// (PackDefinition.SettingsSections), in every Settings dialog the pack opens. A pack with edgeGuard
// false gets no Edge Guard row: hud draws it on iOS whenever its props are passed.
export function SettingsDialog({ visible, onDismiss, onShowHowToPlay, showProfile = false, children }: SettingsDialogProps) {
  const onUpdateError = useUpdateErrorToast()
  const { settings, setSettings } = useAppSettings()
  // The pack's otaVersion (src/constants/release.ts, which the OTA tooling bumps).
  const { otaVersion, SettingsSections, edgeGuard = true, useSettingsRules = noSettingsRules } = usePack()
  const rules = useSettingsRules()
  const { profiles, lastSelected } = useProfiles()
  const seatOne = profiles.find((profile) => profile.id === lastSelected[1]) ?? null
  const profileRow = showProfile ? (seatOne ? { onShowProfiles: () => router.push(profileHref(seatOne.id)), profilesRow: { label: 'Profile', caption: seatOne.name, icon: 'account-outline' } } : { onShowProfiles: () => router.push(PROFILES_HREF) }) : {}
  const edgeGuardProps = edgeGuard ? { deferBottomEdgeGestures: settings.deferBottomEdgeGestures, onDeferBottomEdgeGestures: (value: boolean) => setSettings({ deferBottomEdgeGestures: value }) } : {}

  return (
    <BaseSettingsDialog visible={visible} onDismiss={onDismiss} version={otaVersion} {...edgeGuardProps} onUpdateError={onUpdateError} onShowHowToPlay={onShowHowToPlay} {...profileRow} leading={rules}>
      {children}
      {SettingsSections && <SettingsSections />}
    </BaseSettingsDialog>
  )
}
