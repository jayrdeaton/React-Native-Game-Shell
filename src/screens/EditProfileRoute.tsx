import { defaultColors } from '@rific/auto-paper'
import { ScreenFrame } from '@tastic/hud/chrome'
import { EditProfileScreen } from '@tastic/profile'
import { useLocalSearchParams } from 'expo-router'

import { useProfiles } from '../hooks/useProfiles'
import { safeBack } from '../navigation'
import { usePack } from '../PackContext'
import { seatParam } from '../routes'
import { ROSTER_MAX_WIDTH } from './ProfilesRoute'

// One profile's Edit Profile screen (@tastic/profile's EditProfileScreen), the pack's profile/[id]
// route, pushed from Profiles with the profile's id or 'new'. The back arrow, Done, a swipe back and a
// back button all save. Deleting a profile also removes its stats and achievements in every game: each
// game's reducers listen for the removal (see onProfileRemoved.ts).
//
// In hud's ScreenFrame, as Profiles: the delete confirm is a Paper Portal, which lands in a host inside
// the frame (portalHost), and the column is capped in the wide layout. A new profile starts on the
// pack's newProfileColor, or auto-paper's first swatch. Over a pack's Backdrop the screen is
// transparent, drawn in the pack's foreground. A saved profile's screen also draws the pack's own
// ProfileSections (its online play's, say) under Color.
//
// A new profile is picked for the seat that went to make it (the `seat` param, which Profiles passes on
// when a seat opened it): seat 1's Manage on Home or in a loadout, or Settings' Profiles row for seat
// 1's guest, so the player comes back to their new profile in their seat (Jay, 2026-11-16 in HexFleet;
// every pack since @tastic/shell 0.19.0). The newest made wins. Opened by no seat (the stats screen's
// Manage), or left without making one, it picks nothing.
export function EditProfileRoute() {
  const { id, seat } = useLocalSearchParams<{ id: string; seat?: string }>()
  const opener = seatParam(seat)
  const { profiles, createProfile, updateProfile, deleteProfile, selectProfile } = useProfiles()
  const { Backdrop, foreground, newProfileColor, ProfileSections } = usePack()

  return (
    <ScreenFrame portalHost maxContentWidth={ROSTER_MAX_WIDTH}>
      <EditProfileScreen
        profileId={id}
        profiles={profiles}
        defaultColor={newProfileColor ?? defaultColors[0].value}
        onCreate={(patch) => {
          const profile = createProfile(patch)
          if (opener) selectProfile(opener, profile.id)
        }}
        onSave={(profileId, patch) => updateProfile(profileId, patch)}
        onDelete={deleteProfile}
        onBack={safeBack}
        fg={foreground}
        bg={Backdrop ? 'transparent' : undefined}
        sections={ProfileSections ? (profile) => <ProfileSections profile={profile} /> : undefined}
      />
    </ScreenFrame>
  )
}
