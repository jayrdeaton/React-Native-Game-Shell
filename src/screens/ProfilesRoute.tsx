import { ScreenFrame } from '@tastic/hud/chrome'
import { NEW_PROFILE_ID, ProfilesScreen } from '@tastic/profile'
import { router, useLocalSearchParams } from 'expo-router'

import { useProfiles } from '../hooks/useProfiles'
import { safeBack } from '../navigation'
import { usePack } from '../PackContext'
import { profileHref, seatParam } from '../routes'

// Widest the roster and a profile's screen get in the wide layout (a landscape phone, a desktop
// window). Upright they're never capped.
export const ROSTER_MAX_WIDTH = 640

// The Profiles screen (Manage, from either seat 1 button, Settings' Profiles row for a guest and the
// stats screen): @tastic/profile's roster. A profile opens its own Edit Profile screen, the pack's
// profile/[id] route (EditProfileRoute), where profiles are made, saved and deleted. Opened by a seat
// (the `seat` param, routes.ts' profilesHref), New Profile carries the seat along, so the profile made
// there is picked for it.
//
// In hud's ScreenFrame: ProfilesManager reads the safe-area insets itself (the header's padding), and
// the roster's column is capped in the wide layout. Over a pack's Backdrop the screen is transparent,
// drawn in the pack's foreground.
export function ProfilesRoute() {
  const { seat } = useLocalSearchParams<{ seat?: string }>()
  const opener = seatParam(seat)
  const { profiles } = useProfiles()
  const { Backdrop, foreground } = usePack()

  return (
    <ScreenFrame maxContentWidth={ROSTER_MAX_WIDTH}>
      <ProfilesScreen profiles={profiles} onEdit={(id) => router.push(profileHref(id, id === NEW_PROFILE_ID ? opener : null))} onBack={safeBack} fg={foreground} bg={Backdrop ? 'transparent' : undefined} />
    </ScreenFrame>
  )
}
