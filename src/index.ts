// The pack's root and its registry: an app's src/app/_layout.tsx renders RootLayout with its pack
// and store, and every screen, game and shared piece reads the pack through usePack().
export { PackProvider, usePack, usePackGame } from './PackContext'
export { RootLayout } from './RootLayout'
export { type FeedbackSounds, type GameDefinition, type GameGuide, type GameIconProps, type GameLoadout, type GamePreviewProps, type GameRulesProps, GUEST_PLAYER_ID, type GuidelessGameDefinition, type HeroTitleProps, humanSeatsFor, type LoadoutOptionsProps, type PackDefinition, type PackGameDefinition, type PackGuide, type PackStatsReset, type PackStatsSectionsProps, type PackStatsTab, type PickerAlign, type RoundMode, roundModeFor, type Seat, type SeatControlLook, type SeatTwo, seatTwoFor, type StackScreenOptions } from './types'

// The screens behind an app's routes (src/app/ stays in the app: expo-router only reads routes there).
export { LoadoutRoute, PlayRoute } from './screens/GameRoute'
export { HomeScreen } from './screens/HomeScreen'
// The shape of the box a game's Preview draws in on Home (width / height).
export { PREVIEW_ASPECT } from './screens/homeLayout'
export { ProfilesRoute } from './screens/ProfilesRoute'
export { StatsScreen } from './screens/StatsScreen'

// What a game's own screens use.
export { useGameGuide } from './components/GuideHost'
export { imageGameIcon } from './components/imageGameIcon'
export { SettingsDialog, type SettingsDialogProps } from './components/SettingsDialog'
export { useActiveRound } from './hooks/useActiveRound'
export { useAppSettings } from './hooks/useAppSettings'
export { useOpponent } from './hooks/useOpponent'
export { ProfilesProvider, useProfiles } from './hooks/useProfiles'
export { useSeatColors } from './hooks/useSeatColors'
export { safeBack } from './navigation'

// The store: the pack's one store, the shell's own keys, and what a game builds its keys from.
export { type AppSettings, appSettingsActions, default as appSettingsReducer, DEFAULT_APP_SETTINGS } from './redux/appSettingsSlice'
export { createPackStore, type PackStore, type PackStoreConfig, type PackStoreSource } from './redux/createPackStore'
export { createGameGuideSlice, type GameGuideState } from './redux/gameGuideSlice'
export { type ActiveRound, liveplayActions, default as liveplayReducer, type LiveplaySliceState } from './redux/liveplaySlice'
export { forgetProfileAchievements, onProfileRemoved } from './redux/onProfileRemoved'
export { DEFAULT_OPPONENT, opponentActions, default as opponentReducer, type OpponentState } from './redux/opponentSlice'
export { defaultProfileSelectionState, profileSelectionActions, default as profileSelectionReducer, type ProfileSelectionState } from './redux/profileSelectionSlice'
export { createSeatColorsReducer, defaultSeatColorsState, seatColorsActions, type SeatColorsState } from './redux/seatColorsSlice'
export { createShellReducers, type ShellState } from './redux/shellState'

// A game's per-player settings and its stats and achievements (src/shared/ in the apps until now).
export { createGameStats, type RecordResult } from './gameStats'
export { createPlayerSettings, type PlayerControlsState, type PlayerSettingsState, seatPlayerKey } from './playerSettings'
