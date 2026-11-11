import { defaultColors, FadingScrollView, useAutoPaperTheme } from '@rific/auto-paper'
import { IconButton, Pressable } from '@rific/feedback-press'
import { PressAwayOverlay, usePopoverHost, useWellColors, WELL_SHADOW } from '@tastic/hud/chrome'
import { getProfilePickerContentSize, type Profile, ProfilePicker, type ProfilePickerColorSection } from '@tastic/profile'
import { Redirect, router, useIsFocused } from 'expo-router'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, StyleSheet, View } from 'react-native'
import { Icon, Portal, SegmentedButtons, Text } from 'react-native-paper'

import { useGameGuide } from '../components/GuideHost'
import { SettingsDialog } from '../components/SettingsDialog'
import { useFrozenWhileHidden } from '../hooks/useFrozenWhileHidden'
import { useLastActiveGame } from '../hooks/useLastActiveGame'
import { useOpponent } from '../hooks/useOpponent'
import { useProfiles } from '../hooks/useProfiles'
import { useSeatColors } from '../hooks/useSeatColors'
import { usePack } from '../PackContext'
import { loadoutHref, playHref, PROFILES_HREF, STATS_HREF } from '../routes'
import type { HomeTab, PackGameDefinition } from '../types'
import { HOME_GRID_GAP, HOME_LEFT_PANE_PICKER_GAP, HOME_TILE_PADDING, HOME_TOP_BAND, HOME_WIDE_PANE_GAP, PREVIEW_ASPECT, ROW_PREVIEW_WIDTH, useHomeLayout } from './homeLayout'

// Home: who's playing (seat 1, the same seat 1 every loadout starts with), then every game in the
// pack as a row in a fixed order, Solitaire's list: each game on its own well, its small app icon
// (or its preview, GameDefinition.Preview) beside its name and blurb. A tap opens that game's
// loadout, or its play screen in a game without one, after its How to Play cards the first time it's
// picked. Seat 2 is chosen in the loadout, from player 1's opponent button. A pack with tabs
// (PackDefinition.homeTabs) shows one tab's games at a time, from a switch over the rows.
//
// A cold launch that finds the player left the app inside a resumable game's play screen
// (GameDefinition.resumable) goes straight back there instead, before the menu ever paints. The
// pack's own How to Play (PackDefinition.guide) shows by itself on a first launch, held back while
// that launch is about to drop into a game: it must never open over a game in progress.
export function HomeScreen() {
  const pack = usePack()
  const { consumeResumeGame } = useLastActiveGame()
  const { autoShowPack } = useGameGuide()
  // A one-shot cold-launch decision, read exactly once at this instance's mount (see
  // hooks/useLastActiveGame.tsx), never a live value this screen re-renders from. Reading it live made
  // every Home in the stack swap its whole menu for a Redirect while a game was on top and rebuild it
  // the moment Home was shown again (in Solitaire, ~370 preview cards: going Home took seconds). An id
  // the pack no longer has, or of a game that no longer resumes, is dropped.
  const [resumeGame] = useState(() => {
    const id = consumeResumeGame()
    return pack.games.find((g) => g.id === id && g.resumable) ?? null
  })
  useEffect(() => {
    if (!resumeGame) autoShowPack()
  }, [resumeGame, autoShowPack])
  if (resumeGame) return <Redirect href={playHref(resumeGame.id)} />
  return <HomeMenu />
}

function HomeMenu() {
  const pack = usePack()
  const layout = useHomeLayout()
  const { insets } = layout
  const { dark, colors } = useAutoPaperTheme()
  const { openFirstTime, openFor, openPack } = useGameGuide()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The game whose rules sheet (GameDefinition.Rules) is open.
  const [rulesGame, setRulesGame] = useState<PackGameDefinition | null>(null)
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
  // following the window, so while it's covered the layout is held where it was (see
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
  // A popover is placed once, as it opens, from measurements of the frame it opens in. Turning the
  // device (or any resize) moves the frame under it, and switching between the column and the two panes
  // unmounts the very button it hangs off, which would leave the press-away overlay up with nothing to
  // dismiss. So every layout change closes it.
  const closePicker = pickerHost.close
  useEffect(() => {
    closePicker()
  }, [isWide, layout.windowWidth, layout.windowHeight, closePicker])

  // Over the pack's Backdrop Home draws nothing of its own behind the menu.
  const bg = pack.Backdrop ? 'transparent' : dark ? '#000000' : '#FFFFFF'
  const fg = pack.foreground ?? (dark ? '#FFFFFF' : '#000000')
  // Seat 1's color as the pack draws profile colors (PackDefinition.previewColor), and the button on
  // the theme's surface over a backdrop, so neither washes out on it.
  const { previewColor } = pack
  const p1Drawn = previewColor ? previewColor(p1Color, dark) : p1Color
  const triggerStyle = useMemo(() => (pack.Backdrop ? [styles.pill, { backgroundColor: colors.surface }] : undefined), [pack.Backdrop, colors.surface])

  // The pack's tabs (PackDefinition.homeTabs): one tab's games at a time, the same switch as the stats
  // screen's tabs (on the theme's surface over a backdrop). The other tabs' games stay mounted, hidden, so
  // a switch draws nothing new (their previews are already there). The tab is Home's own state, kept while
  // Home is covered, since Home stays mounted under every screen it opens.
  const tabs = pack.homeTabs && pack.homeTabs.length > 1 ? pack.homeTabs : null
  const [tabLabel, setTabLabel] = useState(() => tabs?.[0].label ?? null)
  const tab = tabs ? (tabs.find((t) => t.label === tabLabel) ?? tabs[0]) : null
  const tabButtons = useMemo(() => tabs?.map(({ label }) => ({ value: label, label })) ?? [], [tabs])
  const tabBar = tab && <SegmentedButtons value={tab.label} onValueChange={setTabLabel} buttons={tabButtons} style={[styles.tabs, pack.Backdrop && { backgroundColor: colors.surface }]} />
  const columnClamp = useClampOnShrink()
  const gridClamp = useClampOnShrink()

  // A game with nothing to set up (no useLoadout) opens straight to its play screen.
  const openGame = useCallback((game: PackGameDefinition) => openFirstTime(game.id, () => router.push(game.useLoadout ? loadoutHref(game.id) : playHref(game.id))), [openFirstTime])

  // A tile's rules button: the game's rules sheet where it has one, else its How to Play cards.
  const openRules = useCallback((game: PackGameDefinition) => (game.Rules ? setRulesGame(game) : openFor(game.id)), [openFor])

  const colorSection: ProfilePickerColorSection = { value: p1Color, onChange: handleP1ColorChange, swatches: defaultColors, caption: selectedProfile ? pack.colorCaption : undefined, previewValue: previewColor ? (hex: string) => previewColor(hex, dark) : undefined }
  // The pack's own placement for the menu (PackDefinition.usePickerAlign), sized from the same rows
  // and color page the picker draws; hud's own without one. The pack never changes while it runs.
  const usePickerAlign = pack.usePickerAlign ?? noPickerAlign
  const pickerSize = getProfilePickerContentSize(profiles.length, true, colorSection)
  const pickerAlign = usePickerAlign(pickerHost.openId === `${SEAT_ONE_PICKER}-profile`, pickerSize.width, pickerSize.height)

  const picker = <ProfilePicker idPrefix={SEAT_ONE_PICKER} host={pickerHost} profiles={profiles} selectedId={lastSelected[1]} color={p1Drawn} dark={dark} guestLabel={pack.guestLabel ?? 'P1'} nullLabel={pack.nullLabel} onSelect={(profile: Profile | null) => selectProfile(1, profile?.id ?? null)} onManage={() => router.push(PROFILES_HREF)} colorSection={colorSection} alignOverride={pickerAlign} triggerStyle={triggerStyle} />

  // Closes seat 1's menu on a press anywhere but the menu and its button. Where it's mounted matters on
  // a phone, where zIndex only orders the children of one parent: the menu lives inside the scroller in
  // the upright layout, so the overlay goes there too, under the button's wrapper (raised while the menu
  // is open) and over the rows. As the frame's first child it sat under the whole scroller, and a press
  // on a row played the game. In the wide layout the left pane is itself the frame's child, so the
  // overlay stays there, under the pane and over the grid.
  const pressAway = <PressAwayOverlay active={pickerHost.openId !== null} onPress={pickerHost.close} style={styles.pressAway} />
  const RulesSheet = rulesGame?.Rules

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* The Settings dialog stays outside this frame: it renders through a Portal. A game's rules
      sheet renders inside it instead (see RulesHost). */}
      <View style={styles.frame}>
        <RulesHost enabled={pack.games.some((game) => game.Rules)}>
          {isWide ? (
            <>
              {pressAway}
              {/* Right pane: the game grid, scrolling on its own beside the left pane. The scroller runs
            to the frame's right edge and the cog's gutter is its content's padding, so a web scrollbar
            sits at the window's edge. Both scrollers fade out at an edge while there is more past it
            (auto-paper's FadingScrollView, a mask, so whatever is behind shows through). */}
              <FadingScrollView {...(tab && gridClamp)} style={[styles.wideRightPane, { left: layout.paddingLeft + layout.leftPaneWidth + HOME_WIDE_PANE_GAP }]} contentContainerStyle={{ paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom, paddingRight: layout.paddingRight }}>
                {tabBar && <View style={[styles.wideTabs, { width: layout.rightPaneWidth }]}>{tabBar}</View>}
                <View style={[styles.grid, { width: layout.rightPaneWidth }]}>
                  {pack.games.map((game) => (
                    <GameTile key={game.id} game={game} hidden={isHidden(tab, game)} width={layout.tileWidth} previewWidth={layout.previewWidth} previewRevealed={previewsRevealed} dark={dark} p1Color={p1Color} p2Color={p2Color} onPress={() => openGame(game)} onRules={hasRules(game) ? () => openRules(game) : undefined} />
                  ))}
                </View>
              </FadingScrollView>
              {/* Left pane: the hero, then seat 1's button, centred as one group under the corner
            buttons' band. A later sibling of the grid, lifted while seat 1's menu is open so the menu
            paints over the tiles. box-none: only its controls claim taps. */}
              <View style={[styles.wideLeftPane, { left: layout.paddingLeft, width: layout.leftPaneWidth, paddingTop: HOME_TOP_BAND + insets.top, paddingBottom: 16 + insets.bottom }, pickerHost.openId !== null && styles.pickerOpen]}>
                <pack.HeroTitle words={pack.wordmark} color={fg} p1Color={p1Color} p2Color={p2Color} active={heroActive} fit={layout.heroFit} />
                <View style={styles.widePicker}>{picker}</View>
              </View>
            </>
          ) : (
            <FadingScrollView {...(tab && columnClamp)} style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: 56 + insets.top, paddingBottom: 24 + insets.bottom, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
              {pressAway}
              <pack.HeroTitle words={pack.wordmark} color={fg} p1Color={p1Color} p2Color={p2Color} active={heroActive} />

              {/* Who's playing: seat 1's button, the same one each loadout starts with. Lifted above the
            tiles while its menu is open, so the menu paints over them. */}
              <View style={[styles.picker, pickerHost.openId !== null && styles.pickerOpen]}>{picker}</View>

              {tabBar && <View style={styles.listWidth}>{tabBar}</View>}

              <View style={styles.list}>
                {pack.games.map((game) => (
                  <GameRow key={game.id} game={game} hidden={isHidden(tab, game)} dark={dark} p1Color={p1Color} p2Color={p2Color} previewRevealed={previewsRevealed} onPress={() => openGame(game)} onRules={hasRules(game) ? () => openRules(game) : undefined} />
                ))}
              </View>
            </FadingScrollView>
          )}

          <IconButton icon='trophy' iconColor={fg} size={24} style={[styles.corner, { top: 8 + insets.top, left: 8 + insets.left }]} onPress={() => router.push(STATS_HREF)} accessibilityLabel='Stats & Achievements' />
          <IconButton icon='cog' iconColor={fg} size={24} style={[styles.corner, { top: 8 + insets.top, right: 8 + insets.right }]} onPress={() => setSettingsOpen(true)} accessibilityLabel='Settings' />
          {RulesSheet && <RulesSheet visible onDismiss={() => setRulesGame(null)} />}
        </RulesHost>
      </View>

      {/* Home's How to Play row replays the pack's own cards (PackDefinition.guide); without them each
      tile's rules button shows its game's. */}
      <SettingsDialog visible={settingsOpen} onDismiss={() => setSettingsOpen(false)} onShowHowToPlay={pack.guide ? openPack : undefined} />
    </View>
  )
}

// Seat 1's button's popover id prefix (its menu is `${SEAT_ONE_PICKER}-profile`).
const SEAT_ONE_PICKER = 'home-p1'

// No placement of the pack's own: hud places the menu itself.
const noPickerAlign = () => undefined

// A game the tab picked doesn't include: kept mounted, out of the layout and out of a screen reader's way.
function isHidden(tab: HomeTab | null, game: PackGameDefinition): boolean {
  return !!tab && !tab.includes(game)
}

// iOS leaves a scroller's offset past the end when its content shrinks (React Native's own TODO, T190695447
// in RCTScrollViewComponentView.mm), so a switch to a shorter tab while scrolled down would leave blank space
// under the last game until the next drag. This pulls it back in, as Android and the web do by themselves.
// Spread onto one scroller (its ref and three events) only in a pack with tabs, the one way Home's content
// shrinks. The ref is a callback so a scroller mounted afresh (a switch between the column and the grid)
// starts from its real offset, 0, not the last one's.
function useClampOnShrink() {
  const view = useRef<ScrollView | null>(null)
  const sizes = useRef({ viewport: 0, offset: 0 })
  return useMemo(
    () => ({
      ref: (instance: ScrollView | null) => {
        view.current = instance
        sizes.current.offset = 0
      },
      onLayout: (e: LayoutChangeEvent) => {
        sizes.current.viewport = e.nativeEvent.layout.height
      },
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        sizes.current.offset = e.nativeEvent.contentOffset.y
      },
      onContentSizeChange: (_width: number, height: number) => {
        const end = Math.max(0, height - sizes.current.viewport)
        if (sizes.current.offset <= end) return
        sizes.current.offset = end
        view.current?.scrollTo({ y: end, animated: false })
      }
    }),
    []
  )
}

// Whether a tile has a rules button: a rules sheet or How to Play cards to show.
function hasRules(game: PackGameDefinition): boolean {
  return !!(game.Rules || game.guide)
}

// A game's rules sheet (GameDefinition.Rules) portals into a Paper host inside Home's frame, so it's
// laid out against Home's safe area. Only in a pack with one: a pack without keeps the frame as it was.
function RulesHost({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <Portal.Host>{children}</Portal.Host> : <>{children}</>
}

interface GameRowProps {
  game: PackGameDefinition
  // Not in the tab picked (PackDefinition.homeTabs).
  hidden: boolean
  dark: boolean
  p1Color: string
  p2Color: string
  // Whether Home has painted once, so a preview may draw (see previewsRevealed).
  previewRevealed: boolean
  onPress: () => void
  // Undefined for a game with no rules sheet and no How to Play cards: no rules button.
  onRules?: () => void
}

// One game on its own well: its icon at app-icon size (the art was drawn as an app icon), or its
// preview where it has one, its name and short blurb (up to ROW_BLURB_LINES lines), and a rules button at the end that shows its
// How to Play cards without opening the game.
// How many lines a row's blurb may wrap to before it's cut off.
export const ROW_BLURB_LINES = 3

function GameRow({ game, hidden, dark, p1Color, p2Color, previewRevealed, onPress, onRules }: GameRowProps) {
  const well = useWellColors()
  const GameIcon = game.icon
  return (
    // The rules button sits beside the row's own button, laid over its end, not inside it: a button
    // inside a button is invalid on the web.
    <View style={hidden ? styles.hidden : undefined}>
      <Pressable onPress={onPress} style={[styles.row, { backgroundColor: well.bg }]} accessibilityRole='button' accessibilityLabel={game.title}>
        {game.Preview ? <PreviewBox game={game} width={ROW_PREVIEW_WIDTH} revealed={previewRevealed} dark={dark} p1Color={p1Color} p2Color={p2Color} /> : <View style={[styles.rowIcon, { backgroundColor: dark ? ICON_DARK_BG : ICON_LIGHT_BG }]}>{GameIcon && <GameIcon size={ROW_ICON_SIZE} p1Color={p1Color} p2Color={p2Color} dark={dark} />}</View>}
        <View style={styles.rowText}>
          <Text variant='titleLarge' style={[styles.rowTitle, { color: well.fg }]} numberOfLines={1}>
            {game.title}
          </Text>
          {/* Three lines, as a tile allows: a narrow phone (an iPhone SE, a 411dp Android phone) wraps a
          55-character blurb onto a third line in the monospace, and two lines cut it off with an ellipsis */}
          <Text variant='bodyMedium' style={{ color: well.fgMuted }} numberOfLines={ROW_BLURB_LINES}>
            {game.blurb}
          </Text>
        </View>
      </Pressable>
      {onRules && (
        <Pressable onPress={onRules} style={styles.rulesButton} hitSlop={12} accessibilityRole='button' accessibilityLabel={`${game.title} rules`}>
          <Icon source='information-outline' size={22} color={well.fgMuted} />
        </Pressable>
      )}
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
function GameTile({ game, hidden, width, previewWidth, dark, p1Color, p2Color, previewRevealed, onPress, onRules }: GameTileProps) {
  const well = useWellColors()
  return (
    <View style={[{ width }, hidden && styles.hidden]}>
      <Pressable onPress={onPress} style={[styles.tile, { backgroundColor: well.bg }]} accessibilityRole='button' accessibilityLabel={game.title}>
        <PreviewBox game={game} width={previewWidth} revealed={previewRevealed} dark={dark} p1Color={p1Color} p2Color={p2Color} />
        <Text variant='titleMedium' style={[styles.rowTitle, { color: well.fg }]} numberOfLines={1}>
          {game.title}
        </Text>
        <Text variant='bodySmall' style={{ color: well.fgMuted }} numberOfLines={3}>
          {game.blurb}
        </Text>
      </Pressable>
      {onRules && (
        <Pressable onPress={onRules} style={styles.tileRulesButton} hitSlop={12} accessibilityRole='button' accessibilityLabel={`${game.title} rules`}>
          <Icon source='information-outline' size={20} color='#FFFFFF' />
        </Pressable>
      )}
    </View>
  )
}

interface PreviewBoxProps {
  game: PackGameDefinition
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
      {Preview
        ? revealed && <Preview width={width} height={height} p1Color={p1Color} p2Color={p2Color} dark={dark} />
        : GameIcon && (
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
  frame: {
    flex: 1
  },
  // The wide layout's tiles: wrapped rows of tiles the layout sizes to fill the pane's width.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HOME_GRID_GAP
  },
  // Out of the layout (a grid closes up around it) and hidden from screen readers.
  hidden: {
    display: 'none'
  },
  // Solitaire's list: one column, never wider than a phone's, centred on a wide screen.
  list: {
    gap: 14,
    maxWidth: 480,
    width: '100%'
  },
  // The list's width, for the tabs over it.
  listWidth: {
    maxWidth: 480,
    width: '100%'
  },
  picker: {
    alignItems: 'center'
  },
  pickerOpen: {
    zIndex: 100
  },
  // Seat 1's button on the theme's surface (over a backdrop), the same pill as the tiles' wells.
  pill: {
    borderRadius: 999
  },
  // Over the rows (and, wide, the grid), whose own stacking is unset, so a press on them reaches it on
  // the web too, and under the raised button and left pane, so the menu's rows stay pressable.
  pressAway: {
    zIndex: 5
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
  // SegmentedButtons' own rounding, so a surface behind it is the same pill (the stats screen's tabs).
  tabs: {
    borderRadius: 20
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
  },
  // The tabs over the grid, a little further from it than the tiles are from each other.
  wideTabs: {
    marginBottom: 16
  }
})
