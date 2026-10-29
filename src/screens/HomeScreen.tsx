import { defaultColors, useAutoPaperTheme } from '@rific/auto-paper'
import { IconButton, Pressable } from '@rific/feedback-press'
import { FakeLandscapeView, useRotation } from '@tastic/core'
import { PressAwayOverlay, usePopoverHost, useWellColors, WELL_SHADOW } from '@tastic/hud'
import { type Profile, ProfilePicker } from '@tastic/profile'
import { Redirect, router, useIsFocused } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, type AppStateStatus, ScrollView, StyleSheet, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'

import { useGameGuide } from '../components/GuideHost'
import { SettingsDialog } from '../components/SettingsDialog'
import { useFrozenWhileHidden } from '../hooks/useFrozenWhileHidden'
import { useLastActiveGame } from '../hooks/useLastActiveGame'
import { useOpponent } from '../hooks/useOpponent'
import { useProfiles } from '../hooks/useProfiles'
import { useSeatColors } from '../hooks/useSeatColors'
import { usePack } from '../PackContext'
import type { GameDefinition } from '../types'
import { HOME_GRID_GAP, HOME_LEFT_PANE_PICKER_GAP, HOME_TILE_PADDING, HOME_TOP_BAND, HOME_WIDE_PANE_GAP, PREVIEW_ASPECT, ROW_PREVIEW_WIDTH, useHomeLayout } from './homeLayout'

// Home: who's playing (seat 1, the same seat 1 every loadout starts with), then every game in the
// pack as a row in a fixed order, Solitaire's list: each game on its own well, its small app icon
// (or its preview, GameDefinition.Preview) beside its name and blurb. A tap opens that game's
// loadout, or its play screen in a game without one, after its How to Play cards the first time it's
// picked. Seat 2 is chosen in the loadout, from seat 2's own button.
//
// A cold launch that finds the player left the app inside a resumable game's play screen
// (GameDefinition.resumable) goes straight back there instead, before the menu ever paints.
export function HomeScreen() {
  const pack = usePack()
  const { consumeResumeGame } = useLastActiveGame()
  // A one-shot cold-launch decision, read exactly once at this instance's mount (see
  // hooks/useLastActiveGame.tsx), never a live value this screen re-renders from. Reading it live made
  // every Home in the stack swap its whole menu for a Redirect while a game was on top and rebuild it
  // the moment Home was shown again (in Solitaire, ~370 preview cards: going Home took seconds). An id
  // the pack no longer has, or of a game that no longer resumes, is dropped.
  const [resumeGame] = useState(() => {
    const id = consumeResumeGame()
    return pack.games.find((g) => g.id === id && g.resumable) ?? null
  })
  if (resumeGame) return <Redirect href={{ pathname: '/play/[game]', params: { game: resumeGame.id } }} />
  return <HomeMenu />
}

function HomeMenu() {
  const pack = usePack()
  const rotation = useRotation()
  const layout = useHomeLayout()
  const { insets } = layout
  const { dark } = useAutoPaperTheme()
  const { openFirstTime, openFor } = useGameGuide()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isFocused = useIsFocused()
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])
  // The hero pauses (HeroTitleProps.active) while a pushed screen covers Home or the app is in the
  // background, so it never animates where nobody can see it.
  const heroActive = isFocused && appState === 'active'

  const { profiles, lastSelected, selectProfile } = useProfiles()
  const { seatTwo } = useOpponent()
  const { p1Color, p2Color, handleP1ColorChange } = useSeatColors(seatTwo === 'person')
  const pickerHost = usePopoverHost()
  const selectedProfile = profiles.find((p) => p.id === lastSelected[1]) ?? null

  // Tiles: while any game in the pack has a preview, a wide screen lays the games out as a grid beside
  // the hero (homeLayout.ts). Home stays mounted beneath every screen the stack pushes and keeps
  // following the rotation, so while it's covered the layout is held where it was (see
  // useFrozenWhileHidden); it catches up when Home is shown again. Only the choice of layout is held:
  // the panes' numbers follow the window, unseen under the screen covering Home.
  const tiled = pack.games.some((game) => game.Preview)
  const isWide = useFrozenWhileHidden(tiled && layout.isWide, !isFocused)
  // Every preview is held back a frame rather than drawn in Home's first commit: a game's preview is
  // far more to draw than an icon, and drawing them all in the commit a navigation lands on stalled
  // the transition itself on a device in Solitaire, reading as "pressing Home hangs". For one frame
  // each preview's box is empty. Home stays mounted under the screens it opens, so this happens once.
  const [previewsRevealed, setPreviewsRevealed] = useState(false)
  useEffect(() => {
    if (!tiled) return
    const id = requestAnimationFrame(() => setPreviewsRevealed(true))
    return () => cancelAnimationFrame(id)
  }, [tiled])
  // A popover is placed once, as it opens. Switching between the column and the two panes unmounts
  // the very button it hangs off, which would leave the press-away overlay up with nothing to dismiss,
  // so the switch closes it.
  const closePicker = pickerHost.close
  useEffect(() => {
    closePicker()
  }, [isWide, closePicker])

  const bg = dark ? '#000000' : '#FFFFFF'
  const fg = dark ? '#FFFFFF' : '#000000'

  // A game with nothing to set up (no useLoadout) opens straight to its play screen.
  const openGame = useCallback((game: GameDefinition) => openFirstTime(game.id, () => router.push(game.useLoadout ? { pathname: '/loadout/[game]', params: { game: game.id } } : { pathname: '/play/[game]', params: { game: game.id } })), [openFirstTime])

  const picker = <ProfilePicker idPrefix='home-p1' host={pickerHost} profiles={profiles} selectedId={lastSelected[1]} color={p1Color} dark={dark} guestLabel='P1' onSelect={(profile: Profile | null) => selectProfile(1, profile?.id ?? null)} onManage={() => router.push('/profiles')} colorSection={{ value: p1Color, onChange: handleP1ColorChange, swatches: defaultColors, caption: selectedProfile ? pack.colorCaption : undefined }} />

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Reads correctly however the phone is held: see @tastic/core's FakeLandscapeView. The
      Settings dialog stays outside it: it renders through a Portal, turned by its own `rotation`. */}
      <FakeLandscapeView style={styles.rotatable}>
        <PressAwayOverlay active={pickerHost.openId !== null} onPress={pickerHost.close} />
        {isWide ? (
          <>
            {/* Right pane: the game grid, scrolling on its own beside the left pane. The scroller runs
            to the frame's right edge and the cog's gutter is its content's padding, so a web scrollbar
            sits at the window's edge. */}
            <ScrollView style={[styles.wideRightPane, { left: layout.paddingLeft + layout.leftPaneWidth + HOME_WIDE_PANE_GAP }]} contentContainerStyle={{ paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom, paddingRight: layout.paddingRight }}>
              <View style={[styles.grid, { width: layout.rightPaneWidth }]}>
                {pack.games.map((game) => (
                  <GameTile key={game.id} game={game} width={layout.tileWidth} previewWidth={layout.previewWidth} previewRevealed={previewsRevealed} dark={dark} p1Color={p1Color} p2Color={p2Color} onPress={() => openGame(game)} onRules={() => openFor(game.id)} />
                ))}
              </View>
            </ScrollView>
            {/* Left pane: the hero, then seat 1's button, centred as one group under the corner
            buttons' band. A later sibling of the grid, lifted while seat 1's menu is open so the menu
            paints over the tiles. box-none: only its controls claim taps. */}
            <View style={[styles.wideLeftPane, { left: layout.paddingLeft, width: layout.leftPaneWidth, paddingTop: HOME_TOP_BAND + insets.top, paddingBottom: 16 + insets.bottom }, pickerHost.openId !== null && styles.pickerOpen]}>
              <pack.HeroTitle words={pack.wordmark} color={fg} p1Color={p1Color} p2Color={p2Color} active={heroActive} fit={layout.heroFit} />
              <View style={styles.widePicker}>{picker}</View>
            </View>
          </>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: 56 + insets.top, paddingBottom: 24 + insets.bottom, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
            <pack.HeroTitle words={pack.wordmark} color={fg} p1Color={p1Color} p2Color={p2Color} active={heroActive} />

            {/* Who's playing: seat 1's button, the same one each loadout starts with. Lifted above the
            tiles while its menu is open, so the menu paints over them. */}
            <View style={[styles.picker, pickerHost.openId !== null && styles.pickerOpen]}>{picker}</View>

            <View style={styles.list}>
              {pack.games.map((game) => (
                <GameRow key={game.id} game={game} dark={dark} p1Color={p1Color} p2Color={p2Color} previewRevealed={previewsRevealed} onPress={() => openGame(game)} onRules={() => openFor(game.id)} />
              ))}
            </View>
          </ScrollView>
        )}

        <IconButton icon='trophy' iconColor={fg} size={24} style={[styles.corner, { top: 8 + insets.top, left: 8 + insets.left }]} onPress={() => router.push('/stats')} accessibilityLabel='Stats & Achievements' />
        <IconButton icon='cog' iconColor={fg} size={24} style={[styles.corner, { top: 8 + insets.top, right: 8 + insets.right }]} onPress={() => setSettingsOpen(true)} accessibilityLabel='Settings' />
      </FakeLandscapeView>

      <SettingsDialog visible={settingsOpen} onDismiss={() => setSettingsOpen(false)} rotation={rotation} />
    </View>
  )
}

interface GameRowProps {
  game: GameDefinition
  dark: boolean
  p1Color: string
  p2Color: string
  // Whether Home has painted once, so a preview may draw (see previewsRevealed).
  previewRevealed: boolean
  onPress: () => void
  onRules: () => void
}

// One game on its own well: its icon at app-icon size (the art was drawn as an app icon), or its
// preview where it has one, its name and one-line blurb, and a rules button at the end that shows its
// How to Play cards without opening the game.
function GameRow({ game, dark, p1Color, p2Color, previewRevealed, onPress, onRules }: GameRowProps) {
  const well = useWellColors()
  const GameIcon = game.icon
  return (
    // The rules button sits beside the row's own button, laid over its end, not inside it: a button
    // inside a button is invalid on the web.
    <View>
      <Pressable onPress={onPress} style={[styles.row, { backgroundColor: well.bg }]} accessibilityRole='button' accessibilityLabel={game.title}>
        {game.Preview ? (
          <PreviewBox game={game} width={ROW_PREVIEW_WIDTH} revealed={previewRevealed} dark={dark} p1Color={p1Color} p2Color={p2Color} />
        ) : (
          <View style={[styles.rowIcon, { backgroundColor: dark ? ICON_DARK_BG : ICON_LIGHT_BG }]}>
            <GameIcon size={ROW_ICON_SIZE} p1Color={p1Color} p2Color={p2Color} dark={dark} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text variant='titleLarge' style={[styles.rowTitle, { color: well.fg }]} numberOfLines={1}>
            {game.title}
          </Text>
          <Text variant='bodyMedium' style={{ color: well.fgMuted }} numberOfLines={2}>
            {game.blurb}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onRules} style={styles.rulesButton} hitSlop={12} accessibilityRole='button' accessibilityLabel={`${game.title} rules`}>
        <Icon source='information-outline' size={22} color={well.fgMuted} />
      </Pressable>
    </View>
  )
}

interface GameTileProps extends GameRowProps {
  width: number
  previewWidth: number
}

// One game in the wide layout's grid: the row turned on its side, its preview (or icon) on top and its
// name and blurb under it, since a row needs ~290pt, more than a grid column beside the hero has. The
// rules button floats over the preview's corner, beside the tile's button rather than inside it.
function GameTile({ game, width, previewWidth, dark, p1Color, p2Color, previewRevealed, onPress, onRules }: GameTileProps) {
  const well = useWellColors()
  return (
    <View style={{ width }}>
      <Pressable onPress={onPress} style={[styles.tile, { backgroundColor: well.bg }]} accessibilityRole='button' accessibilityLabel={game.title}>
        <PreviewBox game={game} width={previewWidth} revealed={previewRevealed} dark={dark} p1Color={p1Color} p2Color={p2Color} />
        <Text variant='titleMedium' style={[styles.rowTitle, { color: well.fg }]} numberOfLines={1}>
          {game.title}
        </Text>
        <Text variant='bodySmall' style={{ color: well.fgMuted }} numberOfLines={3}>
          {game.blurb}
        </Text>
      </Pressable>
      <Pressable onPress={onRules} style={styles.tileRulesButton} hitSlop={12} accessibilityRole='button' accessibilityLabel={`${game.title} rules`}>
        <Icon source='information-outline' size={20} color='#FFFFFF' />
      </Pressable>
    </View>
  )
}

interface PreviewBoxProps {
  game: GameDefinition
  width: number
  revealed: boolean
  dark: boolean
  p1Color: string
  p2Color: string
}

// A box of the preview's shape (PREVIEW_ASPECT) holding the game's preview, once Home has painted, or
// its icon centred where it has none (a tile in a pack where only some games have one).
function PreviewBox({ game, width, revealed, dark, p1Color, p2Color }: PreviewBoxProps) {
  const height = Math.round(width / PREVIEW_ASPECT)
  const { Preview, icon: GameIcon } = game
  const iconSize = Math.min(height, ROW_ICON_SIZE)
  return (
    <View style={[styles.preview, { width, height, backgroundColor: dark ? ICON_DARK_BG : ICON_LIGHT_BG }]}>
      {Preview ? (
        revealed && <Preview width={width} height={height} p1Color={p1Color} p2Color={p2Color} dark={dark} />
      ) : (
        <View style={[styles.previewIcon, { width: iconSize, height: iconSize, borderRadius: iconSize * 0.22 }]}>
          <GameIcon size={iconSize} p1Color={p1Color} p2Color={p2Color} dark={dark} />
        </View>
      )}
    </View>
  )
}

// The icon's size on a row: an app icon's, with its rounding.
const ROW_ICON_SIZE = 56
// The app icon's backgrounds (assets/images/icon-light.png and icon-dark.png), behind every game's art.
const ICON_LIGHT_BG = '#FAFAFA'
const ICON_DARK_BG = '#050505'
// Room at a row's end for the rules button laid over it.
const RULES_BUTTON_SPACE = 44

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    alignItems: 'center',
    gap: 24
  },
  corner: {
    position: 'absolute'
  },
  // The wide layout's tiles: wrapped rows of tiles the layout sizes to fill the pane's width.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HOME_GRID_GAP
  },
  // Solitaire's list: one column, never wider than a phone's, centred on a wide screen.
  list: {
    gap: 14,
    maxWidth: 480,
    width: '100%'
  },
  picker: {
    alignItems: 'center'
  },
  pickerOpen: {
    zIndex: 100
  },
  // The preview's own rounding, clipping whatever it draws to the box.
  preview: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  previewIcon: {
    overflow: 'hidden'
  },
  rotatable: {
    flex: 1
  },
  // A well (@tastic/hud's wellSurface): the theme's surface on MD3's level-1 shadow, the same surface
  // as Solitaire's game rows, the stats screen's sections and every dialog.
  row: {
    alignItems: 'center',
    borderRadius: 12,
    boxShadow: WELL_SHADOW,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    paddingRight: RULES_BUTTON_SPACE
  },
  rowIcon: {
    borderRadius: ROW_ICON_SIZE * 0.22,
    height: ROW_ICON_SIZE,
    overflow: 'hidden',
    width: ROW_ICON_SIZE
  },
  rowText: {
    flex: 1,
    gap: 2
  },
  rowTitle: {
    fontWeight: 'bold'
  },
  rulesButton: {
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 0
  },
  scroll: {
    flex: 1
  },
  // The same well as a row, turned on its side.
  tile: {
    borderRadius: 12,
    boxShadow: WELL_SHADOW,
    gap: 6,
    padding: HOME_TILE_PADDING
  },
  // A small translucent disc over the preview's top-right corner, so the white icon reads on whatever
  // the preview draws. hitSlop (on the Pressable) grows its touch area.
  tileRulesButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: HOME_TILE_PADDING + 4,
    top: HOME_TILE_PADDING + 4,
    width: 28
  },
  // The two panes are absolutely positioned siblings of the press-away overlay, each placed by the
  // offsets homeLayout.ts computes.
  wideLeftPane: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    pointerEvents: 'box-none',
    position: 'absolute',
    top: 0
  },
  widePicker: {
    marginTop: HOME_LEFT_PANE_PICKER_GAP
  },
  wideRightPane: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0
  }
})
