import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'

// iPadOS 26 draws a window's controls (close, minimize, tile) over the app's top-left corner whenever the app runs
// in a window (resized, tiled beside another app, Slide Over), and the regular safe area makes no room for them, so
// every screen's top-left button (a game's Home, Home's trophy, a Back) sat under them and a tap opened the controls
// instead. UIKit's corner-adapted safe area does make room: the vertical one is the regular insets with the top
// lowered below the controls in a window, and the same as the regular ones in full screen. Measured on the iPad 13"
// simulator: top 32 both ways full screen, in portrait and landscape; in a 375x667 window, top 10 regular and 53
// vertical. So on iPad every screen below gets the vertical insets, and in a window the whole app sits below the
// controls, like under a title bar. Not on iPhone: it has no window controls, and its vertical inset grows by 18pt in
// landscape for the rounded corners, which would push every landscape screen down.
/** Inside the SafeAreaProvider: on iPad, hands every screen the safe area with room for the window controls. */
export function WindowControlsInsets({ children }: { children: ReactNode }) {
  const vertical = useSafeAreaInsets({ cornerAdaptation: 'vertical' })
  if (Platform.OS !== 'ios' || !Platform.isPad) return <>{children}</>
  return <SafeAreaInsetsContext.Provider value={vertical}>{children}</SafeAreaInsetsContext.Provider>
}
