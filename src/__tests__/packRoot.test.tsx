import { render, screen, within } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import * as RNPaper from 'react-native-paper'
import { Provider as ReduxProvider } from 'react-redux'
import type { Persistor } from 'redux-persist'

import { SettingsDialog } from '../components/SettingsDialog'
import { PackProvider } from '../PackContext'
import { RootLayout } from '../RootLayout'
import { standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { PackDefinition, StackScreenOptions } from '../types'

// The pack's root pieces in RootLayout (Backdrop, Provider, useScreenOptions, a game's keepStatusBar,
// Toaster, portraitWhileKeyboard, previewColor) and Settings' edgeGuard. The real RootLayout over the
// real store, with what needs a native runtime replaced: the fonts, persistence, Theme, the profiles
// gate, the safe area, the How to Play host and the update dialog pass their children through, and expo-router's
// stack, the navigation theme, the toaster, the orientation provider, the turned frame and the profile
// color provider record what they're handed.

let mockDark = false
const mockStack = jest.fn((_options: StackScreenOptions) => {})
const mockScreen = jest.fn((_props: { name: string; options?: unknown }) => {})
const mockNavigationTheme = jest.fn((_value: { colors: { background: string } }) => {})
const mockRootBackground = jest.fn((dark: boolean) => ({ contentStyle: { backgroundColor: dark ? 'black' : 'white' } }))
const mockToastProvider = jest.fn((_props: { paper?: unknown }) => {})
const mockOrientation = jest.fn((_props: { portraitWhileKeyboard?: boolean }) => {})
const mockFrame = jest.fn((_props: object) => {})
const mockColorPreview = jest.fn((_preview: (hex: string) => string) => {})
const mockBaseSettings = jest.fn((_props: object) => {})

jest.mock('expo-router', () => {
  const { View: RNView } = require('react-native')
  const Stack = ({ screenOptions, children }: { screenOptions: StackScreenOptions; children: ReactNode }) => {
    mockStack(screenOptions)
    return <RNView testID='stack'>{children}</RNView>
  }
  Stack.Screen = (props: { name: string; options?: unknown }) => {
    mockScreen(props)
    return null
  }
  return {
    Stack,
    DarkTheme: { dark: true, colors: { background: 'rgb(1, 1, 1)', card: 'rgb(2, 2, 2)' } },
    ThemeProvider: ({ value, children }: { value: { colors: { background: string } }; children: ReactNode }) => {
      mockNavigationTheme(value)
      return <RNView testID='navigation-theme'>{children}</RNView>
    },
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }
  }
})
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), SafeAreaProvider: ({ children }: { children: ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('../components/Fonts', () => ({ Fonts: ({ children }: { children: ReactNode }) => children }))
jest.mock('../components/Providers', () => {
  const { Provider: StoreProvider } = require('react-redux')
  return { Providers: ({ store, children }: { store: never; children: ReactNode }) => <StoreProvider store={store}>{children}</StoreProvider> }
})
jest.mock('../components/Theme', () => ({ Theme: ({ children }: { children: ReactNode }) => children }))
jest.mock('../components/GuideHost', () => ({ GuideHost: ({ children }: { children: ReactNode }) => children }))
jest.mock('../components/UpdateDialog', () => ({ UpdateDialog: () => null }))
jest.mock('../splashGate', () => ({ SplashGate: ({ children }: { children: ReactNode }) => children }))
jest.mock('../hooks/useProfiles', () => ({ ProfilesProvider: ({ children }: { children: ReactNode }) => children, useProfiles: () => ({ loaded: true, profiles: [], lastSelected: { 1: null, 2: null } }) }))
jest.mock('@rific/auto-paper', () => ({ ...jest.requireActual('@rific/auto-paper'), useAutoPaperTheme: () => ({ dark: mockDark, colors: {} }) }))
jest.mock('@rific/toaster', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@rific/toaster'),
    ToastProvider: ({ children, ...props }: { children: ReactNode; paper?: unknown }) => {
      mockToastProvider(props)
      return children
    },
    Toaster: () => <RNView testID='shell-toaster' />,
    useUpdateErrorToast: () => () => {}
  }
})
jest.mock('@tastic/core', () => ({
  ...jest.requireActual('@tastic/core'),
  OrientationProvider: ({ children, ...props }: { children: ReactNode; portraitWhileKeyboard?: boolean }) => {
    mockOrientation(props)
    return children
  },
  useRotationAwareStatusBar: () => ({ statusBarHidden: false }),
  useThemedRootBackground: (dark: boolean) => mockRootBackground(dark)
}))
jest.mock('@tastic/hud/chrome', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/hud/chrome'),
    RotatedFrame: ({ children, ...props }: { children: ReactNode }) => {
      mockFrame(props)
      return <RNView testID='rotated-frame'>{children}</RNView>
    },
    BaseSettingsDialog: (props: object) => {
      mockBaseSettings(props)
      return null
    }
  }
})
jest.mock('@tastic/profile', () => ({
  ...jest.requireActual('@tastic/profile'),
  ProfileColorProvider: ({ children, preview }: { children: ReactNode; preview: (hex: string) => string }) => {
    mockColorPreview(preview)
    return children
  }
}))

const pong = standInGame('pong')
const klondike = standInGame('klondike', { keepStatusBar: true })

async function renderRoot(overrides: Partial<PackDefinition> = {}) {
  const pack = standInPack([pong, klondike], overrides)
  await render(<RootLayout pack={pack} store={standInStore(pack) as never} persistor={{} as Persistor} />)
}

const lastScreenOptions = () => mockStack.mock.lastCall![0]
const playOptions = () => mockScreen.mock.calls.map(([props]) => props).find((props) => props.name === 'play/[game]')!.options as (args: { route: { params?: object } }) => object

beforeEach(() => {
  mockDark = false
  ;[mockStack, mockScreen, mockNavigationTheme, mockRootBackground, mockToastProvider, mockOrientation, mockFrame, mockColorPreview, mockBaseSettings].forEach((mock) => mock.mockClear())
})

describe("a pack's Backdrop", () => {
  const Backdrop = () => <View testID='backdrop' />

  it('leaves a pack without one with the stack as it was', async () => {
    await renderRoot()

    expect(screen.queryByTestId('backdrop')).toBeNull()
    expect(screen.queryByTestId('navigation-theme')).toBeNull()
    expect(mockRootBackground).toHaveBeenLastCalledWith(false)
    expect(lastScreenOptions().contentStyle).toEqual({ backgroundColor: 'white' })
    expect(lastScreenOptions()).not.toHaveProperty('animation')
  })

  it('is drawn once behind the stack, seen through its two layers, with the root window kept dark', async () => {
    await renderRoot({ Backdrop })

    expect(screen.getAllByTestId('backdrop')).toHaveLength(1)
    const ids = screen.toJSON() && JSON.stringify(screen.toJSON())
    expect(ids!.indexOf('"backdrop"')).toBeLessThan(ids!.indexOf('"navigation-theme"'))
    expect(within(screen.getByTestId('navigation-theme')).getByTestId('stack')).toBeTruthy()
    expect(mockNavigationTheme.mock.lastCall![0].colors.background).toBe('transparent')
    expect(lastScreenOptions().contentStyle).toEqual({ backgroundColor: 'transparent' })
    // Light mode too: the backdrop is dark, and a light root window would flash white around it.
    expect(mockRootBackground).toHaveBeenLastCalledWith(true)
    // iOS keeps its own push (Android crossfades).
    expect(lastScreenOptions().animation).toBeUndefined()
  })
})

describe("the pack's root pieces", () => {
  it("merges the pack's screen options after the shell's", async () => {
    await renderRoot({ useScreenOptions: () => ({ statusBarStyle: 'light', animation: 'fade', contentStyle: { backgroundColor: 'red' } }) })

    expect(lastScreenOptions()).toEqual(expect.objectContaining({ statusBarHidden: false, statusBarStyle: 'light', animation: 'fade', contentStyle: { backgroundColor: 'red' } }))
  })

  it('hides the status bar on a play screen for the whole round, but where the game keeps it', async () => {
    await renderRoot()

    expect(playOptions()({ route: { params: { game: 'pong' } } })).toEqual({ statusBarHidden: true })
    expect(playOptions()({ route: { params: { game: 'klondike' } } })).toEqual({})
  })

  it("mounts the pack's own Provider around the stack", async () => {
    const Provider = ({ children }: { children: ReactNode }) => <View testID='pack-provider'>{children}</View>
    await renderRoot({ Provider })

    expect(within(screen.getByTestId('pack-provider')).getByTestId('stack')).toBeTruthy()
  })

  it("mounts every game's Provider but a game's without one", async () => {
    const pack = standInPack([standInGame('pong', { Provider: ({ children }) => <View testID='pong-provider'>{children}</View> }), standInGame('klondike', { Provider: undefined })])
    await render(<RootLayout pack={pack} store={standInStore(pack) as never} persistor={{} as Persistor} />)

    expect(within(screen.getByTestId('pong-provider')).getByTestId('stack')).toBeTruthy()
  })

  it("draws the pack's Toaster in a frame turned with the phone, with no Paper to portal it out", async () => {
    const Toaster = () => <Text testID='pack-toaster'>toasts</Text>
    await renderRoot({ Toaster })

    expect(within(screen.getByTestId('rotated-frame')).getByTestId('pack-toaster')).toBeTruthy()
    expect(mockFrame).toHaveBeenLastCalledWith(expect.objectContaining({ rotatedSafeArea: true, passThrough: true }))
    expect(screen.queryByTestId('shell-toaster')).toBeNull()
    expect(mockToastProvider.mock.lastCall![0].paper).toBeUndefined()
  })

  it("keeps the shell's own toaster, with Paper, for a pack without one", async () => {
    await renderRoot()

    expect(screen.getByTestId('shell-toaster')).toBeTruthy()
    expect(mockToastProvider.mock.lastCall![0].paper).toBe(RNPaper)
  })

  it('reads upright while the keyboard is up only where the pack asks', async () => {
    await renderRoot()
    expect(mockOrientation.mock.lastCall![0].portraitWhileKeyboard).toBeUndefined()

    await renderRoot({ portraitWhileKeyboard: true })
    expect(mockOrientation.mock.lastCall![0].portraitWhileKeyboard).toBe(true)
  })

  it("draws every profile color through the pack's previewColor, in the live mode", async () => {
    const previewColor = jest.fn((hex: string, dark: boolean) => `${hex}-${dark ? 'dark' : 'light'}`)
    mockDark = true
    await renderRoot({ previewColor })

    expect(mockColorPreview.mock.lastCall![0]('#ff0000')).toBe('#ff0000-dark')
  })

  it('mounts no color preview for a pack without one', async () => {
    await renderRoot()

    expect(mockColorPreview).not.toHaveBeenCalled()
  })
})

describe("Settings' Edge Guard row", () => {
  async function renderSettings(overrides: Partial<PackDefinition>) {
    const pack = standInPack([pong], overrides)
    await render(
      <ReduxProvider store={standInStore(pack)}>
        <PackProvider pack={pack}>
          <SettingsDialog visible onDismiss={() => {}} />
        </PackProvider>
      </ReduxProvider>
    )
    return mockBaseSettings.mock.lastCall![0]
  }

  it('is handed to hud by default', async () => {
    expect(await renderSettings({})).toEqual(expect.objectContaining({ deferBottomEdgeGestures: false, onDeferBottomEdgeGestures: expect.any(Function) }))
  })

  it('is left out for a pack with edgeGuard false', async () => {
    const props = await renderSettings({ edgeGuard: false })

    expect(props).not.toHaveProperty('deferBottomEdgeGestures')
    expect(props).not.toHaveProperty('onDeferBottomEdgeGestures')
  })
})
