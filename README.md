# @tastic/shell

The app around a pack of React Native games: Home, each game's loadout, the stats screen, Profiles
and Settings, the pack's one Redux store, and every provider the games run under. An app hands it one
`PackDefinition` (its name, its games, its seat colors, its hero) and keeps only its games, its hero
and a handful of thin expo-router routes. Two-seat duels and games for one player alike: a game can
leave out its seat 2 and its loadout, come back on a cold launch, and show a preview on Home.

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
- **The store**: `createPackStore(pack, { keyPrefix, migrate })` builds one persisted store from the
  shell's keys (theme, haptics, sound, Keep Awake, profiles, seat selection, seat colors, app settings,
  seat 2, the never-saved `liveplay`, and `lastActiveGame` in a pack with a resumable game), the
  pack's own `reducers` and every game's own `reducers`.
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

A game never imports another game, and the shell never imports a game: games reach the shell only
through the pack (`usePack()`).

## Peer dependencies

None are bundled. The floors are the versions PuckTastic and DuelTastic ran the shell on when it
became a package (the lower of the two where they differ).

| Peer | Floor | Used for |
| --- | --- | --- |
| `react`, `react-native` | >=19.3.0, >=0.88.0 | everything |
| `expo-router` | >=58.0.26 | the stack, the routes, `safeBack`, focus effects, the web tab title |
| `expo-font`, `@expo/vector-icons` | >=58.0.10, >=15.1.1 | the icon font and the pack's `fonts`, behind the splash screen |
| `expo-splash-screen`, `@rific/splash-gate` | >=58.0.11, >=0.2.3 | holding the splash screen until the theme, fonts and profiles are ready |
| `expo-constants` | >=58.0.13 | the web tab title |
| `expo-blur`, `@react-native-masked-view/masked-view` | >=58.0.5, >=0.3.2 | auto-paper's blur and its scroll fade |
| `expo-haptics`, `expo-keep-awake`, `expo-sensors` | >=58.0.7, >=58.0.3, >=58.0.4 | the toaster's haptics, Keep Awake, the orientation reading |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context` | >=3.3.0, >=4.7.1, >=5.10.1 | the gesture root, auto-paper's dialogs and the loadout's fades, insets |
| `react-native-paper` | >=5.15.3 | text, icons, the toaster and feedback-press |
| `@reduxjs/toolkit`, `redux`, `react-redux`, `redux-persist`, `@react-native-async-storage/async-storage` | >=2.13.0, >=5.0.1, >=9.3.0, >=6.0.0, >=2.2.0 | the store and where it's saved |
| `@rific/auto-paper` | >=0.13.4 | the theme |
| `@rific/core` | >=0.5.0 | settings slices, Keep Awake, `safeBack` |
| `@rific/feedback-press` | >=0.13.1 | haptic and sound settings, the UI sounds |
| `@rific/toaster` | >=0.10.1 | toasts (DuelTastic runs 0.12, PuckTastic 0.10) |
| `@tastic/core` | >=0.14.0 | orientation, rotation, the status bar and root background |
| `@tastic/hud` | >=0.25.1 | Settings, the stats screen, the loadout's panels, How to Play |
| `@tastic/profile` | >=0.17.0 | profiles, the seat buttons, seat colors |
| `@tastic/achievements` | >=0.6.0 | `createGameStats`, `forgetProfileAchievements` |
| `@tastic/split-screen` | >=0.5.5 | the 2 Player loadout's two halves |
| `@tastic/edge-guard` | >=0.1.5 | Edge Guard during play |

The two UI sounds every button plays (`assets/sounds/select.wav` and `notification.wav`) ship with the
package.
