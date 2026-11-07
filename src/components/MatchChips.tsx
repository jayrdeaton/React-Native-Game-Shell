import { useAutoPaperTheme } from '@rific/auto-paper'
import { IconButton } from '@rific/feedback-press'
import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAtComputer } from '../hooks/useAtComputer'

// How long the chips take to fade out when play starts, and back in when it stops.
export const MATCH_CHIPS_FADE_MS = 150
// The chip's box: a 24 icon in IconButton's 48, with Paper's margin zeroed.
const CHIP_SIZE = 48
const EDGE_PAD = 8

export interface MatchChipsProps {
  /** Whether play is on right now (a live puck, a shot in flight, a round being ridden). While it is,
   * the chips fade out and can't be pressed, so they never cover play; they come back the moment it
   * stops (between points, a round's card, Game Over). Ignored at a computer, where they stay up. */
  playing: boolean
  /** Two players at opposite ends of one screen right now (2 Player face to face). The chips then sit
   * on the side edges at the line between the players, rather than in the top corners, which are the
   * far player's end. False for one human (vs CPU, solo) and for side by side. Ignored at a
   * computer: both players share one upright screen there. */
  faceToFace: boolean
  /** Where that line between the players is, as a y in the window. Defaults to the window's middle;
   * pass it when the board isn't centered (a band of score above it, say). */
  centerLineY?: number
  onBack: () => void
  onSettings: () => void
}

/** The back and settings chips over a match, in every game of every pack: one rule for where they sit
 * and when they show. The window's top corners (the same spot as hud's CornerActionButtons on every
 * other screen), except 2 Player face to face, which puts them on the side edges at the line between
 * the players; faded out while play is on, except at a computer (useAtComputer: the web without a
 * touch-first screen), where they stay up in the page's corners. */
export function MatchChips({ playing, faceToFace, centerLineY, onBack, onSettings }: MatchChipsProps) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { dark } = useAutoPaperTheme()
  const atComputer = useAtComputer()
  const visible = atComputer || !playing
  const opacity = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: MATCH_CHIPS_FADE_MS })
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const iconColor = dark ? '#FFFFFF' : '#000000'
  const containerColor = dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'
  const between = faceToFace && !atComputer
  const top = between ? (centerLineY ?? height / 2) - CHIP_SIZE / 2 : EDGE_PAD + insets.top
  const backSlot = { top, left: EDGE_PAD + insets.left }
  const settingsSlot = { top, right: EDGE_PAD + insets.right }
  const pointerEvents = visible ? 'box-none' : 'none'
  return (
    <>
      <Animated.View pointerEvents={pointerEvents} style={[styles.slot, backSlot, fadeStyle]} testID='match-chips-back'>
        <IconButton icon='arrow-left' iconColor={iconColor} containerColor={containerColor} style={styles.chip} size={24} onPress={onBack} accessibilityLabel='Back' />
      </Animated.View>
      <Animated.View pointerEvents={pointerEvents} style={[styles.slot, settingsSlot, fadeStyle]} testID='match-chips-settings'>
        <IconButton icon='cog' iconColor={iconColor} containerColor={containerColor} style={styles.chip} size={24} onPress={onSettings} accessibilityLabel='Settings' />
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  chip: { margin: 0 },
  slot: { position: 'absolute' }
})
