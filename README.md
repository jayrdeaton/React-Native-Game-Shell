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
  the theme, profiles, every game's own provider, the splash gates, the shared orientation reading,
  toasts, How to Play, the OTA update dialog) around expo-router's stack.
- **Screens** for the routes: `HomeScreen` (the pack's hero, seat 1's button, a row per game, or a
  grid of preview tiles on a wide screen), `LoadoutRoute` and `PlayRoute` (`loadout/[game]`,
  `play/[game]`), `ProfilesRoute` and `StatsScreen`.
- **The store**: `createPackStore(pack, { keyPrefix, migrate, blacklist, serializableIgnoredPaths,
  middleware })` builds one persisted store from the shell's keys (theme, haptics, sound, Keep Awake,
  profiles, seat selection, seat colors, app settings, seat 2, the never-saved `liveplay`, and
  `lastActiveGame` in a pack with a resumable game), the pack's own `reducers` and every game's own
  `reducers`.
- **What a game builds on**: `createPlayerSettings` (its settings and controls, kept per player),
  `createGameStats` (its stats and achievements), `createGameGuideSlice` (which version of its How to
  Play a player has seen), `onProfileRemoved` (forget a deleted profile), `useActiveRound`,
  `useProfiles`, `useSeatColors`, `SettingsDialog`, `safeBack` and `imageGameIcon`.

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
| `SettingsSections?` | The pack's own Settings sections, in every Settings dialog, under the shell's rows and any a play screen adds. |
| `reducers?` | The pack's own store keys (what `SettingsSections` saves), beside the shell's and the games'. Never a key either already mounts. |
| `StatsSections?` | A section across the pack's games (a calendar of play), first on the stats screen's Stats tab, handed its two filters (`PackStatsSectionsProps`: `profileId`, null for Everyone, and `gameId`, null for All Games). |

For a pack for one player at a time (CardTastic, from Solitaire), each optional and off when unset, so
PuckTastic and DuelTastic draw what they always did:

| Field | |
| --- | --- |
| `Backdrop?` | A table drawn once behind the whole stack (Solitaire's felt). The stack's two layers go transparent (the screens' `contentStyle` and the navigation theme's `colors.background`, which React Navigation paints around every screen), the root window stays dark so light mode doesn't flash white on a push, Android's push and pop crossfade (its default holds the outgoing screen opaque), and Home, the stats screen and Profiles draw transparent, with their buttons and tabs on the theme's surface. |
| `foreground?` | The color of what those three screens draw straight on the background (the hero, the corner buttons, headers). Unset is black or white with the theme. |
| `Provider?` | Mounted once around How to Play and the stack, inside the store, the theme, profiles and every game's `Provider` (one stats context across the pack's games). |
| `useScreenOptions?` | A hook returning stack screen options (`StackScreenOptions`), merged after the shell's own (a light status bar, Reduce Motion's crossfade). |
| `useFeedbackSounds?` | A hook returning the two sounds every button plays (`FeedbackSounds`: `selection`, `notification`), in place of the shell's two wavs. |
| `Toaster?` | The pack's own toaster, drawn in a frame turned with the phone (with the safe-area insets turned onto its edges) in place of the shell's. The toast provider is given no Paper, so nothing portals it out of the frame. |
| `portraitWhileKeyboard?` | Every screen reads upright while the software keyboard is up (`@tastic/core`'s `OrientationProvider`), for naming a profile sideways. |
| `edgeGuard?` | `false` leaves Edge Guard out of Settings (no edge controls, no Edge Guard plugin). |
| `seatTheme?` | `(colors, dark) => ({ color, harmony })`: the theme the seats' colors make (a muted seed from seat 1's color), applied whenever they or dark mode change and as a fresh install's theme, in place of a triad of the raw colors. With it, `useSeatColors` reads each seat's color from where it's remembered (`seatColors`) rather than from the theme. |
| `previewColor?` | `(hex, dark) => string`: how every profile color is drawn (seat 1's button and swatches, each `ProfileChip`), mounted as `@tastic/profile`'s `ProfileColorProvider`. Saved colors stay as picked. |
| `guide?` | The pack's own How to Play (`PackGuide`: `version`, `selectVersionSeen`, `markSeen`, `getSteps({ touch })`), for cards that teach every game at once: shown on Home's first launch (never while a cold launch resumes a game), replayed from Home's Settings, never in a play screen. Its seen version is a key of the pack's own. |
| `guestLabel?`, `nullLabel?` | Seat 1's button: the chip's label for a guest (default `'P1'`) and the guest row's in its menu. |
| `guestStats?` | The stats screen keeps a guest's stats under `GUEST_PLAYER_ID` (`'guest'`): a Guest entry between Everyone and the profiles once a profile exists, and the screen opens on seat 1's player. Without it the screen opens on Everyone, where guests count. |
| `AchievementList?` | One achievement list across the pack's games, on the Achievements tab, with the game picker hidden there. |
| `statsTabs?` | Tabs of the pack's own between Stats and Achievements (`PackStatsTab`: `value`, `label`, `Content`, handed both filters). With them every tab is as wide as its label, with no icons, so three fit a phone. |
| `resetStats?` | The stats screen's Reset where the pack resets stats itself (`PackStatsReset`: a `useReset` hook returning `(profileId) => void`, and the `labels` for a player's name, Guest, or `null` for Everyone). It follows the player picker, not the game picker. |
| `statsGameTitles?` | `false` leaves each game's name off its sections on All Games, where the sections name it. |
| `newProfileColor?` | A new profile's starting color on Profiles. Unset is auto-paper's first swatch. |
| `usePickerAlign?` | `(open, contentWidth, contentHeight, options?) => AlignResult` (`PickerAlign`), a hook: where seat 1's menu on Home, the stats screen's two pickers and a profile's color swatch open. hud's own placement measures a turned button against the upright window, so with the phone held sideways it can run a menu off the screen (seen on the iOS simulator, 2026-10-29); a pack whose screens turn hands in a frame-aware one (Solitaire's `useFrameAutoAlign`). Profiles passes `{ maxContentWidth: 640 }`, its roster's column. Unset is hud's placement. |

### `GameDefinition`

Each game is one object: its `id`, `title`, `blurb` and `icon` (a component drawn in the seats'
colors, or `imageGameIcon({ light, dark })` for a light and dark pair of pictures), its seat 2
choices (`seatTwo`: `'cpu'`, `'person'`, `'nobody'`) and how 2 Player seats its players
(`twoPlayerSeats`), the store `reducers` it mounts, its root `Provider`, its `useLoadout(mode)`, its
`PlayScreen`, its `StatsSections` and `AchievementList`, `resetStats`, and its How to Play `guide`.
See `src/types.ts` for every field.

What a game can leave out or add, each optional, so a two-seat game sets none of them:

| Field | |
| --- | --- |
| no `seatTwo` (nor `twoPlayerSeats`) | A game for one player: its loadout has no seat 2 button, every round is solo (`useActiveRound` falls back to `'solo'`), and its How to Play describes a solo round. |
| no `useLoadout` | Nothing to set up first: Home opens its play screen straight away, after its How to Play the first time, and a link to its loadout plays it. Its rule variants go in its play screen's Settings: `<SettingsDialog>` takes `children`. |
| no `cpuDifficulty` (in `GameLoadout`) | A CPU with no levels: seat 2's menu offers one plain CPU. |
| `resumable` | A cold launch drops the player back into its play screen if they left the app there rather than backing out of it. The shell remembers only which game (`lastActiveGame`); the game saves and restores its own board. |
| `Preview` | Drawn on Home in place of the icon (`GamePreviewProps`: `width`, `height`, the seats' colors, `dark`), in a box of `PREVIEW_ASPECT` (360:200), a frame after Home first paints. While any game has one, Home shows tiles: rows upright, and on a wide screen a grid beside the hero and seat 1's button. A game without one keeps its icon. |
| no `icon` | Only with a `Preview`, which Home draws in its place. |
| no `Provider` | A game whose stats live in the pack's own `Provider`. |
| no `AchievementList`, no `resetStats` | A game whose achievements are in the pack's one list, and whose stats the pack resets (`PackDefinition.AchievementList`, `resetStats`). |
| no `guide` (`GuidelessGameDefinition`) | A game the pack's own `guide` teaches: its tile opens without cards the first time. A `GameDefinition` keeps `guide` required, so a pack's code that reads its games' cards keeps compiling; `PackDefinition.games` takes either (`PackGameDefinition`). |
| `Rules` | Its tile's rules button opens this sheet (`GameRulesProps`: `visible`, `onDismiss`) in place of its How to Play. It portals into a host inside Home's turned frame, so it's laid out against the frame and turned with it. |
| `keepStatusBar` | Its play screen keeps the status bar while the phone is held upright. Unset, every play screen hides it for the whole round. |

A game never imports another game, and the shell never imports a game: games reach the shell only
through the pack (`usePack()`).

### `createPackStore`

`createPackStore(pack, config)`, where `config` is `PackStoreConfig`:

| Field | |
| --- | --- |
| `keyPrefix` | Where the root entry is saved (`<keyPrefix>root`). Never change it once the pack ships. |
| `migrate?` | redux-persist's migrate, run on the saved store before it rehydrates. |
| `blacklist?` | Keys left out of the root entry beside `liveplay`: keys that persist themselves (Solitaire's saved boards, one entry per game, since Android can't read an entry back past ~2MB). |
| `serializableIgnoredPaths?` | State paths the dev serializability check skips (keys too big to walk on every action). |
| `middleware?` | The pack's own middleware, after the shell's (Solitaire's settings that follow the player). |

### On every pack (0.2.0)

Six fixes CardTastic's move brought to every pack's screens: Home's press-away overlay sits in the
scroller beside seat 1's button in the upright layout (as the frame's first child it was under the whole
scroller, so a press on a row played the game), seat 1's menu closes on every turn of the phone, both of
Home's scrollers fade out at an edge with more past it (auto-paper's `FadingScrollView`), a press
anywhere on the stats screen (its header and margins too) closes a picker's menu, the stats screen's
column is capped at 640pt in the wide layout, and Profiles turns with the phone (hud's `RotatedFrame`,
its roster capped at 640pt in the wide layout). Every hud import goes through `@tastic/hud/chrome`,
`/guide` or `/lobby`, so an app with no Skia can install the shell; a pack's own imports don't change.
The shell's routes are handed to expo-router as plain `Href`s, so an app with typed routes type-checks
the shell before its own routes match.

## Peer dependencies

None are bundled. The floors are the versions PuckTastic and DuelTastic ran the shell on when it
became a package (the lower of the two where they differ).

| Peer | Floor | Used for |
| --- | --- | --- |
| `react`, `react-native` | >=19.3.0, >=0.88.0 | everything |
| `expo-router` | >=58.0.23 | the stack, the routes, `safeBack`, focus effects, the web tab title |
| `expo-font`, `@expo/vector-icons` | >=58.0.8, >=15.1.1 | the icon font and the pack's `fonts`, behind the splash screen |
| `expo-splash-screen`, `@rific/splash-gate` | >=58.0.10, >=0.2.3 | holding the splash screen until the theme, fonts and profiles are ready |
| `expo-constants` | >=58.0.12 | the web tab title |
| `expo-blur`, `@react-native-masked-view/masked-view` | >=58.0.4, >=0.3.2 | auto-paper's blur and its scroll fade, Home's fading scrollers |
| `expo-haptics`, `expo-keep-awake`, `expo-sensors` | >=58.0.7, >=58.0.3, >=58.0.4 | the toaster's haptics, Keep Awake, the orientation reading |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context` | >=3.3.0, >=4.7.1, >=5.10.1 | the gesture root, auto-paper's dialogs and the loadout's fades, insets |
| `react-native-paper` | >=5.15.3 | text, icons, the toaster and feedback-press |
| `@reduxjs/toolkit`, `redux`, `react-redux`, `redux-persist`, `@react-native-async-storage/async-storage` | >=2.13.0, >=5.0.1, >=9.3.0, >=6.0.0, >=2.2.0 | the store and where it's saved |
| `@rific/auto-paper` | >=0.13.4 | the theme |
| `@rific/core` | >=0.5.0 | settings slices, Keep Awake, `safeBack` |
| `@rific/feedback-press` | >=0.13.1 | haptic and sound settings, the UI sounds |
| `@rific/toaster` | >=0.10.1 | toasts (DuelTastic runs 0.12, PuckTastic 0.10) |
| `@tastic/core` | >=0.14.0 | orientation, rotation, the status bar and root background |
| `@tastic/hud` | >=0.26.0 | Settings, the stats screen, the loadout's panels (its Skia-free `/lobby` entry, new in 0.26.0), How to Play |
| `@tastic/profile` | >=0.16.2 | profiles, the seat buttons, seat colors |
| `@tastic/achievements` | >=0.6.0 | `createGameStats`, `forgetProfileAchievements` |
| `@tastic/split-screen` | >=0.5.5 | the 2 Player loadout's two halves |
| `@tastic/edge-guard` | >=0.1.5 | Edge Guard during play |

The two UI sounds every button plays (`assets/sounds/select.wav` and `notification.wav`) ship with the
package.
