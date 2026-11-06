import appSettingsReducer, { appSettingsActions, DEFAULT_APP_SETTINGS } from '../redux/appSettingsSlice'

const REHYDRATE = 'persist/REHYDRATE'

describe("the shell's appSettingsSlice", () => {
  it('starts from the defaults', () => {
    expect(appSettingsReducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('sets Edge Guard', () => {
    expect(appSettingsReducer(DEFAULT_APP_SETTINGS, appSettingsActions.initialize({ deferBottomEdgeGestures: true }))).toEqual({ deferBottomEdgeGestures: true })
  })

  it('fills fields missing from saved app settings with the defaults on rehydrate', () => {
    const next = appSettingsReducer(undefined, { type: REHYDRATE, payload: { appSettings: {} } } as { type: string })
    expect(next).toEqual(DEFAULT_APP_SETTINGS)
  })
})
