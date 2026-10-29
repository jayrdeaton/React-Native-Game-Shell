import { useAutoPaperTheme } from '@rific/auto-paper'
import { BaseStatsScreen, type PopoverHost, PressAwayOverlay, RotatedFrame, usePopoverHost } from '@tastic/hud/chrome'
import { getOptionPickerContentSize, OptionPicker, type OptionPickerOption } from '@tastic/profile'
import { type ReactNode, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SegmentedButtons, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch } from 'react-redux'

import { useProfiles } from '../hooks/useProfiles'
import { safeBack } from '../navigation'
import { usePack } from '../PackContext'
import { GUEST_PLAYER_ID, type PackDefinition, type PackGameDefinition, type PackStatsTab } from '../types'

// Two tabs, as on Solitaire's stats screen: a page with every game's stats above the achievements
// would leave the achievements out of sight at the bottom. A pack's own tabs (PackDefinition.statsTabs)
// go between them.
const STATS = 'stats'
const ACHIEVEMENTS = 'achievements'
const TABS = [
  { value: STATS, label: 'Stats', icon: 'chart-box-outline' },
  { value: ACHIEVEMENTS, label: 'Achievements', icon: 'trophy-outline' }
]
// With a pack's own tabs, three or more don't fit a phone as equal segments with icons (Paper pads each
// label 16pt a side, and "Achievements" alone is ~109pt in Solitaire's font), so each segment is as wide
// as its label and the icons go: Solitaire's three take 309pt of a 375pt phone's 335pt row.
const LABEL_WIDE_TAB = { flexBasis: 'auto', flexGrow: 1, flexShrink: 1 } as const
const NO_PACK_TABS: readonly PackStatsTab[] = []

// The pickers' values for Everyone and All Games (neither is ever a profile or game id).
const EVERYONE = '__everyone__'
const ALL_GAMES = '__all__'

const PLAYER_PICKER_ID = 'stats-player'
const GAME_PICKER_ID = 'stats-game'

// Widest the column gets in the wide layout (a phone held sideways, a desktop window): a list of stat
// rows stretched across an 874pt-wide screen reads badly. Upright it's never capped.
const STATS_MAX_WIDTH = 640

// Every game's stats and achievements on one screen, filtered by player (Everyone, or one profile)
// and by game (All Games, or one), like Solitaire's. Each game keeps its own stats and its own
// achievements; this screen only shows them side by side. With two seats there's no one player to
// open on, so it opens on Everyone, and guests count only toward Everyone: two guests in one match
// can't be told apart. A pack for one player at a time (PackDefinition.guestStats) keeps a guest's
// stats under GUEST_PLAYER_ID, offers Guest in the picker and opens on whoever is in seat 1.
//
// Turned with the phone in hud's RotatedFrame: its insets remapped onto the frame's edges, the reset
// confirm portaled into a host inside the frame (so it's turned with it, at rotation 0), and the column
// capped in the wide layout.
export function StatsScreen() {
  const pickerHost = usePopoverHost()
  return (
    <StatsPressAway host={pickerHost}>
      <RotatedFrame rotatedSafeArea portalHost maxContentWidth={STATS_MAX_WIDTH}>
        <StatsContent pickerHost={pickerHost} />
      </RotatedFrame>
    </StatsPressAway>
  )
}

// Closes the pickers' open menu on a press anywhere on the screen that nothing else takes: the header
// (its title and blank space) and, in the wide layout, the frame either side of the capped column. The
// page's own press-away overlay only covers the scrolling content, which neither is part of. A press
// only reaches this when no control under the finger claims it, so the back button, the menu's rows and
// everything else still work.
function StatsPressAway({ host, children }: { host: PopoverHost; children: ReactNode }) {
  return (
    <View testID='stats-press-away' style={styles.screen} onStartShouldSetResponder={() => host.openId !== null} onResponderRelease={host.close}>
      {children}
    </View>
  )
}

// A pack whose Reset follows the game picker resets each game's own (GameDefinition.resetStats).
const useNoPackReset = () => null

// No placement of the pack's own: hud places the pickers' menus itself.
const noPickerAlign = () => undefined

function StatsContent({ pickerHost }: { pickerHost: PopoverHost }) {
  const pack = usePack()
  const { dark, colors } = useAutoPaperTheme()
  // Already remapped onto the turned frame's edges by RotatedFrame's rotatedSafeArea.
  const insets = useSafeAreaInsets()
  const { profiles, lastSelected } = useProfiles()
  const dispatch = useDispatch()
  const fg = pack.foreground ?? colors.onBackground

  const [tab, setTab] = useState<string>(STATS)
  const [gameId, setGameId] = useState<string>(ALL_GAMES)
  // Opens on whoever is in seat 1 (Guest for a guest) where the pack keeps a guest's stats, else on
  // Everyone. Self-heals to Everyone if the selected profile is deleted while this screen is mounted, and
  // from Guest once there is no profile (Everyone is then just the guest).
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => (pack.guestStats ? (lastSelected[1] ?? GUEST_PLAYER_ID) : null))
  const profileId = selectedProfileId && profiles.length > 0 && ((pack.guestStats && selectedProfileId === GUEST_PLAYER_ID) || profiles.some((p) => p.id === selectedProfileId)) ? selectedProfileId : null

  const games = gameId === ALL_GAMES ? pack.games : pack.games.filter((g) => g.id === gameId)
  const packTabs = pack.statsTabs ?? NO_PACK_TABS
  const packTab = packTabs.find((t) => t.value === tab)
  // One achievement list across the pack's games doesn't narrow to a game, so the game picker goes.
  const showGamePicker = !(tab === ACHIEVEMENTS && pack.AchievementList)

  const playerOptions = useMemo<OptionPickerOption<string>[]>(() => [{ value: EVERYONE, label: 'Everyone', icon: 'account-group' }, ...(pack.guestStats ? [{ value: GUEST_PLAYER_ID, label: 'Guest', icon: 'account-outline' }] : []), ...profiles.map((p) => ({ value: p.id, label: p.name, icon: 'account', color: pack.previewColor ? pack.previewColor(p.color, dark) : p.color }))], [profiles, pack, dark])
  const gameOptions = useMemo<OptionPickerOption<string>[]>(() => [{ value: ALL_GAMES, label: 'All Games', icon: 'view-grid-outline' }, ...pack.games.map((g) => ({ value: g.id, label: g.title }))], [pack.games])
  const tabButtons = useMemo(() => (packTabs.length > 0 ? [{ value: STATS, label: 'Stats' }, ...packTabs.map(({ value, label }) => ({ value, label })), { value: ACHIEVEMENTS, label: 'Achievements' }].map((button) => ({ ...button, style: LABEL_WIDE_TAB })) : TABS), [packTabs])
  const title = tab === STATS ? 'Stats' : tab === ACHIEVEMENTS ? 'Achievements' : (packTab?.label ?? '')

  // Reset: the pack's own (PackDefinition.resetStats) follows the player picker, one player's or
  // everyone's; otherwise it clears every player's stats and achievements in the games shown (one game,
  // or all of them). The pack never changes while it runs, so the same hook is called on every render.
  const usePackReset = pack.resetStats?.useReset ?? useNoPackReset
  const packReset = usePackReset()
  const reset = resetFor(pack, packReset, profileId, profiles, games, () => games.forEach((g) => g.resetStats && dispatch(g.resetStats())))

  // The pack's own placement for the pickers' menus (PackDefinition.usePickerAlign), sized from their rows.
  const usePickerAlign = pack.usePickerAlign ?? noPickerAlign
  const playerSize = getOptionPickerContentSize(playerOptions.length)
  const gameSize = getOptionPickerContentSize(gameOptions.length)
  const playerAlign = usePickerAlign(pickerHost.openId === PLAYER_PICKER_ID, playerSize.width, playerSize.height)
  const gameAlign = usePickerAlign(pickerHost.openId === GAME_PICKER_ID, gameSize.width, gameSize.height)

  // Over the pack's Backdrop the page is transparent, with its tabs and pickers on the theme's surface.
  const surface = pack.Backdrop ? { backgroundColor: colors.surface } : undefined
  const triggerStyle = pack.Backdrop ? [styles.pill, surface] : undefined
  const PackTabContent = packTab?.Content

  return (
    <BaseStatsScreen title={title} onBack={safeBack} insets={insets} onReset={reset.onReset} resetLabel={reset.label} resetConfirmTitle={reset.title} resetConfirmBody={reset.body} fg={pack.foreground} bg={pack.Backdrop ? 'transparent' : undefined} rotation={0}>
      {/* Inside the page, not before it: BaseStatsScreen paints an opaque full-screen container that
      would hide a tap catcher placed underneath it. Over the stat sections and under the open
      filters (pressAway's zIndex sits below filtersOpen's), so a tap anywhere on the page but a
      menu closes it. Off the page (the header, the margins) StatsPressAway closes it. */}
      <PressAwayOverlay active={pickerHost.openId !== null} onPress={pickerHost.close} style={styles.pressAway} />
      <SegmentedButtons value={tab} onValueChange={setTab} buttons={tabButtons} style={[styles.tabs, surface]} />

      {/* Takes a press on its own blank parts (the gap, an open menu's padding) while a menu is open, so
      it never reaches StatsPressAway. */}
      <View style={[styles.filters, pickerHost.openId !== null && styles.filtersOpen]} onStartShouldSetResponder={() => pickerHost.openId !== null}>
        {profiles.length > 0 && <OptionPicker id={PLAYER_PICKER_ID} host={pickerHost} options={playerOptions} value={profileId ?? EVERYONE} onChange={(value) => setSelectedProfileId(value === EVERYONE ? null : value)} color={colors.primary} dark={dark} icon={profileId ? 'account' : 'account-group'} alignOverride={playerAlign} triggerStyle={triggerStyle} />}
        {showGamePicker && <OptionPicker id={GAME_PICKER_ID} host={pickerHost} options={gameOptions} value={gameId} onChange={setGameId} color={colors.primary} dark={dark} icon='view-grid-outline' alignOverride={gameAlign} triggerStyle={triggerStyle} />}
      </View>

      {/* The pack's own section across its games (a calendar of play), first on the Stats tab: it
      follows both filters, so narrowed to one game it shows that game's part. */}
      {tab === STATS && pack.StatsSections && <pack.StatsSections profileId={profileId} gameId={gameId === ALL_GAMES ? null : gameId} />}

      {PackTabContent && <PackTabContent profileId={profileId} gameId={gameId === ALL_GAMES ? null : gameId} />}

      {tab === ACHIEVEMENTS && pack.AchievementList ? <pack.AchievementList profileId={profileId} /> : (tab === STATS || tab === ACHIEVEMENTS) && games.map((game) => <GameStats key={game.id} game={game} tab={tab} profileId={profileId} showTitle={games.length > 1 && pack.statsGameTitles !== false} titleColor={fg} />)}
    </BaseStatsScreen>
  )
}

// What the screen's Reset does and says: the pack's own, for the player picked (by name; Guest for a
// guest) or everyone, or each shown game's own.
function resetFor(pack: PackDefinition, packReset: ((profileId: string | null) => void) | null, profileId: string | null, profiles: readonly { id: string; name: string }[], games: readonly PackGameDefinition[], resetGames: () => void) {
  if (pack.resetStats && packReset) {
    const name = profileId === GUEST_PLAYER_ID ? 'Guest' : profileId ? (profiles.find((p) => p.id === profileId)?.name ?? null) : null
    return { onReset: () => packReset(profileId), ...pack.resetStats.labels(name) }
  }
  const scope = games.length === 1 ? games[0].title : 'every game'
  return { onReset: resetGames, label: games.length === 1 ? `Reset ${scope} Stats` : 'Reset All Stats', title: 'Reset Stats?', body: `Erases every player's stats and achievements in ${scope}. This cannot be undone.` }
}

// One game's part of the page: its own sections, under its name when more than one game is shown. A
// game with no achievement list of its own shows nothing on Achievements.
function GameStats({ game, tab, profileId, showTitle, titleColor }: { game: PackGameDefinition; tab: string; profileId: string | null; showTitle: boolean; titleColor: string }) {
  const { StatsSections, AchievementList } = game
  const Sections = tab === STATS ? StatsSections : AchievementList
  if (!Sections) return null
  return (
    <View style={styles.game}>
      {showTitle && (
        <Text variant='titleLarge' style={[styles.gameTitle, { color: titleColor }]}>
          {game.title}
        </Text>
      )}
      <Sections profileId={profileId} />
    </View>
  )
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center'
  },
  filtersOpen: {
    zIndex: 100
  },
  game: {
    gap: 16
  },
  gameTitle: {
    fontWeight: 'bold',
    marginTop: 8
  },
  // A picker's button on the theme's surface (over a backdrop), the same pill as Home's.
  pill: {
    borderRadius: 999
  },
  pressAway: {
    zIndex: 50
  },
  screen: {
    flex: 1
  },
  // SegmentedButtons' own rounding, so a surface behind it is the same pill.
  tabs: {
    borderRadius: 20
  }
})
