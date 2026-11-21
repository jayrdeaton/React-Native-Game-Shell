import { defaultColors } from '@rific/auto-paper'
import { ScreenFrame } from '@tastic/hud/chrome'
import { EditProfileScreen } from '@tastic/profile'
import { useLocalSearchParams } from 'expo-router'

import { useProfiles } from '../hooks/useProfiles'
import { safeBack } from '../navigation'
import { usePack } from '../PackContext'
import { ROSTER_MAX_WIDTH } from './ProfilesRoute'

// One profile's Edit Profile screen (@tastic/profile's EditProfileScreen), the pack's profile/[id]
// route, pushed from Profiles with the profile's id or 'new'. The back arrow, Done, a swipe back and a
// back button all save. Deleting a profile also removes its stats and achievements in every game: each
// game's reducers listen for the removal (see onProfileRemoved.ts).
//
// In hud's ScreenFrame, as Profiles: the delete confirm is a Paper Portal, which lands in a host inside
// the frame (portalHost), and the column is capped in the wide layout. A new profile starts on the
// pack's newProfileColor, or auto-paper's first swatch. Over a pack's Backdrop the screen is
// transparent, drawn in the pack's foreground.
export function EditProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profiles, createProfile, updateProfile, deleteProfile } = useProfiles()
  const { Backdrop, foreground, newProfileColor } = usePack()

  return (
    <ScreenFrame portalHost maxContentWidth={ROSTER_MAX_WIDTH}>
      <EditProfileScreen profileId={id} profiles={profiles} defaultColor={newProfileColor ?? defaultColors[0].value} onCreate={(patch) => createProfile(patch)} onSave={(profileId, patch) => updateProfile(profileId, patch)} onDelete={deleteProfile} onBack={safeBack} fg={foreground} bg={Backdrop ? 'transparent' : undefined} />
    </ScreenFrame>
  )
}
