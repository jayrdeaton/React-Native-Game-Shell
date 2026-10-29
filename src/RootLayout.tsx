import { useAutoPaperTheme } from '@rific/auto-paper'
import { useHapticSettings } from '@rific/feedback-press'
import { Toaster, ToastProvider } from '@rific/toaster'
import { OrientationProvider, useRotationAwareStatusBar, useThemedRootBackground } from '@tastic/core'
import { RotatedFrame } from '@tastic/hud/chrome'
import { ProfileColorProvider } from '@tastic/profile'
import * as Haptics from 'expo-haptics'
import { DarkTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router'
import { DeviceMotion } from 'expo-sensors'
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
import { useAppSettings } from './hooks/useAppSettings'
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
// useRotationAwareStatusBar (@tastic/core) hides the OS status bar whenever the content is rotated
// off portrait. It does it through screen options because that is the only way left: an app linked
// against the iOS 27 SDK can't set the status bar app-wide, which is all React Native's StatusBar
// (and expo-status-bar) does on iOS, and with @tastic/core's config plugin on, every mounted
// StatusBar logs an error. So nothing in the app mounts one (Theme passes auto-paper's Provider
// statusBar={false}). No `locked` argument: OrientationBridge already freezes the reading it
// follows. A play screen hides the bar for the whole round, whatever the angle (a screen's own
// options win over screenOptions); index is listed first so it stays the stack's first route.
// A game with keepStatusBar (Solitaire's) keeps the screen options' rotation-aware bar instead.
const PLAY_OPTIONS = { statusBarHidden: true }
const KEEP_STATUS_BAR_OPTIONS = {}

// A pack's Backdrop (PackDefinition.Backdrop) is drawn once behind the whole stack and has to show
// through two layers: each screen's contentStyle, and the layers React Navigation paints its theme's
// `colors.background` on around every screen (the ScreenStack's container on native, each screen's
// wrapper on the web). contentStyle alone left an opaque light grey slab over Solitaire's felt on the
// web. Nothing else reads the navigation theme (headers are hidden; Paper has its own). Built only for
// a pack with a backdrop, as it renders: never at import, where a pack's tests may stand in for
// expo-router without a DarkTheme.
const TRANSPARENT_CONTENT = { backgroundColor: 'transparent' }

// The pack's own screen options (PackDefinition.useScreenOptions), as a hook every pack calls: an
// empty object without them.
const noScreenOptions = () => ({})

function AppStack() {
  const pack = usePack()
  const { Backdrop } = pack
  const { dark } = useAutoPaperTheme()
  // Over a backdrop the root window stays dark whatever the mode: a backdrop is a dark table (the
  // felt), and a light root window would flash white around it during a push or pop.
  const rootBackground = useThemedRootBackground(Backdrop ? true : dark, false)
  const statusBar = useRotationAwareStatusBar()
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
  const navigationTheme = useMemo(() => (Backdrop ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } } : null), [Backdrop])
  const stack = (
    <Stack screenOptions={{ ...rootBackground, ...statusBar, ...backdropOptions, ...packOptions }}>
      <Stack.Screen name='index' />
      <Stack.Screen name='play/[game]' options={playOptions} />
    </Stack>
  )
  if (!Backdrop || !navigationTheme) return stack
  return (
    <View style={styles.root}>
      <Backdrop />
      <NavigationThemeProvider value={navigationTheme}>{stack}</NavigationThemeProvider>
    </View>
  )
}

// Wires the persisted Lock Orientation setting into @tastic/core's OrientationProvider. Its own
// component because RootLayout renders the Redux store (inside Providers) and so can't call
// useAppSettings() itself. Providers' PersistGate holds rendering until the store has rehydrated, so
// lockInitialValue carries the saved lock from the very first render.
//
// freezeWhileLocked makes the lock app-wide: while appSettings.lockOrientation is on, the ONE shared
// orientation reading freezes for every consumer (every screen, every board, hud dialogs, the
// status bar), including anything that mounts after the lock, so no call site ever takes a `locked`
// argument of its own (one would freeze on the pre-sensor default at mount). The Settings dialog
// toggle only writes appSettings.lockOrientation, which reaches the provider as a changed
// lockInitialValue; the provider reports the angle it froze on through onLockChange (`rotation`,
// cleared on unlock), persisted as appSettings.lockedRotation and handed back here so a relaunch reopens
// in the locked orientation instead of portrait.
//
// Mounted once, here, rather than per screen: one app-lifetime sensor subscription is what lets the
// committed orientation survive navigation. deviceMotion is the app's own expo-sensors import, handed
// in because @tastic/core never imports expo-sensors itself (apps without tilt tracking would
// otherwise need it installed just to bundle).
//
// portraitWhileKeyboard (PackDefinition.portraitWhileKeyboard): the software keyboard can't turn with a
// faked rotation, so a pack that has the player type sideways (a profile's name) reads portrait while
// it's up.
function OrientationBridge({ children }: { children: ReactNode }) {
  const { settings, setSettings } = useAppSettings()
  const { portraitWhileKeyboard } = usePack()
  return (
    <OrientationProvider deviceMotion={DeviceMotion} freezeWhileLocked lockInitialValue={{ locked: settings.lockOrientation, rotation: settings.lockedRotation }} onLockChange={(next) => setSettings({ lockOrientation: next.locked, lockedRotation: next.rotation })} portraitWhileKeyboard={portraitWhileKeyboard}>
      {children}
    </OrientationProvider>
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
// which would take its toasts out of the turned frame PackToaster lays them in.
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

// The pack's own toaster (PackDefinition.Toaster), laid over the whole app in a frame turned with the
// phone: passThrough, so only a toast claims a touch over the stack, and rotatedSafeArea, so the
// toaster's own safe-area reading lands on the frame's edges. The absoluteFill wrapper takes the frame
// out of the layout beside the stack.
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
                          <OrientationBridge>
                            <HapticGatedToastProvider>
                              {/* Wraps the stack (rather than sitting beside it like UpdateDialog)
                            because Home's tiles and the loadout's How to Play row reach it through
                            context (see GuideHost). Inside the toast provider and OrientationBridge
                            because the card renders through a Portal and rotates with the shared
                            reading, and inside the gate so it mounts together with Home rather than
                            before it. */}
                              <GuideHost>
                                <AppStack />
                              </GuideHost>
                              {/* historyButton/clearButton off: there's no toast history to open, and a
                            control row for it above the toast stack would go nowhere. limit pins the
                            package's current default (3) so a future toaster release can't change it. */}
                              {pack.Toaster ? <PackToaster Toaster={pack.Toaster} /> : <RotatingToaster />}
                              <UpdateDialog />
                            </HapticGatedToastProvider>
                          </OrientationBridge>
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
