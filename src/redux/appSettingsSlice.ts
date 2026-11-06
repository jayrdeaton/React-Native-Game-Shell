import { createSettingsSlice } from '@rific/core'

// Settings that apply to the whole pack rather than one game. A game's own rules (board, score to
// win, controls) live in that game's own settings slice.
export interface AppSettings {
  // Edge Guard's opt-in (see Providers.tsx's EdgeGuardBridge).
  deferBottomEdgeGestures: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  deferBottomEdgeGestures: false
}

// Merge mode, like every settings slice in the pack: REHYDRATE fills any field added since a
// player's settings were saved from the defaults.
const { actions, reducer } = createSettingsSlice<AppSettings, 'merge', never>('appSettings', {
  initialState: DEFAULT_APP_SETTINGS,
  initializeMode: 'merge',
  fieldSetters: []
})

export const appSettingsActions = actions
export default reducer
