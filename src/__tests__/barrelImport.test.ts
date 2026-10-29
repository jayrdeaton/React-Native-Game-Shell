// A pack's own tests load the shell's barrel for one name (createPlayerSettings, createGameGuideSlice)
// with expo-router stood in by its `router` alone (navigation.ts reads it at import). So nothing in the
// barrel may read anything else of expo-router at import: RootLayout's transparent navigation theme,
// built from expo-router's DarkTheme at import, failed 15 of PuckTastic's and DuelTastic's suites before
// it ran a test. It's built as RootLayout renders now.

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))

describe('the barrel', () => {
  it('loads with nothing of expo-router but its router', () => {
    expect(() => require('../index')).not.toThrow()
  })
})
