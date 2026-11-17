import { createThemeReducer, getThirdColor } from '@rific/auto-paper'
import { keepAwakeReducer } from '@rific/core'
import { hapticReducer, soundReducer } from '@rific/feedback-press'
import { profilesReducer } from '@tastic/profile'

import type { PackDefinition } from '../types'
import appSettings from './appSettingsSlice'
import type { LastActiveGameState } from './lastActiveGameSlice'
import liveplay from './liveplaySlice'
import opponent from './opponentSlice'
import profileSelection from './profileSelectionSlice'
import { createSeatColorsReducer } from './seatColorsSlice'

// The store keys every pack has, whatever its games, built from the pack's own seat colors and
// appearance. Each game adds its own keys beside these (see GameDefinition.reducers).
export function createShellReducers({ seatColors, appearance = 'system', seatTheme }: Pick<PackDefinition, 'seatColors' | 'appearance' | 'seatTheme'>) {
  return {
    // Explicit primary/secondary triad (rather than a single seed expanded via harmony) so the pack's
    // identity is pinned exactly instead of drifting with whatever hue math a harmony offset would
    // produce. Primary/secondary ARE player 1/player 2's own default colors (PackDefinition.seatColors),
    // so the theme and the default guest colors (seatColorsSlice.ts) can never drift apart. Tertiary is
    // derived, not picked, via getThirdColor: the hue maximally distant from both (see
    // @rific/auto-paper's README "Explicit triad" section). The appearance is the pack's ('system',
    // createThemeReducer's own default, when it sets none).
    // A pack with its own seatTheme starts from what seat 1's default color makes of it instead (dark
    // only when the pack's appearance is; hooks/useSeatColors.ts re-applies it with the live mode).
    theme: createThemeReducer(seatTheme ? { appearance, ...seatTheme(seatColors, appearance === 'dark') } : { appearance, color: { primary: seatColors[1], secondary: seatColors[2], tertiary: getThirdColor(seatColors[1], seatColors[2]) } }),
    haptic: hapticReducer,
    // Starts off in a development build (feedback-press's defaultSoundSettings is `!__DEV__`), so local
    // testing on a simulator is silent; a production build starts with sound on.
    sound: soundReducer,
    // @rific/core's Keep Awake setting (see Providers.tsx's KeepAwakeBridge), under the namespace its
    // REHYDRATE handling expects.
    keepAwake: keepAwakeReducer,
    // The shared App Group roster (see @tastic/profile's resolveInitialProfiles/
    // useSharedProfilesSync, wired in hooks/useProfiles.tsx) is layered on top of this as a separate
    // sync target - this slice persisting normally via redux-persist is what gives it local-fallback
    // behavior where the shared store isn't available, with no separate AsyncStorage path.
    profiles: profilesReducer,
    profileSelection,
    // The loadout's "remember this color for next time" memory (guest, CPU, and each profile's pick
    // in this pack) - separate from `theme` above, which always reflects whatever's live right now.
    seatColors: createSeatColorsReducer(seatColors),
    appSettings,
    opponent,
    // Transient per-round state, the one key blacklisted from persistence (see liveplaySlice.ts).
    liveplay
  }
}

type ShellReducers = ReturnType<typeof createShellReducers>

// Plus the one key only a pack with a resumable game mounts (see createPackStore.ts), so a pack
// without one saves exactly what it did before resume existed.
export type ShellState = { [K in keyof ShellReducers]: ReturnType<ShellReducers[K]> } & { lastActiveGame?: LastActiveGameState }
