# @tastic/shell

The app around a pack of React Native games: Home, each game's loadout, the stats screen, Profiles
and Settings, the pack's one Redux store, and every provider the games run under. An app hands it one
`PackDefinition` (its name, its games, its seat colors, its hero) and keeps only its games, its hero
and a handful of thin expo-router routes. Two-seat duels and games for one player alike: a game can
leave out its seat 2 and its loadout, come back on a cold launch, and show a preview on Home, and a
pack for one player at a time (CardTastic, Solitaire renamed) can lay its own table, theme, toaster,
How to Play and stats tabs into the same screens.

Built from the shell PuckTastic and DuelTastic each carried in `src/shell/` (made identical on
2026-10-28), so the packs and the next ones (CardTastic) share one copy. Part of the `@tastic`
package ecosystem, on [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud),
[`@tastic/profile`](https://github.com/jayrdeaton/react-native-game-profile) and
[`@tastic/core`](https://github.com/jayrdeaton/react-native-game-core).

## What's in here

- **`RootLayout`**: the root of the app (gesture root, safe area, fonts, Redux and its persist gate,
  the theme, profiles, every game's own provider, the splash gates,
  toasts, How to Play, the OTA update dialog) around expo-router's stack. The stack follows the app's
  own theme, not the phone's light or dark appearance: the status bar's text, the root window and the
  navigation theme's background (what shows in a sliding screen's corners during a push or pop).
- **Screens** for the routes: `HomeScreen` (the pack's hero, seat 1's button, a row per game, or a
  grid of preview tiles on a wide screen, split into tabs where the pack has them), `LoadoutRoute` and `PlayRoute` (`loadout/[game]`,
  `play/[game]`), `ProfilesRoute` and `StatsScreen`.
- **The store**: `createPackStore(pack, { keyPrefix, migrate, blacklist, serializableIgnoredPaths,
  middleware })` builds one persisted store from the shell's keys (theme, haptics, sound, Keep Awake,
  profiles, seat selection, seat colors, app settings, seat 2, the never-saved `liveplay`, and
  `lastActiveGame` in a pack with a resumable game), the pack's own `reducers` and every game's own
  `reducers`. Each of the shell's keys exports its reducer, actions and defaults, and
  `createShellReducers` builds them all (see [The store's keys](#the-stores-keys)).
- **What a game builds on**: `createPlayerSettings` and `seatPlayerKey` (its settings and controls,
  kept per player), `createGameStats` (its stats and achievements), `createGameGuideSlice` (which
  version of its How to Play a player has seen), `onProfileRemoved` (forget a deleted profile),
  `usePack` and `usePackGame`, `useActiveRound`, `useProfiles`, `useSeatColors`, `useOpponent`,
  `useAppSettings`, `useGameGuide`, `useAtComputer`, `roundModeFor`, `humanSeatsFor`, `seatTwoFor`,
  `MatchChips`, `SettingsDialog`, `safeBack`, `useBackBlock` (Android's and the browser's back
  mid-match open Quit Match?) and `imageGameIcon` (see [Hooks and helpers](#hooks-and-helpers)).

## Install

```bash
npm install @tastic/shell
```

The shell is an Expo Router app's own code, so it needs every peer below in the app's `dependencies`.

## Use

`src/pack.ts` describes the pack and builds its store:

```ts
import { createPackStore, type GameDefinition, type PackDefinition } from '@tastic/shell'

export const games: readonly GameDefinition[] = [lightCycles, turf, tag, snake]

export const pack: PackDefinition = {
  name: 'DuelTastic',
  wordmark: ['Duel', 'Tastic'],
  colorCaption: 'DuelTastic only',
  games,
  seatColors: { 1: '#2196f3', 2: '#f44336' },
  appearance: 'dark',
  HeroTitle,
  fonts: HERO_FONTS,
  fontFamily: MONO_FONT,
  otaVersion: release.otaVersion
}

// Never change the prefix or a key once the pack ships: every player would start over.
export const { store, persistor } = createPackStore(pack, { keyPrefix: 'dueltastic:' })
```

and `src/app/` holds six thin routes:

```tsx
// _layout.tsx
export default function Layout() {
  return <RootLayout pack={pack} store={store} persistor={persistor} />
}

// index.tsx, profiles.tsx, stats.tsx
export default HomeScreen // ProfilesRoute, StatsScreen

// loadout/[game].tsx and play/[game].tsx (PlayRoute): the web build is a static export
export function generateStaticParams() {
  return games.map((g) => ({ game: g.id }))
}
export default LoadoutRoute
```

The game id comes second in a route, never first: expo-router strips the web build's base path off
the front of an in-app link, so a route starting with a game id equal to the base path
(`boxhockey/loadout` under `/boxhockey`) would lose that segment.

### `PackDefinition`

| Field | |
| --- | --- |
| `name`, `wordmark`, `colorCaption` | The pack's name, Home's two-line wordmark, and the caption under a seat's Color row while a profile is in it ("DuelTastic only"). |
| `games` | Every `GameDefinition`, in Home's order. |
| `seatColors` | Player 1's and player 2's default colors: the theme's primary and secondary, and a fresh install's guest and CPU colors. |
| `appearance?` | The theme's appearance on a fresh install (`'system'` when unset). |
| `HeroTitle` | Home's wordmark, drawn by the pack (`HeroTitleProps`: `words`, `color`, `p1Color`, `p2Color`, `active`, false while Home is covered or the app is in the background, and `fit`, the box it has beside the preview grid on a wide screen, undefined at its own size). |
| `fonts?` | Fonts the pack's own art needs, loaded behind the splash screen beside the icon font. |
| `fontFamily?` | The typeface on every Paper text variant. Unset is Paper's own. |
| `otaVersion` | The version label in Settings. |
| `useSettingsRules?` | A hook returning what goes first in every Settings dialog, above the shell's rows: the rules of the game it's opened in. Null where there's nothing (Home). |
| `SettingsSections?` | The pack's own Settings sections, in every Settings dialog, under the shell's rows and any a play screen adds. |
| `reducers?` | The pack's own store keys (what `SettingsSections` saves), beside the shell's and the games'. Never a key either already mounts. |
| `StatsSections?` | A section across the pack's games (a calendar of play), first on the stats screen's Stats tab, handed its two filters (`PackStatsSectionsProps`: `profileId`, null for Everyone, and `gameId`, null for All Games). |

For a pack for one player at a time (CardTastic, from Solitaire), each optional and off when unset, so
PuckTastic and DuelTastic draw what they always did:

| Field | |
| --- | --- |
| `Backdrop?` | A table drawn once behind the whole stack (Solitaire's felt). The stack's two layers go transparent (the screens' `contentStyle` and the navigation theme's `colors.background`, which React Navigation paints around every screen), the root window stays dark so light mode doesn't flash white on a push, Android's push and pop crossfade (its default holds the outgoing screen opaque), and Home, each loadout, the stats screen and Profiles draw transparent, with their buttons and tabs on the theme's surface (a loadout's Ready buttons too, filled with the seat's color once ready). |
| `foreground?` | The color of what those screens draw straight on the background (the hero, the corner buttons, headers), and at half strength a loadout's muted options. Unset is black or white with the theme. |
| `Provider?` | Mounted once around How to Play and the stack, inside the store, the theme, profiles and every game's `Provider` (one stats context across the pack's games). |
| `useScreenOptions?` | A hook returning stack screen options (`StackScreenOptions`), merged after the shell's own (a status bar style of the pack's own, Reduce Motion's crossfade). The shell's already follow the app's theme, and stay dark over a `Backdrop`. |
| `useFeedbackSounds?` | A hook returning the two sounds every button plays (`FeedbackSounds`: `selection`, `notification`), in place of the shell's two wavs. |
| `Toaster?` | The pack's own toaster, drawn in a frame over the whole app (inside the safe area) in place of the shell's. The toast provider is given no Paper, so nothing portals it out of the frame. |
| `edgeGuard?` | `false` leaves Edge Guard out of Settings (no edge controls, no Edge Guard plugin), and out of the play screens' options on Android. |
| `seatTheme?` | `(colors, dark) => ({ color, harmony })`: the theme the seats' colors make (a muted seed from seat 1's color), applied whenever they or dark mode change and as a fresh install's theme, in place of a triad of the raw colors. With it, `useSeatColors` reads each seat's color from where it's remembered (`seatColors`) rather than from the theme. |
| `previewColor?` | `(hex, dark) => string`: how every profile color is drawn (the seat buttons and their swatches on Home and in the loadouts, a loadout's Ready button and seat controls, each `ProfileChip`), mounted as `@tastic/profile`'s `ProfileColorProvider`. Saved colors stay as picked. |
| `guide?` | The pack's own How to Play (`PackGuide`: `version`, `selectVersionSeen`, `markSeen`, `getSteps({ touch })`), for cards that teach every game at once: shown on Home's first launch (never while a cold launch resumes a game), replayed from Home's Settings, never in a play screen. Its seen version is a key of the pack's own. |
| `guestLabel?`, `nullLabel?` | Seat 1's button on Home and in every loadout: the chip's label for a guest (default `'P1'`) and the guest row's in its menu. A 2 Player loadout's seat 2 button takes the same two (its guest default `'P2'`). |
| `guestStats?` | The stats screen keeps a guest's stats under `GUEST_PLAYER_ID` (`'guest'`): a Guest entry between Everyone and the profiles once a profile exists, and the screen opens on seat 1's player. Without it the screen opens on Everyone, where guests count. |
| `AchievementList?` | One achievement list across the pack's games, on the Achievements tab, with the game picker hidden there. |
| `statsTabs?` | Tabs of the pack's own between Stats and Achievements (`PackStatsTab`: `value`, `label`, `Content`, handed both filters). With them every tab is as wide as its label, with no icons, so three fit a phone. |
| `resetStats?` | The stats screen's Reset where the pack resets stats itself (`PackStatsReset`: a `useReset` hook returning `(profileId) => void`, and the `labels` for a player's name, Guest, or `null` for Everyone). It follows the player picker, not the game picker. |
| `statsGameTitles?` | `false` leaves each game's name off its sections on All Games, where the sections name it. |
| `newProfileColor?` | A new profile's starting color on Profiles. Unset is auto-paper's first swatch. |
| `usePickerAlign?` | `(open, contentWidth, contentHeight, options?) => AlignResult` (`PickerAlign`), a hook: where seat 1's menu on Home, both seat buttons' menus in a loadout's one-human row (2 Player keeps each menu in its own player's half), the stats screen's two pickers and a profile's color swatch open. It was added because hud's own placement measured a button in a frame turned by `@tastic/core`'s drawn rotation against the upright window (Solitaire's `useFrameAutoAlign`); nothing turns since core 0.15, so a pack may no longer need one. Profiles passes `{ maxContentWidth: 640 }`, its roster's column. Unset is hud's placement. |
| `homeTabs?` | Tabs splitting Home's games (`HomeTab`: a `label`, and `includes(game)`, which of the pack's games it shows, in the pack's order): a switch under seat 1's button, or over the grid on a wide screen, on the theme's surface over a `Backdrop`, showing one tab's games at a time. It opens on the first tab and keeps the one picked while Home is covered or the window changes. The other tabs' games stay mounted, hidden, so a switch draws nothing new. A game no tab includes isn't on Home. Unset, or a single tab, shows every game with no switch. Solitaire's: Solitaire (no `seatTwo`) and Two Player. |

### `GameDefinition`

Each game is one object: its `id`, `title`, `blurb` and `icon` (a component drawn in the seats'
colors, handed `GameIconProps`: `size`, `p1Color`, `p2Color` and `dark`; or `imageGameIcon({ light,
dark })` for a light and dark pair of pictures), its seat 2 choices (`seatTwo`, each a `SeatTwo`: `'cpu'`,
`'person'`, `'nobody'`), whether 2 Player seats its players side by side
at a computer (`sideBySideAtComputer`) and in a wide window (`sideBySideWhenWide`), the store `reducers` it mounts, its root `Provider`, its `useLoadout(mode)`, its
`PlayScreen`, its `StatsSections` and `AchievementList`, `resetStats`, and its How to Play `guide`.
See `src/types.ts` for every field.

What a game can leave out or add, each optional, so a two-seat game sets none of them:

| Field | |
| --- | --- |
| no `seatTwo` (nor `sideBySideWhenWide`) | A game for one player: its loadout has no opponent button, every round is solo (`useActiveRound` falls back to `'solo'`), and its How to Play describes a solo round. |
| no `'cpu'` in `seatTwo` | A game with no CPU, such as `['nobody', 'person']`. Seat 2's saved choice is the whole pack's and starts on the CPU, so `seatTwoFor` reads a choice a game doesn't offer as the CPU where it has one, and as its first choice where it has none: a fresh install opens this game's loadout on that choice, its How to Play describes it, and `useActiveRound` falls back to it. The saved choice only changes when player 1 picks another. |
| no `useLoadout` | Nothing to set up first: Home opens its play screen straight away, after its How to Play the first time, and a link to its loadout plays it. Its rule variants go in its play screen's Settings: `<SettingsDialog>` takes `children`. |
| no `cpuDifficulty` (in `GameLoadout`) | A CPU with no levels: player 1's opponent menu offers one plain CPU. |
| `resumable` | A cold launch drops the player back into its play screen if they left the app there rather than backing out of it. The shell remembers only which game (`lastActiveGame`); the game saves and restores its own board. |
| `Preview` | Drawn on Home in place of the icon (`GamePreviewProps`: `width`, `height`, the seats' colors, `dark`), in a box of `PREVIEW_ASPECT` (360:200), a frame after Home first paints. While any game has one, Home shows tiles: rows upright, and on a wide screen a grid beside the hero and seat 1's button. A game without one keeps its icon. |
| no `icon` | Only with a `Preview`, which Home draws in its place. |
| no `Provider` | A game whose stats live in the pack's own `Provider`. |
| no `AchievementList`, no `resetStats` | A game whose achievements are in the pack's one list, and whose stats the pack resets (`PackDefinition.AchievementList`, `resetStats`). |
| no `guide` (`GuidelessGameDefinition`) | A game the pack's own `guide` teaches: its tile opens without cards the first time. A `GameDefinition` keeps `guide` required, so a pack's code that reads its games' cards keeps compiling; `PackDefinition.games` takes either (`PackGameDefinition`). |
| `Rules` | Its tile's rules button opens this sheet (`GameRulesProps`: `visible`, `onDismiss`) in place of its How to Play. It portals into a host inside Home's frame, so it's laid out against Home's safe area. |
| `keepStatusBar` | Its play screen keeps the status bar. Unset, every play screen hides it for the whole round. |

A game never imports another game, and the shell never imports a game: games reach the shell only
through the pack (`usePack()`).

`useLoadout(mode)` returns the game's part of the loadout (`GameLoadout`), built from its own saved
settings for the round `mode` seat 2 makes:

| Field | |
| --- | --- |
| `roundSettings` | The settings the round plays with, committed (liveplay's `activeRound.settings`) once every human seat is Ready. The play screen reads them back with `useActiveRound`. |
| `options` | `(props: LoadoutOptionsProps) => ReactNode`: the match-options row (board, rules, puck), drawn under the loadout's popover `host` in its colors (`accentColor`, `mutedColor`, `onAccentColor`, `dark`). `onRandomize` and `onReset` are undefined while the loadout folds them into its shared action band. |
| `optionIds` | The popover ids the options row opens, so the loadout lifts the row while one is open. |
| `randomize`, `reset` | The loadout's randomize and reset buttons. |
| `seatControl` | `(seat, host, look) => ReactNode \| undefined`: a human seat's controls picker (shot style, keys) in `look`'s colors (`SeatControlLook`: `accentColor`, `seatColor`, `mutedColor`, `dark`), or undefined where the game has none. |
| `cpuDifficulty?` | The CPU's levels (`{ value, options, onChange }`, the options hud's `MenuOption`s), saved per game, in player 1's opponent menu. Left out by a game with no seat 2, or whose CPU has no levels. |

A game's `guide` (`GameGuide`) builds its How to Play cards from the live settings: `version`,
`selectVersionSeen(state)` and `markSeen(version)` (from `createGameGuideSlice`), `selectInput(state)`
(the settings the cards read, as a flat object, compared shallowly) and `getSteps(input, { touch,
mode })`, hud's `GuideStep`s for a touch-first device or not and the round (`RoundMode`) seat 2's
saved choice makes in this game (`seatTwoFor`).

### `createPackStore`

`createPackStore(pack, config)` returns `{ store, persistor }` (`PackStore` is the store's type). It
reads only the pack's `seatColors`, `appearance`, `seatTheme`, `reducers` and its games' `reducers` and
`resumable` (`PackStoreSource`). `config` is `PackStoreConfig`:

| Field | |
| --- | --- |
| `keyPrefix` | Where the root entry is saved (`<keyPrefix>root`). Never change it once the pack ships. |
| `migrate?` | redux-persist's migrate, run on the saved store before it rehydrates. |
| `blacklist?` | Keys left out of the root entry beside `liveplay`: keys that persist themselves (Solitaire's saved boards, one entry per game, since Android can't read an entry back past ~2MB). |
| `serializableIgnoredPaths?` | State paths the dev serializability check skips (keys too big to walk on every action). |
| `middleware?` | The pack's own middleware, after the shell's (Solitaire's settings that follow the player). |

### The store's keys

`createPackStore` mounts these beside the pack's and the games' own keys.
`createShellReducers({ seatColors, appearance, seatTheme })` builds the same set (all but
`lastActiveGame`), and `ShellState` is their state, what a game's selectors read. Each key's reducer,
actions and defaults are exported for a pack's own code and its tests.

| Key | |
| --- | --- |
| `theme` | auto-paper's theme, starting from the pack's `appearance` and a triad of its `seatColors` (or what `seatTheme` makes of them). |
| `haptic`, `sound` | feedback-press's settings. Sound starts off in a development build. |
| `keepAwake` | `@rific/core`'s Keep Awake setting. |
| `profiles` | `@tastic/profile`'s roster, kept in step with the shared one (see `useProfiles`). |
| `profileSelection` | Which profile each seat last picked, null for a guest: `profileSelectionReducer`, starting from `defaultProfileSelectionState` (`{ 1: null, 2: null }`). `profileSelectionActions`: `select({ seat, profileId })` (a profile already in the other seat swaps the two), `clearProfile(profileId)` and `pruneToRoster(profileIds)`. Never shared with a sibling app. |
| `seatColors` | Each seat's remembered color: `createSeatColorsReducer(seatColors)`, starting from `defaultSeatColorsState(seatColors)` (each guest seat on its own seat color, the CPU on seat 2's, no profile picks). `seatColorsActions`: `setLastGuestColor({ seat, color })`, `setLastCpuColor(color)` and `setProfileColor({ profile, color })`, a profile's pick in this pack (null, or the profile's own color, drops it). |
| `appSettings` | Settings for the whole pack (`AppSettings`): `deferBottomEdgeGestures`, Edge Guard's opt-in, false in `DEFAULT_APP_SETTINGS`. `appSettingsReducer`, and `appSettingsActions.initialize(patch)`, which merges. Read and written with `useAppSettings`. |
| `opponent` | Who sits in seat 2 for the whole pack (`OpponentState`: `seatTwo`), the CPU in `DEFAULT_OPPONENT`. `opponentReducer`, and `opponentActions`: `setSeatTwo(seatTwo)` and `initialize(state)`. Read and written with `useOpponent`. |
| `liveplay` | This round, never saved (`LiveplaySliceState`): `activelyPlaying` (false) and `activeRound` (null until a loadout commits one; `ActiveRound`: `game`, `mode`, `settings`). `liveplayReducer`, and `liveplayActions`: `setActivelyPlaying(on)`, `setActiveRound(round)` and `initialize(state)`. A play screen sets `activelyPlaying` while a round is live and unpaused, and back to false as it unmounts: Edge Guard, when the player has turned it on, only guards while it's true. |
| `lastActiveGame` | Only in a pack with a `resumable` game: the play screen a cold launch resumes. Not exported. |

### Building a game's keys

- `createPlayerSettings({ id, defaults, distinctControls })`: a game's loadout settings, kept per
  player. `defaults` holds every setting, with `controlScheme` (`{ 1, 2 }`) for each seat's controls.
  The match settings follow seat 1's player (only what they changed is saved, so a setting added later
  starts at its default), and each seat's controls follow the player in it (seat 2's only for a
  person). `distinctControls`, optional, lists every control in menu order where the two seats can't
  share one (a desktop key cluster): when both would get the same, seat 2 shows and plays the first
  one seat 1 isn't using, never saved. It returns `reducers` (`<id>Settings` and `<id>Controls`, for
  the game's own `reducers`), `settingsReducer`, `controlsReducer`, `actions` (`patch(player,
  changes)`, `setControl(player, control)`), `compose(saved, controls, selection, seatTwoIsPerson)`,
  `select(state)` (the same settings read straight from the store, as How to Play reads them) and
  `useSettings()` (`{ settings, setSettings(patch) }`, the loadout's one write path). A deleted
  profile's settings and controls go with it.
- `seatPlayerKey(selection, seat)`: who a seat's saved settings belong to: the profile picked for it,
  or that seat's guest (`'guest:1'`, `'guest:2'`).
- `createGameStats({ key, defaultStats, isValidStats, catalog, getProfileStatsView })`: one game's
  stats and achievements, on `@tastic/achievements`' `createAchievementsSlice` under the store key
  `key`. The stats keep a `profiles` bucket per profile beside the device-wide totals, and
  `getProfileStatsView(bucket)` shows a bucket in the same shape, so every achievement in `catalog`
  reads either. `isValidStats` is optional. It returns `reducer` (a deleted profile takes its bucket
  and unlocks with it), `actions`, `Provider` (the game's `Provider`) and `useStats()`: `stats`,
  `unlockedAchievements`, `record(update, profileIds)`, which applies a result and returns what it
  unlocked (`RecordResult`: `device`, and `profiles` by seat for each seat the optional `profileIds`
  maps to a profile), and
  `resetAll()`.
- `createGameGuideSlice(mountKey)`: which version of a game's How to Play a player has finished or
  skipped, under the game's own key: `{ actions: { markSeen }, reducer, selectVersionSeen }`, for its
  `GameGuide`. Unlike hud's `createGuideSlice`, a saved store without the key reads as not seen, so a
  game added to a pack in an update shows its cards to everyone.
- `onProfileRemoved(reducer, forget)`: wraps a game's reducer so it runs `forget(state, profileId)`
  when the Profiles screen deletes a profile (not when a sibling app's roster sync drops one).
  `forgetProfileAchievements(dropStats)` is a `forget` for a `createAchievementsSlice` state: it drops
  the profile's unlocks, and its stats through `dropStats(stats, profileId)`.

### Hooks and helpers

`RootLayout` mounts every provider these read.

- `usePack()`: the `PackDefinition`. `usePackGame(id)`: one of its games, or undefined for an id the
  pack doesn't have. `PackProvider` (`pack`, `children`) provides them.
- `useProfiles()`: `profiles`, `lastSelected` (each seat's profile id, or null), `loaded`,
  `createProfile(input)`, `updateProfile(id, patch)`, `deleteProfile(id)` (which also clears it from
  any seat) and `selectProfile(seat, profileId)`. Its `ProfilesProvider` reconciles the saved roster
  with `@tastic/profile`'s shared one in the App Group `group.com.infinitetoken.tastic` once at launch
  (`loaded` turns true then, and the splash screen waits for it) and keeps the two in step.
- `useSeatColors(p2IsHuman)`: both seats' live colors and their pickers' handlers (`p1Color`,
  `p2Color`, `handleP1ColorChange`, `handleP2ColorChange`), with the theme following them (see
  `seatTheme`). A pick of the other seat's current color swaps the two.
- `useActiveRound(game, defaults)`: the round a play screen plays, `{ mode, settings }`: the one its
  loadout committed, with its settings over `defaults`, or with none (a direct link, a web reload, a
  game with no loadout) `defaults` and the mode a fresh install's seat 2 makes in this game.
- `useOpponent()`: `{ seatTwo, setSeatTwo }`, seat 2's saved choice for the whole pack.
- `useAppSettings()`: `{ settings, setSettings(patch) }`, the pack-wide settings (`AppSettings`). A
  patch changes only the fields it names.
- `useGameGuide()`: How to Play. `openFirstTime(gameId, next)` shows a game's cards if this player
  hasn't finished or skipped this version, then runs `next` once they close (at once otherwise);
  `openFor(gameId)` shows them now; `openPack()` shows the pack's own `guide`; `autoShowPack()` shows
  it once per session while unseen (Home's first launch). A game with no cards of its own opens
  nothing.
- `useAtComputer()`: true on the web without a touch-first screen (`@tastic/core`'s
  `useIsTouchPrimaryDevice`), where `sideBySideAtComputer` and `MatchChips` see a computer.
- `roundModeFor(seatTwo)`: `'cpu'` is `'vsCpu'`, `'person'` `'twoPlayer'` and `'nobody'` `'solo'`.
  `humanSeatsFor(mode)`: the seats that press Ready, `[1, 2]` in 2 Player and `[1]` otherwise.
  `seatTwoFor(saved, choices)`: seat 2's saved choice as one game reads it (see `GameDefinition`).
- `SettingsDialog` (`SettingsDialogProps`): `visible`, `onDismiss`, `onShowHowToPlay` (optional: shows
  the How to Play row, as a loadout does; left out on Home and in a match) and `children` (a play
  screen's own rows). The pack's `useSettingsRules` goes above the shell's rows, and `children` and
  then the pack's `SettingsSections` under them.
- `safeBack()`: back, or Home (`/`) where there's nothing to go back to.

### On every pack (0.2.0)

Six fixes CardTastic's move brought to every pack's screens: Home's press-away overlay sits in the
scroller beside seat 1's button in the upright layout (as the frame's first child it was under the whole
scroller, so a press on a row played the game), seat 1's menu closes on every change of window, both of
Home's scrollers fade out at an edge with more past it (auto-paper's `FadingScrollView`), a press
anywhere on the stats screen (its header and margins too) closes a picker's menu, the stats screen's
column is capped at 640pt in the wide layout, and Profiles' roster is capped at 640pt in the wide
layout (hud's `RotatedFrame`, which nothing turns any more). Every hud import goes through `@tastic/hud/chrome`,
`/guide` or `/lobby`, so an app with no Skia can install the shell; a pack's own imports don't change.
The shell's routes are handed to expo-router as plain `Href`s, so an app with typed routes type-checks
the shell before its own routes match.

### The OS turns (0.5.0)

Needs `@tastic/core` 0.15, where the seat mode is the window's shape on every platform. The shell no
longer reads the accelerometer, draws a turn or offers Lock Orientation. A pack bumping to it:

- replaces `twoPlayerSeats` with `sideBySideWhenWide: true` on the games whose 2 Player seats go side by
  side in a wide window (where `faceToFaceOnWeb` was false), and drops it elsewhere;
- drops `portraitWhileKeyboard`, and any `rotation` it read from the loadout's props or passed to
  `SettingsDialog`;
- takes `"@tastic/core"` out of `app.json`'s plugins, sets `UIViewControllerBasedStatusBarAppearance: true`
  in `ios.infoPlist` (the stack sets the status bar per screen), and makes a new native build.

### The chips over a match (0.6.0)

`MatchChips` is every game's back and settings chips during a match, so they sit and show the same
way in every game of every pack. A play screen renders it (`MatchChipsProps`) with `playing` (true while play is on: a
live puck, a shot in flight, a round being ridden), `faceToFace` (two players at opposite ends of the
screen right now) and `onBack`/`onSettings`, plus `centerLineY` when the line between the players isn't
the window's middle.

- **Where:** the window's top corners; 2 Player face to face, the side edges at the line between the
  players (the top corners are the far player's end); at a computer (`useAtComputer`: the web without
  a touch-first screen), the page's top corners always.
- **When:** faded out over `MATCH_CHIPS_FADE_MS` (150) and not pressable while `playing`, back the moment
  it stops; up all match at a computer.
- **Look:** a 24 icon in the theme's full contrast on a translucent chip of the page's color.

### Back mid-match (`useBackBlock`)

`useBackBlock(held, onHeld)` holds a play screen while `held`: every way off it but the `quit` it
returns (Android's hardware or gesture back, the browser's back, a link) runs `onHeld` instead. Hand it
the same test the back chip's Quit Match? asks with, and `requestBack` from `@tastic/hud`'s
`useQuitConfirmation`, so a system back opens the same Quit Match? the chip does; use `quit` for
Quit Match?'s and Paused's own Quit, which `safeBack` alone would be stopped by.

```tsx
const hasProgressRef = useRef(false)
const { confirmVisible, requestBack, cancelBack } = useQuitConfirmation(() => hasProgressRef.current, safeBack)
// ... the game's state hook, which needs `paused` from confirmVisible ...
const hasProgress = phase !== 'gameOver' && (scores[0] > 0 || scores[1] > 0)
useEffect(() => {
  hasProgressRef.current = hasProgress
})
const quit = useBackBlock(hasProgress, requestBack)

<ConfirmDialog visible={confirmVisible} title='Quit Match?' onConfirm={quit} onCancel={cancelBack} />
```

- `held` is a plain boolean read as the screen renders (expo-router has to know before a back comes
  in), so a game whose progress comes from a state hook that itself needs Quit Match?'s `paused` calls
  this after that hook, and mirrors the value into the getter it gives `useQuitConfirmation`.
- Off when there's nothing to lose (0-0, Game Over), so a back there leaves at once, as the chip does.
- `quit` goes back (`safeBack`) unless a third argument, `leave`, says where: `useBackBlock(held,
  onHeld, leave)`. For a Quit Match? that more than one thing opens, such as a back and a Home button
  that goes to Home past the screen underneath, pass a `leave` that reads which one opened it
  (`() => router.dismissTo('/')` for Home). It's read when `quit` runs, so it can change between
  renders.
- While it's on, the web also asks before the page unloads (expo-router's `usePreventRemove` adds a
  `beforeunload` handler with it). iOS's swipe back is off on every screen anyway.

## Peer dependencies

None are bundled. The floors started as the versions PuckTastic and DuelTastic ran the shell on when
it became a package (the lower of the two where they differ), and some have been raised since for
what the shell started using (noted in the table).

| Peer | Floor | Used for |
| --- | --- | --- |
| `react`, `react-native` | >=19.3.0, >=0.88.0 | everything |
| `expo-router` | >=58.0.23 | the stack, the routes, `safeBack`, focus effects, the web tab title |
| `expo-font`, `@expo/vector-icons` | >=58.0.8, >=15.1.1 | the icon font and the pack's `fonts`, behind the splash screen |
| `expo-splash-screen`, `@rific/splash-gate` | >=58.0.10, >=0.2.3 | holding the splash screen until the theme, fonts and profiles are ready |
| `expo-constants` | >=58.0.12 | the web tab title |
| `expo-blur`, `@react-native-masked-view/masked-view` | >=58.0.4, >=0.3.2 | auto-paper's blur and its scroll fade, Home's fading scrollers |
| `expo-haptics`, `expo-keep-awake` | >=58.0.7, >=58.0.3 | the toaster's haptics, Keep Awake |
| `expo-audio` | >=58.0.11 | the UI sounds, through `@rific/feedback-press/audio` |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context` | >=3.3.0, >=4.7.1, >=5.11.0 | the gesture root, auto-paper's dialogs and the loadout's fades, insets (with room for iPadOS's window controls) |
| `react-native-paper` | >=5.15.3 | text, icons, the toaster and feedback-press |
| `@reduxjs/toolkit`, `redux`, `react-redux`, `redux-persist`, `@react-native-async-storage/async-storage` | >=2.13.0, >=5.0.1, >=9.3.0, >=6.0.0, >=2.2.0 | the store and where it's saved |
| `@rific/auto-paper` | >=0.13.4 | the theme |
| `@rific/core` | >=0.5.0 | settings slices, Keep Awake, `safeBack` |
| `@rific/feedback-press` | >=0.13.1 | haptic and sound settings, the UI sounds |
| `@rific/toaster` | >=0.10.1 | toasts |
| `@tastic/core` | >=0.16.0 | the seat mode from the window's shape, the root background, the test for a computer behind `useAtComputer` (0.16.0's `useIsTouchPrimaryDevice`) |
| `@tastic/hud` | >=0.29.0 | Settings, the stats screen, the loadout's panels (its Skia-free `/lobby` entry, new in 0.26.0; 0.27.1's options for a pack drawn on its own backdrop; 0.28.0's Ready pill; 0.29.0's leading Settings sections), How to Play |
| `@tastic/profile` | >=0.18.0 | profiles and the shared roster, the seat buttons, seat colors, the dividers in player 1's opponent menu (0.18.0's `dividerBefore`) |
| `@tastic/achievements` | >=0.6.0 | `createGameStats`, `forgetProfileAchievements` |
| `@tastic/split-screen` | >=0.5.5 | the 2 Player loadout's two halves |
| `@tastic/edge-guard` | >=0.2.0 | Edge Guard during play (`useEdgeGestureGuard` on iOS, `edgeGuardScreenOptions` on Android) |

The two UI sounds every button plays (`assets/sounds/select.wav` and `notification.wav`) ship with the
package. They play through `@rific/feedback-press/audio`'s `useAudioPool`, which imports `expo-audio`.
