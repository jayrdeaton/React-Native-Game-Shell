import { defaultColors, getRgb, useAutoPaperTheme } from '@rific/auto-paper'
import { useOrientationState } from '@tastic/core'
import { CornerActionButtons, PressAwayOverlay, usePopoverHost } from '@tastic/hud/chrome'
import { PlayerSetupPanel, ReadyButton, SharedActionBand } from '@tastic/hud/lobby'
import type { Profile } from '@tastic/profile'
import { DualZoneLayout, needsSharedNeutralZone, useDualZoneLayout } from '@tastic/split-screen'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch } from 'react-redux'
import type { Action, Dispatch } from 'redux'

import { useGameGuide } from '../components/GuideHost'
import { SeatTwoPanel } from '../components/SeatTwoPanel'
import { SettingsDialog } from '../components/SettingsDialog'
import { useOpponent } from '../hooks/useOpponent'
import { useProfiles } from '../hooks/useProfiles'
import { useSeatColors } from '../hooks/useSeatColors'
import { safeBack } from '../navigation'
import { usePack } from '../PackContext'
import { liveplayActions } from '../redux/liveplaySlice'
import { playHref, PROFILES_HREF } from '../routes'
import { humanSeatsFor, type PackGameDefinition, roundModeFor, type Seat, type SeatTwo, seatTwoFor } from '../types'

// The player-panel area: whenever the window changes shape (a tablet turning, a browser window
// resized) and the panels go from face to face to side by side or back, they fade out, the layout
// underneath swaps while invisible, then they fade back in - masking what would otherwise be an
// instant jump-cut as panels reflow. Short and symmetric on purpose: this is masking a reflow that
// already happened at the OS's own pace, not a deliberate reveal.
const PANEL_SWAP_FADE_MS = 180

// A game that has a loadout (GameDefinition.useLoadout): the loadout route sends any other straight
// to its play screen.
export type LoadoutGame = PackGameDefinition & Required<Pick<PackGameDefinition, 'useLoadout'>>

// Every game's loadout: seat 1 (the player picked on Home), seat 2 (the CPU, a second person, or
// nobody, from seat 2's own button, or no button in a game for one player), the game's own match
// options, and Ready. Remounted per game (the route keys it by id), so a game's useLoadout hook only
// ever runs for that one game.
export function LoadoutScreen({ game }: { game: LoadoutGame }) {
  const pack = usePack()
  const { seatTwo: savedSeatTwo, setSeatTwo } = useOpponent()
  const seatTwo = seatTwoFor(savedSeatTwo, game.seatTwo)
  const mode = roundModeFor(seatTwo)
  const humanSeats = useMemo(() => humanSeatsFor(mode), [mode])
  const p2IsHuman = mode === 'twoPlayer'
  // A CPU takes a seat on the board; nobody doesn't (solo).
  const p2Exists = mode !== 'solo'

  const loadout = game.useLoadout(mode)
  const { openFor } = useGameGuide()

  const { profiles, lastSelected, selectProfile } = useProfiles()
  // The window's shape (@tastic/core's useOrientationState): side by side in a window wider than tall,
  // face to face otherwise. The OS turns the interface; a portrait-locked phone is always face to face.
  const { orientationMode } = useOrientationState()

  // The panel area's own layout lags one fade behind the window above - see useDualZoneLayout's own
  // comment. 2 Player seats its players the way the game's own board does: face to face (P1 in the
  // bottom half, P2 in the top) in any window, unless the game seats them side by side in a wide one
  // (GameDefinition.sideBySideWhenWide), P1 on the left, so each player gets the same half here and
  // in the match. With one person the panels follow the window.
  const panelMode = p2IsHuman && !game.sideBySideWhenWide ? 'faceToFace' : orientationMode
  const { panelLayout, panelFadeStyle } = useDualZoneLayout(panelMode, false, true, false, PANEL_SWAP_FADE_MS)
  // split-screen types the fade as a style for any component (useAnimatedStyle's DefaultStyle). An app
  // whose types widen Text's style (Expo's react-native-web types, which a generated expo-env.d.ts pulls
  // in, make its cursor any string) can't hand that to Animated.View. It only ever sets opacity.
  const playersRowFade = panelFadeStyle as unknown as StyleProp<ViewStyle>

  const [settingsOpen, setSettingsOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const { colors: themeColors, dark } = useAutoPaperTheme()
  const { p1Color, p2Color, handleP1ColorChange, handleP2ColorChange } = useSeatColors(p2IsHuman)
  const dispatch = useDispatch<Dispatch<Action>>()

  // A seat's color follows its newly selected profile through the profile-color effect above.
  // Picking the other seat's profile swaps the two (see @tastic/profile's select).
  const handleP1ProfileSelect = useCallback((profile: Profile | null) => selectProfile(1, profile?.id ?? null), [selectProfile])
  const handleP2ProfileSelect = useCallback((profileId: string | null) => selectProfile(2, profileId), [selectProfile])

  const [ready, setReady] = useState<Record<Seat, boolean>>({ 1: false, 2: false })

  // Every time this screen (re)gains focus - arrival from Home, or coming back from a match - Ready
  // starts false again. Without this, popping back to a loadout whose players both left it Ready
  // would immediately re-trigger the all-ready effect below and bounce straight back into the match.
  useFocusEffect(
    useCallback(() => {
      setReady({ 1: false, 2: false })
    }, [setReady])
  )
  // A change of who's in seat 2 starts Ready over too: otherwise player 1, ready and waiting on
  // player 2, would be launched into a match the moment seat 2 switched to the CPU.
  const changeSeatTwo = useCallback(
    (next: SeatTwo) => {
      setReady({ 1: false, 2: false })
      setSeatTwo(next)
    },
    [setSeatTwo, setReady]
  )

  // Read through a ref rather than listed as a dependency of the effect below: this screen stays
  // mounted (and still all Ready) under the play screen, so a settings change made there would
  // otherwise re-run that effect and push a second match.
  const roundSettingsRef = useRef(loadout.roundSettings)
  useEffect(() => {
    roundSettingsRef.current = loadout.roundSettings
  }, [loadout.roundSettings])

  useEffect(() => {
    if (!humanSeats.every((s) => ready[s])) return
    dispatch(liveplayActions.setActiveRound({ game: game.id, mode, settings: roundSettingsRef.current }))
    router.push(playHref(game.id))
  }, [ready, humanSeats, game.id, mode, dispatch])

  // Over the pack's Backdrop the loadout draws nothing of its own behind its controls, in the pack's
  // foreground, as Home does.
  const bg = pack.Backdrop ? 'transparent' : dark ? '#000000' : '#FFFFFF'
  const fg = pack.foreground ?? (dark ? '#FFFFFF' : '#000000')
  const fgMuted = (pack.foreground && halfOf(pack.foreground)) ?? (dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
  // Each seat's color as the pack draws profile colors (PackDefinition.previewColor), and the seat
  // buttons on the theme's surface over a backdrop, as Home's seat 1 button is. The saved colors stay
  // what the Color rows pick and compare.
  const { previewColor } = pack
  const seatPreview = useMemo(() => (previewColor ? (hex: string) => previewColor(hex, dark) : undefined), [previewColor, dark])
  const p1Drawn = seatPreview ? seatPreview(p1Color) : p1Color
  const p2Drawn = seatPreview ? seatPreview(p2Color) : p2Color
  const triggerStyle = useMemo(() => (pack.Backdrop ? [styles.pill, { backgroundColor: themeColors.surface }] : undefined), [pack.Backdrop, themeColors.surface])

  const isPortrait = panelLayout.orientationMode === 'faceToFace'
  // See @tastic/split-screen's needsSharedNeutralZone: whether back/settings/randomize/reset fold
  // into one band between the two players instead of sitting in the corners.
  const showMetaInSharedBand = needsSharedNeutralZone(panelLayout.orientationMode, humanSeats.length)

  // Where P2's own press-away zone lives on screen - matches panelLayout (what's actually painted
  // right now, mid-fade included). Portrait puts P2's panel in the top half; landscape on the right
  // (P1 sits on the left). Only in 2 Player - otherwise seat 2 shares seat 1's host (see p2Host below).
  const p2ZoneStyle = p2IsHuman ? (isPortrait ? styles.p2ZoneTop : styles.p2ZoneRight) : null

  // With one human, the one Ready button sits under both panels instead of in each.
  const showReadyButton = p2IsHuman
  // The seat buttons' menus are placed by the pack where it places them itself (PackDefinition.
  // usePickerAlign), as on Home, but only in the one-human row: 2 Player's halves keep each menu in
  // its own player's half (hud's useZoneClampedAlign, the panels' own). The panels are keyed by layout,
  // so a placement hook never changes under a mounted panel.
  const seatPickerAlign = p2IsHuman ? undefined : pack.usePickerAlign
  const layoutKey = p2IsHuman ? 'zones' : 'row'
  // P1's panel and the match options share one host - they sit in the same near/bottom zone. With
  // one human, seat 2's panel joins it too (one person drives both, so two open menus at once would
  // be clutter). 2 Player gives P2 their own host so two people can pick at once, each press-away
  // zone closing only its own player's menu.
  const controlsHost = usePopoverHost()
  const p2PanelHost = usePopoverHost()
  const p2Host = p2IsHuman ? p2PanelHost : controlsHost
  // The one-human Ready button is centered under the whole row, not under either seat button, so an
  // open seat menu can't fully cover it; it fades out while one is open instead.
  const anyPlayerPickerOpen = !!(controlsHost.openId?.startsWith('p1-') || controlsHost.openId?.startsWith('p2-'))

  const optionsRow = loadout.options({
    host: controlsHost,
    accentColor: themeColors.tertiary,
    mutedColor: fgMuted,
    onAccentColor: themeColors.onTertiary,
    dark,
    // Left out (the row's own actions unrendered) whenever the shared band below carries them.
    onRandomize: showMetaInSharedBand ? undefined : loadout.randomize,
    onReset: showMetaInSharedBand ? undefined : loadout.reset
  })

  const optionsPopoverOpen = controlsHost.openId !== null && loadout.optionIds.includes(controlsHost.openId)
  const sharedControls = showMetaInSharedBand ? (
    <SharedActionBand onBack={safeBack} onSettings={() => setSettingsOpen(true)} onRandomize={loadout.randomize} onReset={loadout.reset} fg={fg} popoverOpen={optionsPopoverOpen}>
      {optionsRow}
    </SharedActionBand>
  ) : (
    optionsRow
  )

  const controlLook = { accentColor: themeColors.tertiary, mutedColor: fgMuted, dark }
  const p1Control = loadout.seatControl(1, controlsHost, { ...controlLook, seatColor: p1Drawn })
  const p1Panel = <PlayerSetupPanel key={`p1-${layoutKey}`} idPrefix='p1' host={controlsHost} color={p1Color} onColorChange={handleP1ColorChange} swatches={defaultColors} takenColor={p2Exists ? p2Color : undefined} allowSwapTaken={mode === 'vsCpu'} colorCaption={pack.colorCaption} isHuman ready={ready[1]} onToggleReady={() => setReady((r) => ({ ...r, 1: !r[1] }))} dark={dark} showReadyButton={showReadyButton} secondPicker={p1Control} secondPickerId={p1Control ? 'p1-control' : undefined} profiles={profiles} selectedProfileId={lastSelected[1]} takenProfileId={p2IsHuman ? lastSelected[2] : null} guestLabel={pack.guestLabel ?? 'P1'} nullLabel={pack.nullLabel} onProfileSelect={handleP1ProfileSelect} onManageProfiles={() => router.push(PROFILES_HREF)} previewValue={seatPreview} triggerStyle={triggerStyle} useSeatPickerAlign={seatPickerAlign} />
  const p2Control = p2IsHuman ? loadout.seatControl(2, p2Host, { ...controlLook, seatColor: p2Drawn }) : undefined
  // A game for one player (no seatTwo) has no seat 2 button: seat 1's panel stands alone.
  const p2Panel = game.seatTwo && <SeatTwoPanel key={`p2-${layoutKey}`} idPrefix='p2' host={p2Host} choices={game.seatTwo} seatTwo={seatTwo} onSeatTwoChange={changeSeatTwo} cpuDifficulty={loadout.cpuDifficulty} profiles={profiles} selectedProfileId={lastSelected[2]} onProfileSelect={handleP2ProfileSelect} color={p2Color} onColorChange={handleP2ColorChange} swatches={defaultColors} takenColor={p1Color} allowSwapTaken={mode === 'vsCpu'} colorCaption={pack.colorCaption} dark={dark} secondPicker={p2Control} secondPickerId={p2Control ? 'p2-control' : undefined} ready={ready[2]} onToggleReady={() => setReady((r) => ({ ...r, 2: !r[2] }))} showReadyButton={showReadyButton} previewValue={seatPreview} triggerStyle={triggerStyle} usePickerAlign={seatPickerAlign} />

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* The Settings dialog stays outside this frame: it renders through a Portal. */}
      <View style={styles.frame}>
        {/* Press-away overlays for the loadout's own menus. P1's covers the whole screen (their
        panel plus the match options read as theirs), while P2's covers only their half and, as a
        later sibling, takes priority there. P2's mounts whenever either host has a menu open, so it
        always shields P2's half from P1's press-away. */}
        <PressAwayOverlay active={controlsHost.openId !== null} onPress={controlsHost.close} />
        {p2ZoneStyle && <PressAwayOverlay active={controlsHost.openId !== null || p2Host.openId !== null} onPress={p2Host.close} style={p2ZoneStyle} />}

        {!showMetaInSharedBand && <CornerActionButtons onBack={safeBack} onSettings={() => setSettingsOpen(true)} fg={fg} insets={insets} />}

        {p2IsHuman ? (
          <DualZoneLayout
            panelLayout={panelLayout}
            panelFadeStyle={panelFadeStyle}
            p1={p1Panel}
            p2={p2Panel}
            shared={sharedControls}
            // A zone can't self-elevate above a later sibling zone; these lift whichever zone has a
            // menu open (see DualZoneLayout's p1Elevated/p2Elevated/sharedElevated doc).
            p1Elevated={controlsHost.openId?.startsWith('p1-') ?? false}
            p2Elevated={p2Host.openId !== null}
            sharedElevated={optionsPopoverOpen}
          />
        ) : (
          <View style={styles.stackedZone}>
            {sharedControls}
            <Animated.View style={[styles.playersRow, anyPlayerPickerOpen && styles.playersRowOpen, playersRowFade]}>
              {p1Panel}
              {p2Panel}
            </Animated.View>
            <ReadyButton color={p1Drawn} ready={ready[1]} onToggleReady={() => setReady((r) => ({ ...r, 1: !r[1] }))} style={anyPlayerPickerOpen && styles.readyButtonHidden} />
          </View>
        )}
      </View>

      <SettingsDialog visible={settingsOpen} onDismiss={() => setSettingsOpen(false)} onShowHowToPlay={() => openFor(game.id)} />
    </View>
  )
}

// A foreground at half strength: the loadout's muted text and icons, drawn on the pack's backdrop.
// Undefined for a color it can't read.
function halfOf(color: string): string | undefined {
  const rgb = getRgb(color)
  return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)` : undefined
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  // A real full-bleed box to size the absolutely-positioned children against.
  frame: {
    alignItems: 'center',
    flex: 1,
    gap: 32,
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  p2ZoneRight: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%'
  },
  p2ZoneTop: {
    height: '50%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  // A seat button's trigger on a surface over the pack's backdrop, as Home's.
  pill: {
    borderRadius: 999
  },
  // The one-human row: seat 1's panel and seat 2's button read as one evenly spaced row of buttons,
  // at PlayerSetupPanel's own pickerRow gap (12).
  playersRow: {
    flexDirection: 'row',
    gap: 12
  },
  playersRowOpen: {
    zIndex: 100
  },
  // See anyPlayerPickerOpen: opacity 0 (not display:'none') keeps the button's layout space, and
  // pointerEvents:'none' keeps the sliver an open menu doesn't cover from being a hidden tap target.
  readyButtonHidden: {
    opacity: 0,
    pointerEvents: 'none'
  },
  stackedZone: {
    alignItems: 'center',
    gap: 28
  }
})
