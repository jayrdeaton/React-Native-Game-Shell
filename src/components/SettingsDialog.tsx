import { useUpdateErrorToast } from '@rific/toaster'
import { BaseSettingsDialog } from '@tastic/hud/chrome'
import type { ReactNode } from 'react'

import { useAppSettings } from '../hooks/useAppSettings'
import { usePack } from '../PackContext'

export interface SettingsDialogProps {
  visible: boolean
  onDismiss: () => void
  // Shows the How to Play row, which opens this game's cards (a loadout passes its game's opener).
  // Left out on Home, where each tile's rules button does it, and in a match, where opening
  // Settings pauses play.
  onShowHowToPlay?: () => void
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
export function SettingsDialog({ visible, onDismiss, onShowHowToPlay, children }: SettingsDialogProps) {
  const onUpdateError = useUpdateErrorToast()
  const { settings, setSettings } = useAppSettings()
  // The pack's otaVersion (src/constants/release.ts, which the OTA tooling bumps).
  const { otaVersion, SettingsSections, edgeGuard = true, useSettingsRules = noSettingsRules } = usePack()
  const rules = useSettingsRules()
  const edgeGuardProps = edgeGuard ? { deferBottomEdgeGestures: settings.deferBottomEdgeGestures, onDeferBottomEdgeGestures: (value: boolean) => setSettings({ deferBottomEdgeGestures: value }) } : {}

  return (
    <BaseSettingsDialog visible={visible} onDismiss={onDismiss} version={otaVersion} {...edgeGuardProps} onUpdateError={onUpdateError} onShowHowToPlay={onShowHowToPlay} leading={rules}>
      {children}
      {SettingsSections && <SettingsSections />}
    </BaseSettingsDialog>
  )
}
