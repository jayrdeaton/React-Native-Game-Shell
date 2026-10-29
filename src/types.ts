import type { ThemeAppearance } from '@rific/auto-paper'
import type { ViewRotation } from '@tastic/core'
import type { MenuOption, PopoverHost } from '@tastic/hud'
import type { GuideStep } from '@tastic/hud/guide'
import type { FontSource } from 'expo-font'
import type { ComponentType, ReactNode } from 'react'
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

export interface GameDefinition {
  id: string
  title: string
  // One line under the tile's name on Home.
  blurb: string
  icon: ComponentType<GameIconProps>
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
  // Mounted at the app root for the game's lifetime (its stats and achievements context).
  Provider: ComponentType<{ children: ReactNode }>
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
  // The game's stats sections and its achievement list for the stats screen, for one profile
  // (null is Everyone).
  StatsSections: ComponentType<{ profileId: string | null }>
  AchievementList: ComponentType<{ profileId: string | null }>
  // Clears the game's stats and achievements (the stats screen's Reset).
  resetStats: () => Action
  guide: GameGuide
}

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

export interface PackDefinition {
  name: string
  // The Home wordmark's two lines.
  wordmark: readonly [string, string]
  // A seat's color pick for a profile is kept for this pack only; the seat button says so.
  colorCaption: string
  games: readonly GameDefinition[]
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
}
