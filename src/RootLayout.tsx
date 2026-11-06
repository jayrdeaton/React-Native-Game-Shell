import { useAutoPaperTheme } from '@rific/auto-paper'
import { useHapticSettings } from '@rific/feedback-press'
import { Toaster, ToastProvider } from '@rific/toaster'
import { useThemedRootBackground } from '@tastic/core'
import { RotatedFrame } from '@tastic/hud/chrome'
import { ProfileColorProvider } from '@tastic/profile'
import * as Haptics from 'expo-haptics'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router'
import { ReactNode, useCallback, useMemo } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as RNPaper from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import type { Persistor } from 'redux-persist'

import { Fonts } from './components/Fonts'
import { GuideHost } from './components/GuideHost'
import { Providers } from './components/Providers'
import { Theme } from './components/Theme'
import { UpdateDialog } from './components/UpdateDialog'
import { LastActiveGameProvider } from './hooks/useLastActiveGame'
import { ProfilesProvider, useProfiles } from './hooks/useProfiles'
import { PackProvider, usePack } from './PackContext'
import type { PackStore } from './redux/createPackStore'
import { SplashGate } from './splashGate'
import type { PackDefinition, PackGameDefinition } from './types'

// The pack's root: every provider the shell needs, the pack's games' own providers, and the stack.
// src/app/_layout.tsx hands it the pack (pack.ts) and its store, so nothing in shell/ imports a
// game or the pack itself.

// Sits below Theme so it can read the live theme. useThemedRootBackground (@tastic/core) keeps both
// the screens' contentStyle and the OS root window's own background on the live theme, which is what
// stops white flashing through the display's rounded corners during a push/pop transition. Passing
// false disables iOS's swipe-back gesture: otherwise it competes with the game's own pan gestures on
// a play screen and wins (confirmed on-device in LightCycles, where it kicked the player back to the title
// screen mid-round instead of turning their cycle). Web has no such OS-level gesture.
//
// The status bar is set through screen options because that is the only way left: an app linked
// against the iOS 27 SDK can't set the status bar app-wide, which is all React Native's StatusBar (and
// expo-status-bar) does on iOS, and with UIViewControllerBasedStatusBarAppearance on (each app's
// ios.infoPlist), every mounted StatusBar logs an error. So nothing in the app mounts one (Theme passes
// auto-paper's Provider statusBar={false}). A play screen hides the bar for the whole round (a screen's
// own options win over screenOptions); index is listed first so it stays the stack's first route. A
// game with keepStatusBar (Solitaire's) keeps the stack's bar instead.
const PLAY_OPTIONS = { statusBarHidden: true }
const KEEP_STATUS_BAR_OPTIONS = {}

// The navigation theme is the root background too. React Navigation paints its theme's
// `colors.background` on the layers around every screen (the ScreenStack's container on native, each
// screen's wrapper on the web), and expo-router hands its container no theme, so that was always
// DefaultTheme's light grey: on iOS it showed in a sliding screen's rounded corners during every push and
// pop, whatever the app's theme. So the stack always gets a theme whose background is the root
// background's own color, and a pack's Backdrop (PackDefinition.Backdrop), drawn once behind the whole
// stack, gets a transparent one so it shows through both layers (contentStyle alone left an opaque light
// grey slab over Solitaire's felt on the web). Nothing else reads the navigation theme (headers are
// hidden; Paper has its own). Built as the stack renders, never at import, where a pack's tests may stand
// in for expo-router without its themes.
const TRANSPARENT_CONTENT = { backgroundColor: 'transparent' }

// The pack's own screen options (PackDefinition.useScreenOptions), as a hook every pack calls: an
// empty object without them.
const noScreenOptions = () => ({})

function AppStack() {
  const pack = usePack()
  const { Backdrop } = pack
  const { dark } = useAutoPaperTheme()
  // Over a backdrop the root stays dark whatever the mode: a backdrop is a dark table (the felt), and a
  // light root window would flash white around it during a push or pop.
  const darkRoot = Backdrop ? true : dark
  const rootBackground = useThemedRootBackground(darkRoot, false)
  // The status bar's text follows the app's theme, not the phone's appearance (react-native-screens'
  // default `auto`), which drew dark text on a dark theme's black Home with the phone set to light.
  const statusBarStyle = darkRoot ? ('light' as const) : ('dark' as const)
  const packOptions = (pack.useScreenOptions ?? noScreenOptions)()
  // Over a backdrop every screen is transparent, and Android crossfades: its default push and pop hold
  // the outgoing screen opaque for ~450ms while the new one slides over it, which would show Home
  // straight through a transparent play screen. iOS keeps its own push.
  const backdropOptions = Backdrop ? { contentStyle: TRANSPARENT_CONTENT, animation: Platform.select({ android: 'fade' as const }) } : undefined
  const playOptions = useCallback(
    ({ route }: { route: { params?: object } }) => {
      const id = (route.params as { game?: string } | undefined)?.game
      return pack.games.some((g) => g.id === id && g.keepStatusBar) ? KEEP_STATUS_BAR_OPTIONS : PLAY_OPTIONS
    },
    [pack.games]
  )
  const navigationBackground = Backdrop ? TRANSPARENT_CONTENT.backgroundColor : rootBackground.contentStyle.backgroundColor
  const navigationTheme = useMemo(() => {
    const base = darkRoot ? DarkTheme : DefaultTheme
    return { ...base, colors: { ...base.colors, background: navigationBackground } }
  }, [darkRoot, navigationBackground])
  const stack = (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ ...rootBackground, statusBarStyle, ...backdropOptions, ...packOptions }}>
        <Stack.Screen name='index' />
        <Stack.Screen name='play/[game]' options={playOptions} />
      </Stack>
    </NavigationThemeProvider>
  )
  if (!Backdrop) return stack
  return (
    <View style={styles.root}>
      <Backdrop />
      {stack}
    </View>
  )
}

// ProfilesProvider reconciles the local roster with the shared App Group one before `loaded` flips,
// so a screen mounting earlier would read (and could persist) the wrong profiles. This holds
// everything nested inside it, and the splash screen, until that's done, while ProfilesProvider sits
// above it and starts reconciling immediately. Settings and stats need no gate: they live in the
// Redux store, which Providers' PersistGate already holds until rehydrated.
function GatedApp({ children }: { children: ReactNode }) {
  const { loaded } = useProfiles()
  return (
    <SplashGate gate='profiles' ready={loaded}>
      {children}
    </SplashGate>
  )
}

// The toaster only gets expo-haptics while the player's Vibrate setting is on, so its haptic ticks
// follow the same setting as every other haptic in the app. Today they can't fire anyway (the only
// controls that tick, the history and clear buttons, are off below), but this keeps it that way if
// either is ever shown. Must render inside Providers, whose FeedbackBridge provides the setting.
//
// A pack with its own Toaster gets no Paper here: with Paper the toaster draws through a Paper Portal,
// which would take its toasts out of the frame PackToaster lays them in.
function HapticGatedToastProvider({ children }: { children: ReactNode }) {
  const { settings } = useHapticSettings()
  const { Toaster: PackToasterComponent } = usePack()
  return (
    <ToastProvider haptics={settings.vibrate ? Haptics : undefined} paper={PackToasterComponent ? undefined : RNPaper}>
      {children}
    </ToastProvider>
  )
}

function RotatingToaster() {
  const renderFrame = useCallback(
    (toasts: ReactNode) => (
      <RotatedFrame rotatedSafeArea passThrough>
        {toasts}
      </RotatedFrame>
    ),
    []
  )
  return <Toaster historyButton={null} clearButton={null} limit={3} renderFrame={renderFrame} />
}

// The pack's own toaster (PackDefinition.Toaster), laid over the whole app in hud's RotatedFrame, which
// nothing turns since @tastic/core 0.15: passThrough, so only a toast claims a touch over the stack, and
// rotatedSafeArea, so the toaster reads the safe area. The absoluteFill wrapper takes the frame out of
// the layout beside the stack.
function PackToaster({ Toaster: PackToasterComponent }: { Toaster: NonNullable<PackDefinition['Toaster']> }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <RotatedFrame rotatedSafeArea passThrough>
        <PackToasterComponent />
      </RotatedFrame>
    </View>
  )
}

// Every game's own root provider (its stats and achievements context), nested in pack order. A game
// without one adds nothing.
function GameProviders({ games, children }: { games: readonly PackGameDefinition[]; children: ReactNode }) {
  return games.reduceRight<ReactNode>((inner, game) => (game.Provider ? <game.Provider key={game.id}>{inner}</game.Provider> : inner), children)
}

// How every profile color is drawn (PackDefinition.previewColor), in the live mode: inside Theme for
// the `dark` read. A pack without it draws the colors as they are, with no provider.
function PreviewColors({ previewColor, children }: { previewColor: NonNullable<PackDefinition['previewColor']>; children: ReactNode }) {
  const { dark } = useAutoPaperTheme()
  const preview = useCallback((hex: string) => previewColor(hex, dark), [previewColor, dark])
  return <ProfileColorProvider preview={preview}>{children}</ProfileColorProvider>
}

// The pack's own root pieces that sit inside the store, Theme and every provider above:
// its color preview around everything, and its own Provider around How to Play and the stack.
function PackRoot({ pack, children }: { pack: PackDefinition; children: ReactNode }) {
  const { Provider, previewColor } = pack
  const inner = Provider ? <Provider>{children}</Provider> : children
  return previewColor ? <PreviewColors previewColor={previewColor}>{inner}</PreviewColors> : <>{inner}</>
}

interface RootLayoutProps {
  pack: PackDefinition
  store: PackStore
  persistor: Persistor
}

export function RootLayout({ pack, store, persistor }: RootLayoutProps) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PackProvider pack={pack}>
          <Fonts>
            <Providers store={store} persistor={persistor}>
              <Theme>
                <ProfilesProvider>
                  {/* Inside Providers' PersistGate, so the game a cold launch resumes (read once, as
                  it mounts) is the saved one. */}
                  <LastActiveGameProvider>
                    <GameProviders games={pack.games}>
                      <PackRoot pack={pack}>
                        <GatedApp>
                          <HapticGatedToastProvider>
                            {/* Wraps the stack (rather than sitting beside it like UpdateDialog)
                            because Home's tiles and the loadout's How to Play row reach it through
                            context (see GuideHost). Inside the toast provider because the card renders
                            through a Portal, and inside the gate so it mounts together with Home rather
                            than before it. */}
                            <GuideHost>
                              <AppStack />
                            </GuideHost>
                            {/* historyButton/clearButton off: there's no toast history to open, and a
                            control row for it above the toast stack would go nowhere. limit pins the
                            package's current default (3) so a future toaster release can't change it. */}
                            {pack.Toaster ? <PackToaster Toaster={pack.Toaster} /> : <RotatingToaster />}
                            <UpdateDialog />
                          </HapticGatedToastProvider>
                        </GatedApp>
                      </PackRoot>
                    </GameProviders>
                  </LastActiveGameProvider>
                </ProfilesProvider>
              </Theme>
            </Providers>
          </Fonts>
        </PackProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 }
})
