import { defaultColors } from '@rific/auto-paper'
import { type AlignResult, RotatedFrame } from '@tastic/hud/chrome'
import { ProfilesScreen } from '@tastic/profile'

import { useProfiles } from '../hooks/useProfiles'
import { safeBack } from '../navigation'
import { usePack } from '../PackContext'

// Widest the roster gets in the wide layout (a phone held sideways, a desktop window). Upright it's
// never capped.
const ROSTER_MAX_WIDTH = 640

// The Profiles screen (Manage, from either seat 1 button). Deleting a profile also removes its
// stats and achievements in every game: each game's reducers listen for the removal (see
// onProfileRemoved.ts).
//
// Turned with the phone like every other screen, in hud's RotatedFrame: ProfilesManager reads the
// safe-area insets itself (the header's padding), so they're handed over remapped onto the frame's
// edges (rotatedSafeArea); its delete confirm is a Paper Portal, which lands in a host inside the frame
// and is turned with it (portalHost); and the roster's column is capped in the wide layout. Over a
// pack's Backdrop the screen is transparent, drawn in the pack's foreground.
// The pack's own placement for a profile's color swatch (PackDefinition.usePickerAlign), kept inside the
// roster's capped column: the roster scrolls in it, which clips the menu at its edges. Handed to
// ProfilesScreen only where the pack has one.
function useRosterAlign(open: boolean, contentWidth: number, contentHeight: number): AlignResult {
  const { usePickerAlign } = usePack()
  return usePickerAlign!(open, contentWidth, contentHeight, { maxContentWidth: ROSTER_MAX_WIDTH })
}

export function ProfilesRoute() {
  const { profiles, createProfile, updateProfile, deleteProfile } = useProfiles()
  const { Backdrop, foreground, newProfileColor, usePickerAlign } = usePack()

  return (
    <RotatedFrame rotatedSafeArea portalHost maxContentWidth={ROSTER_MAX_WIDTH}>
      <ProfilesScreen profiles={profiles} defaultColor={newProfileColor ?? defaultColors[0].value} onCreate={(patch) => createProfile(patch)} onSave={(id, patch) => updateProfile(id, patch)} onDelete={deleteProfile} onBack={safeBack} fg={foreground} bg={Backdrop ? 'transparent' : undefined} useColorPickerAlign={usePickerAlign ? useRosterAlign : undefined} />
    </RotatedFrame>
  )
}
