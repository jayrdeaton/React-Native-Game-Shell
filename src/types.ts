import type { ThemeAppearance, ThemeSettings } from '@rific/auto-paper'
import type { ViewRotation } from '@tastic/core'
import type { AlignResult, PopoverHost } from '@tastic/hud/chrome'
import type { GuideStep } from '@tastic/hud/guide'
import type { MenuOption } from '@tastic/hud/lobby'
import type { FontSource } from 'expo-font'
import type { Stack } from 'expo-router'
import type { ComponentProps, ComponentType, ReactNode } from 'react'
import type { Action, Reducer } from 'redux'

import type { ShellState } from './redux/shellState'

// The two seats every game in a pack shares: seat 1 is whoever picked a player on Home, seat 2 is
// the CPU, a second person, or (only in a game with a solo mode) nobody at all.
export type Seat = 1 | 2

// Who sits in seat 2. One value for the whole pack (shell/redux/opponentSlice.ts), so the same two
// people stay set up from one game to the next.
export type SeatTwo = 'cpu' | 'person' | 'nobody'

// What a round is, from seat 2: a CPU opponent, two people on one device, or one player alone.
export type RoundMode = 'vsCpu' | 'twoPlayer' | 'solo'

export function roundModeFor(seatTwo: SeatTwo): RoundMode {
  return seatTwo === 'person' ? 'twoPlayer' : seatTwo === 'nobody' ? 'solo' : 'vsCpu'
}

// Seat 2's saved choice in one game (GameDefinition.seatTwo): a saved 'nobody' reads as the CPU in a
// game without a solo mode, and so does anything else the game doesn't offer. A game with no seat 2
// at all (no seatTwo) is always nobody, so it plays solo.
export function seatTwoFor(saved: SeatTwo, choices: readonly SeatTwo[] | undefined): SeatTwo {
  if (!choices) return 'nobody'
  return choices.includes(saved) ? saved : 'cpu'
}

// The players who take part in a round and have to press Ready: a CPU and nobody don't.
export function humanSeatsFor(mode: RoundMode): Seat[] {
  return mode === 'twoPlayer' ? [1, 2] : [1]
}

// What the loadout's match-options row is handed (see GameLoadout.options): the popover host it
// shares with seat 1's panel, the screen's rotation, and the colors the row draws with.
export interface LoadoutOptionsProps {
  host: PopoverHost
  rotation: ViewRotation
  accentColor: string
  mutedColor: string
  onAccentColor: string
  dark: boolean
  // Undefined while the loadout folds randomize/reset into its shared action band instead.
  onRandomize?: () => void
  onReset?: () => void
}

// The colors a seat's controls picker draws with: the loadout's tertiary accent, or the seat's own.
export interface SeatControlLook {
  accentColor: string
  seatColor: string
  mutedColor: string
  dark: boolean
  rotation: ViewRotation
}

// One game's part of the shared loadout (shell/screens/LoadoutScreen.tsx), built by the game's
// own useLoadout hook from its own saved settings.
export interface GameLoadout {
  // The settings snapshot committed as the round's when every human player readies up.
  roundSettings: object
  // The match-options row (board, rules, puck): the game's own controls, drawn under the shared
  // popover host so its menus open, elevate and close like every other loadout menu.
  options: (props: LoadoutOptionsProps) => ReactNode
  // The popover ids the options row opens, so the loadout can elevate the row while one is open.
  optionIds: readonly string[]
  randomize: () => void
  reset: () => void
  // A human seat's controls picker (shot style, keys), or undefined when the game has none.
  seatControl: (seat: Seat, host: PopoverHost, look: SeatControlLook) => ReactNode | undefined
  // Seat 2's CPU difficulty, saved per game since each game's CPU plays differently. Left out by a
  // game with no seat 2 (GameDefinition.seatTwo), or whose CPU has no levels: seat 2's menu then
  // offers one plain CPU.
  cpuDifficulty?: { value: string; options: MenuOption<string>[]; onChange: (value: string) => void }
}

// The id a guest's stats are kept under where a pack keeps them (PackDefinition.guestStats): the one
// player who isn't a profile, in a pack for one player at a time. Not seatPlayerKey's `guest:1`, which
// tells two guests at one table apart.
export const GUEST_PLAYER_ID = 'guest'

// What a game's How to Play cards are built from: the live settings (through the game's own
// selector, so the guide host never has to know their shape), how seat 2 is set up, and whether
// the device is touch-first.
export interface GameGuide {
  version: number
  selectVersionSeen: (state: ShellState) => number
  markSeen: (version: number) => Action
  // Returns a value compared with shallowEqual, so keep it a flat object of the settings read.
  selectInput: (state: ShellState) => object
  getSteps: (input: object, context: { touch: boolean; mode: RoundMode }) => GuideStep[]
}

// A game's icon on Home, drawn in the seats' colors (seat 1's from Home's button, seat 2's from
// whoever sits there), so it matches the players about to play, and in the theme where a part of it
// follows the board's own colors. An icon drawn as a light and dark pair of pictures instead is
// imageGameIcon's (components/imageGameIcon.tsx).
export interface GameIconProps {
  size: number
  p1Color: string
  p2Color: string
  dark: boolean
}

// A game's preview on Home (GameDefinition.Preview), drawn in a box of this size: what a deal or a
// board of the game looks like, in place of its icon. Every preview box has the same shape
// (PREVIEW_ASPECT in screens/homeLayout.ts); the seats' colors and the theme as for the icon.
export interface GamePreviewProps {
  width: number
  height: number
  p1Color: string
  p2Color: string
  dark: boolean
}

// The pack's own How to Play (PackDefinition.guide): cards that teach every game in the pack at once,
// shown on Home's first launch and replayed from Home's Settings. Its seen version is a key of the
// pack's own (hud's createGuideSlice), so a pack keeps whatever it already saved.
export interface PackGuide {
  version: number
  selectVersionSeen: (state: ShellState) => number
  markSeen: (version: number) => Action
  getSteps: (context: { touch: boolean }) => GuideStep[]
}

// A game's rules sheet (GameDefinition.Rules), opened from its tile's rules button on Home. It renders
// through a Paper Portal into a host Home mounts inside its turned frame, so it's already turned with it.
export interface GameRulesProps {
  visible: boolean
  onDismiss: () => void
}

export interface GameDefinition {
  id: string
  title: string
  // One line under the tile's name on Home.
  blurb: string
  // Left out only by a game with a Preview, which Home draws in its place.
  icon?: ComponentType<GameIconProps>
  // Drawn on Home in place of the icon, a frame after Home first paints (a preview is far more to
  // draw than an icon). While any game in the pack has one, Home lays its games out as tiles: rows
  // with the preview at their start, and a grid beside the hero on a wide screen. A game without one
  // keeps its icon there. What it draws is the game's own.
  Preview?: ComponentType<GamePreviewProps>
  // Seat 2's choices in this game, in menu order. 'nobody' only where the game has a solo mode.
  // Left out by a game for one player only: its loadout has no seat 2 button and every round is solo.
  seatTwo?: readonly SeatTwo[]
  // How the 2 Player loadout seats its players, to match where the game puts them: always face
  // to face (or only off the web, where a desktop window seats them side by side), and whether an
  // upside-down hold swaps who is at the bottom. Only read in 2 Player, so a game without 'person'
  // among its seatTwo choices can leave it out.
  twoPlayerSeats?: { faceToFaceOnWeb: boolean; followUpsideDown: boolean }
  // The store keys this game mounts (settings, achievements, guide), merged into the pack's store.
  reducers: Record<string, Reducer>
  // Mounted at the app root for the game's lifetime (its stats and achievements context). Left out by
  // a game whose stats live in the pack's own (PackDefinition.Provider).
  Provider?: ComponentType<{ children: ReactNode }>
  // Left out by a game with nothing to set up before it starts: Home opens its play screen
  // straight away (after its How to Play the first time), and its rule variants are rows in its
  // play screen's own Settings (SettingsDialog's children).
  useLoadout?: (mode: RoundMode) => GameLoadout
  PlayScreen: ComponentType
  // A cold launch drops the player back into this game's play screen if that's where they left the
  // app (they didn't back out of it first). For a game whose play screen saves and restores its own
  // board: the shell only remembers which game it was (redux/lastActiveGameSlice.ts). A match that
  // isn't saved (liveplay) shouldn't opt in, or a relaunch would open a fresh one.
  resumable?: boolean
  // The play screen keeps the status bar while the phone is held upright. Unset, the bar is hidden on
  // every play screen for the whole round, whatever the angle; set, it's hidden only while the
  // content is turned, as on every other screen.
  keepStatusBar?: boolean
  // The game's stats sections and its achievement list for the stats screen, for one profile
  // (null is Everyone).
  StatsSections: ComponentType<{ profileId: string | null }>
  // Left out by a game whose achievements are in the pack's one list (PackDefinition.AchievementList).
  AchievementList?: ComponentType<{ profileId: string | null }>
  // Clears the game's stats and achievements (the stats screen's Reset). Left out by a game whose stats
  // the pack resets itself (PackDefinition.resetStats).
  resetStats?: () => Action
  // The game's own How to Play cards: shown the first time its tile is picked, and from its rules
  // button and its loadout's Settings.
  guide: GameGuide
  // The rules sheet its tile's rules button opens, in place of its How to Play cards.
  Rules?: ComponentType<GameRulesProps>
}

// A game with no How to Play cards of its own, taught by the pack's own (PackDefinition.guide): its
// tile opens without cards the first time, and its rules button shows its Rules or nothing. Its own type
// rather than an optional `guide` on GameDefinition, so a pack's code that reads its own games' cards
// (DuelTastic's packGuides test) keeps compiling.
export type GuidelessGameDefinition = Omit<GameDefinition, 'guide'> & { guide?: undefined }

// Any game a pack holds: one with How to Play cards of its own, or one without.
export type PackGameDefinition = GameDefinition | GuidelessGameDefinition

// What Home hands the pack's hero (PackDefinition.HeroTitle).
export interface HeroTitleProps {
  // The pack's wordmark (see PackDefinition.wordmark).
  words: readonly [string, string]
  color: string
  // The live theme's primary/secondary: whatever the players actually picked, not a fixed pair, so
  // an accent in each player's color matches their real in-game color.
  p1Color: string
  p2Color: string
  // False while another screen covers Home or the app is in the background: a hero that animates
  // forever pauses then.
  active: boolean
  // The box the hero has to fit in, when Home gives it one: beside the game grid on a wide screen
  // (a pack whose games have previews, see GameDefinition.Preview), where the hero shares a narrow
  // pane with seat 1's button. Undefined is the full width of a phone held upright, its natural size.
  fit?: { width: number; height: number }
}

// What the stats screen hands a pack's own section (PackDefinition.StatsSections): its two filters,
// the player (null is Everyone) and the game (null is All Games).
export interface PackStatsSectionsProps {
  profileId: string | null
  gameId: string | null
}

// The stack's screen options (expo-router's Stack), as an object: what PackDefinition.useScreenOptions
// returns.
export type StackScreenOptions = Exclude<NonNullable<ComponentProps<typeof Stack>['screenOptions']>, (...args: never[]) => unknown>

// The two sounds feedback-press plays on every button press (PackDefinition.useFeedbackSounds): a tap,
// and a refused or notifying press.
export interface FeedbackSounds {
  selection: () => void
  notification: () => void
}

// A tab of the pack's own on the stats screen (PackDefinition.statsTabs), between Stats and
// Achievements, handed the screen's two filters.
export interface PackStatsTab {
  value: string
  label: string
  Content: ComponentType<PackStatsSectionsProps>
}

// The stats screen's Reset, where the pack resets stats itself (PackDefinition.resetStats). It follows
// the player picker: one player's (a profile id, or GUEST_PLAYER_ID), or everyone's (null).
export interface PackStatsReset {
  useReset: () => (profileId: string | null) => void
  // The button, the confirm's title and its body, for a player's name (Guest for a guest) or null for
  // Everyone.
  labels: (name: string | null) => { label: string; title: string; body: string }
}

export interface PackDefinition {
  name: string
  // The Home wordmark's two lines.
  wordmark: readonly [string, string]
  // A seat's color pick for a profile is kept for this pack only; the seat button says so.
  colorCaption: string
  games: readonly PackGameDefinition[]
  // Player 1's and player 2's own default colors. They seed the theme's primary and secondary (the
  // tertiary is derived from them, see shellState.ts) and the guest and CPU colors a fresh install
  // starts with (seatColorsSlice.ts), so a fresh install's live theme and its remembered colors agree.
  // Also what @tastic/profile's avoidSeatColorClash moves seat 2 to when both seats land on one color.
  seatColors: Record<Seat, string>
  // The theme's appearance on a fresh install ('system' when unset). Still changeable in Settings.
  appearance?: ThemeAppearance
  // Home's wordmark, drawn by the pack: the shell only says where and in which colors.
  HeroTitle: ComponentType<HeroTitleProps>
  // Fonts the pack's own art needs (its hero's display face), loaded beside the icon font behind
  // the splash screen's 'fonts' gate (components/Fonts.tsx).
  fonts?: Record<string, FontSource>
  // The typeface every Paper text variant is set in (auto-paper's Provider). Unset is Paper's own.
  fontFamily?: string
  // The version label in Settings: src/constants/release.ts's otaVersion, which the OTA tooling bumps.
  otaVersion: number
  // The pack's own Settings sections (how cards look, how play is helped along), in every Settings
  // dialog under the shell's own rows and any a play screen adds. Their values live in `reducers`.
  SettingsSections?: ComponentType
  // Store keys of the pack's own, beside the shell's and each game's (GameDefinition.reducers): what
  // SettingsSections saves, or anything else that belongs to every game. Never a key the shell or a
  // game already mounts.
  reducers?: Record<string, Reducer>
  // A section of the pack's own at the top of the stats screen's Stats tab, across its games (a
  // calendar of play), above each game's own StatsSections. It follows the screen's two filters.
  StatsSections?: ComponentType<PackStatsSectionsProps>

  // A table drawn once behind the whole stack (a felt), seen through every screen: the stack's own
  // layers go transparent, and Home, the stats screen and Profiles draw on it in `foreground`.
  Backdrop?: ComponentType
  // The text and icon color of what Home, the stats screen and Profiles draw straight on the screen's
  // background (the hero, the corner buttons, headers). Unset is black or white with the theme.
  foreground?: string
  // Mounted once around How to Play and the stack, inside the store, Theme, ProfilesProvider and every
  // game's Provider: a context of the pack's own (one stats context across its games).
  Provider?: ComponentType<{ children: ReactNode }>
  // Merged into the stack's screen options after the shell's own (a status bar style, a crossfade).
  useScreenOptions?: () => StackScreenOptions
  // The two sounds every button plays, in place of the shell's own.
  useFeedbackSounds?: () => FeedbackSounds
  // The pack's own toaster, drawn in a frame turned with the phone (with the safe-area insets turned
  // onto the frame's edges) in place of the shell's. It renders inline: the toast provider is given no
  // Paper, so nothing portals it out of the frame.
  Toaster?: ComponentType
  // Every screen reads upright while the software keyboard is up (@tastic/core's OrientationProvider),
  // for typing a profile's name with the phone sideways.
  portraitWhileKeyboard?: boolean
  // false leaves Edge Guard out of Settings (a pack with no edge controls and no Edge Guard plugin).
  edgeGuard?: boolean
  // The theme seat 1's color makes (a muted seed with a harmony), applied whenever the seats' colors or
  // dark mode change and as a fresh install's theme, in place of a triad of the raw seat colors. With it,
  // each seat's color is read from the seat colors rather than from the theme.
  seatTheme?: (colors: Record<Seat, string>, dark: boolean) => Pick<ThemeSettings, 'color' | 'harmony'>
  // How every profile color is drawn (the button's chip, the swatches, each ProfileChip): mounted as
  // @tastic/profile's ProfileColorProvider. The saved colors stay as picked.
  previewColor?: (hex: string, dark: boolean) => string
  // The pack's own How to Play: shown on Home's first launch (held back while a cold launch resumes a
  // game) and from Home's Settings, never in a play screen.
  guide?: PackGuide
  // Seat 1's button: the chip's label for a guest (default 'P1') and the guest row's in its menu
  // (default @tastic/profile's).
  guestLabel?: string
  nullLabel?: string
  // The stats screen keeps a guest's stats under GUEST_PLAYER_ID: a Guest entry in the player picker
  // once a profile exists, and the screen opens on whoever is in seat 1.
  guestStats?: boolean
  // One achievement list across the pack's games, on the Achievements tab (the game picker hidden there).
  AchievementList?: ComponentType<{ profileId: string | null }>
  // Tabs of the pack's own between Stats and Achievements.
  statsTabs?: readonly PackStatsTab[]
  // The stats screen's Reset, following the player picker rather than the game picker.
  resetStats?: PackStatsReset
  // false leaves out each game's name over its sections on All Games, where its sections name it.
  statsGameTitles?: boolean
  // A new profile's starting color on Profiles. Unset is auto-paper's first swatch.
  newProfileColor?: string
  // Where a picker's menu opens (its alignOverride) on Home (seat 1's button), the stats screen (its two
  // pickers) and Profiles (a profile's color swatch). hud's own placement measures a turned button
  // against the upright window, so with the phone held sideways it can pick the side with no room and
  // run the menu off the screen (Solitaire's useFrameAutoAlign places it in the turned frame instead).
  // `open` is whether this picker's menu is open, the size is its content's, and `maxContentWidth` is a
  // capped column's width the menu stays inside (Profiles' roster). Unset is hud's own placement.
  usePickerAlign?: PickerAlign
}

// What PackDefinition.usePickerAlign is: a hook, called on every render of the screen it serves.
export type PickerAlign = (open: boolean, contentWidth: number, contentHeight: number, options?: { maxContentWidth?: number }) => AlignResult
