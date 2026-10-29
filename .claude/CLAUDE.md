# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# @tastic/shell

The app around a pack of React Native games: Home, each game's loadout, the stats screen, Profiles
and Settings, the pack's one Redux store, and every provider the games run under, driven by one
`PackDefinition`. An app keeps only its games, its hero, its `src/pack.ts` and six thin expo-router
routes. Built for two-seat packs (PuckTastic, DuelTastic), and since step 3 also for card games
(CardTastic): games for one player, games with no loadout, a resume, previews on Home (see "What a
pack can leave out or add").

Part of the `@tastic` package ecosystem. Not published yet: created 2026-10-28 (step 2 of the
`@tastic/shell` plan in DuelTastic's `TODO.md`) from the `src/shell/` folder PuckTastic
(`../PuckTastic`) and DuelTastic (`../DuelTastic`) each carried, which step 1 made byte-identical the
same day. Neither app uses the package yet (switching them is step 4). Until then, **the two apps'
`src/shell/` copies and this package are three copies of one thing**: a fix in one goes into all
three, or the switch in step 4 loses it. Step 3 (2026-10-29) was written here only, so the package
is ahead of the apps' copies by exactly that. Read DuelTastic's or PuckTastic's `.claude/CLAUDE.md`,
"Pack structure", for how a pack is laid out around the shell.

## Commands

```bash
npm run lint      # ESLint (includes Prettier via eslint-plugin-prettier) check
npm run fix       # Auto-fix lint/format issues
npm run typecheck # TypeScript type check (tsc --noEmit)
npm test          # Run all Jest tests (jest-expo)
npm run build     # Compile to dist/ via tsup
npm run verify    # lint && test && typecheck && build - the full gate, also run by CI and by `preversion`
```

Always run `npm run lint` before finishing any task.

## Release

The same as every `@rific`/`@tastic` package. Never run `npm version` directly:

```bash
npm run release:patch   # npm version patch && npm run release
npm run release:minor   # npm version minor && npm run release
npm run release:major   # npm version major && npm run release
```

`npm run release` is `git push --follow-tags`. `preversion` runs `npm run verify` first. The `Publish`
workflow (`.github/workflows/publish.yml`) fires on `v*` tags and calls the fleet's shared
`infinitetoken/Workflows/.github/workflows/npm-publish.yml@v1` (npm trusted publishing, OIDC, no
token). `.github/workflows/ci.yml` calls the shared `npm-ci.yml@v1` on every PR and push to `main`.

**The first release can't go through the workflow.** npm's trusted publishing is set per package on
npmjs.com, which needs the package to exist: publish 0.1.0 by hand once (`npm publish`, from a clean
`npm run verify`; `publishConfig.access` is already `public`), then add the GitHub repo
(`jayrdeaton/React-Native-Game-Shell`, workflow `publish.yml`) as the package's trusted publisher, and
every later version goes out by tag.

### Local development: a packed tarball, never yalc

```bash
npm pack                                   # from this package: tastic-shell-<version>.tgz
cd ../DuelTastic && npm install --no-save ../React-Native-Game-Shell/tastic-shell-<version>.tgz
```

`--no-save` leaves the app's `package.json` and lockfile alone, and adds only `@tastic/shell` (the
fleet's `legacy-peer-deps` installs no peers); a plain `npm install` in the app prunes it again and
puts `node_modules` back to the lockfile. **Never `yalc push`**: it rewrites every project registered
in yalc's store, not just one. `*.tgz` is gitignored.

While the apps still use their own `src/shell/`, a plain run of an app's `tsc` and tests only shows
the package doesn't break it. To exercise the package itself, drop a probe in the app that imports
`@tastic/shell` (the app's `pack` assigned to the package's `PackDefinition`, `<RootLayout>` given
the app's store, `createPackStore(pack, ...)` in a test) and delete it afterwards. An app's `tsc`
reads this package's `src/` (its preset turns the `react-native` condition on) and so does its Jest
(jest-expo resolves the same condition).

## Architecture

The source is the apps' `src/shell/` with every `@/shell/...` import made relative, plus the two
files of the apps' `src/shared/` that import the shell's own `onProfileRemoved`, `ShellState` and
types (`playerSettings.ts`, `gameStats.tsx`, now at the top of `src/`). Step 2 changed nothing else
but the sounds' path (below); a `diff` against either app's `src/shell/` shows import lines plus
step 3's additions.

| Path | |
| --- | --- |
| `index.ts` | The barrel, the only entry (see Public API). |
| `types.ts` | `PackDefinition`, `GameDefinition` and everything a game hands the shell (`GameLoadout`, `GameGuide`, `GameIconProps`, `HeroTitleProps`, `LoadoutOptionsProps`, `SeatControlLook`), plus `Seat`, `SeatTwo`, `RoundMode`, `roundModeFor`, `humanSeatsFor`. |
| `PackContext.tsx` | `PackProvider`, `usePack`, `usePackGame`: how the shell reaches the pack without importing it. |
| `RootLayout.tsx` | The root: gesture root, safe area, `PackProvider`, `Fonts`, `Providers`, `Theme`, `ProfilesProvider`, every game's `Provider`, the profiles splash gate, `OrientationBridge`, the toaster, `GuideHost`, the stack and `UpdateDialog`. |
| `navigation.ts` | `safeBack`, `@rific/core`'s with expo-router's `router` injected at import. |
| `splashGate.ts` | The shell's three splash gates: `theme`, `fonts`, `profiles`. Internal. |
| `components/` | `Providers` (Redux, PersistGate, Edge Guard, feedback-press with the UI sounds, Keep Awake), `Theme` (auto-paper's Provider over the `theme` key), `Fonts`, `GuideHost`/`useGameGuide` (each game's How to Play), `SettingsDialog`, `SeatTwoPanel`, `UpdateDialog`, `imageGameIcon`. |
| `hooks/` | `useActiveRound`, `useAppSettings`, `useOpponent`, `useProfiles`/`ProfilesProvider`, `useSeatColors`, `useLastActiveGame`/`LastActiveGameProvider` (the resume, internal), `useFrozenWhileHidden`. |
| `redux/` | `createPackStore`, `createShellReducers`/`ShellState`, and the shell's slices (`appSettings`, `liveplay`, `opponent`, `profileSelection`, `seatColors`, and `lastActiveGame` in a pack with a resumable game), `createGameGuideSlice`, `onProfileRemoved`/`forgetProfileAchievements`. |
| `screens/` | `HomeScreen` (and `homeLayout.ts`, its tiles' geometry), `LoadoutScreen` (with `LoadoutRoute` and `PlayRoute` in `GameRoute.tsx`), `ProfilesRoute`, `StatsScreen`. |
| `playerSettings.ts` | `createPlayerSettings`, `seatPlayerKey`: a game's settings and controls, kept per player. |
| `gameStats.tsx` | `createGameStats`: a game's stats and achievements slice and context. |

**The UI sounds ship with the package.** `components/Providers.tsx` requires `select.wav` and
`notification.wav` for feedback-press's button sounds. In the apps they were `assets/sounds/` files
(byte-identical in both); they're in this package's `assets/sounds/` now (in `files`), required as
`../../assets/sounds/*.wav`. The apps keep their own copies for their games. tsup copies them next to
the built files (`loader: { '.wav': 'copy' }`), so `dist/` stays loadable too.

**`sideEffects` lists the two modules that do work on import**: `navigation.ts` (injects the router)
and `components/Theme.tsx` (holds the splash screen and sets its fade), plus `dist/*`, which inlines
them. Everything else is free to drop.

**The layering stays:** nothing here imports a game or a pack. A game reaches the shell only through
the `PackDefinition` an app hands `RootLayout`.

## What a pack can leave out or add (step 3, 2026-10-29)

Six options for CardTastic (Solitaire, renamed, with multiplayer card games added), each optional,
so a pack that sets none of them (PuckTastic, DuelTastic) builds the same store and draws the same
screens as before. Checked in both apps with the packed tarball and a probe (their packs fit the
widened `PackDefinition`, and `createPackStore` builds the same keys from them, no resume key among
them); nothing here has run in a browser or on a device.

1. **Games for one player** (`GameDefinition.seatTwo`, `twoPlayerSeats` and `GameLoadout.cpuDifficulty`
   optional). `seatTwoFor(saved, choices)` (now in `types.ts`, shared by the loadout and the How to
   Play host) reads a game without `seatTwo` as `'nobody'`, so its loadout has no seat 2 button and
   commits a `'solo'` round, its How to Play describes a solo round, and `useActiveRound` falls back to
   `'solo'` for it (`'vsCpu'` for every other game, as before). A game with seat 2 but no
   `cpuDifficulty` gets one plain CPU row in seat 2's menu.
2. **Games with no loadout** (`GameDefinition.useLoadout` optional). Home opens such a game straight
   to `play/[game]`, after its How to Play the first time (the same `openFirstTime`); a link to its
   `loadout/[game]` redirects to its play screen. No round is committed, so its play screen gets
   `useActiveRound`'s fallback. Its rule variants go in its play screen's own Settings rows:
   `SettingsDialog` takes `children` (Solitaire's `GameChrome` hands its `settingsContent` the same
   way). `LoadoutScreen` takes a `LoadoutGame` (a game with `useLoadout`), which `LoadoutRoute`
   narrows to.
3. **Settings for the whole pack** (`PackDefinition.SettingsSections` and `reducers`). Every
   `SettingsDialog` hands `BaseSettingsDialog` a play screen's `children` and then the pack's
   `SettingsSections` (Solitaire's order: the game's own rows above the app's). `createPackStore`
   mounts the pack's `reducers` between the shell's keys and the games' (never a key either uses:
   a collision silently replaces it, as between games).
4. **Stats across games** (`PackDefinition.StatsSections`, `PackStatsSectionsProps`). Drawn first on
   the stats screen's Stats tab, above each game's sections and not on Achievements, handed both
   filters (`profileId`, null for Everyone; `gameId`, null for All Games), as Solitaire's
   `PlayCalendar` reads its days narrowed by both. Of the two sets of filters, **the shell's stats
   screen keeps its own** (Everyone or a profile; All Games or a game) over Solitaire's
   `StatsFilters`: Solitaire's is built on Solitaire's store and frame (its guest bucket's
   `GUEST_PLAYER_ID`, card-back chip colors, `SOLITAIRE_GAME_IDS`, and `useFrameAutoAlign` for the
   menus it portals inside its rotated `RotatedScreen`), while the shell's reads `pack.games` and
   places its menus with hud's own placement, like every other menu in the shell. What Solitaire's has
   that the shell's doesn't, for step 5 to settle: a Guest entry (the shell's `createGameStats` keeps
   no guest bucket, so guests count only toward Everyone), opening on whoever is playing rather than
   Everyone, the game picker hidden on Achievements (its achievements are one catalog across games;
   the shell's are per game, so the filter means something there), and a press-away that also covers
   the header (`StatsPressAway`).
5. **Resume** (`GameDefinition.resumable`, opt-in). Solitaire's `stores/lastActiveGame.tsx` and
   `redux/lastActiveGameSlice.ts`, ported as they were (`hooks/useLastActiveGame.tsx`,
   `redux/lastActiveGameSlice.ts`), with their invariants: the saved id is read once, as the provider
   mounts (inside PersistGate, in `RootLayout`), never subscribed to; the provider's value never
   changes; any set or clear drops a pending resume (a deep link into a game can't later bounce into a
   stale one); an unchanged value is never rewritten. Home reads `consumeResumeGame()` once
   (`useState`) and, for a game the pack has and that is resumable, renders a `Redirect` to its
   `play/[game]` before its menu draws. `PlayRoute` sets the id as a resumable game's play screen
   mounts and clears it as it unmounts (any back; backgrounding leaves it mounted). The key is
   `lastActiveGame`, `{ gameId }`, the same key and shape as Solitaire's, and `createPackStore` mounts
   it only when a game is resumable, so PuckTastic's and DuelTastic's saves don't change.
   `ShellState` has it as optional. The saved board stays in each game's own slice.
6. **Preview tiles** (`GameDefinition.Preview`, `GamePreviewProps`, `PREVIEW_ASPECT`). While any game
   in the pack has a `Preview`, Home lays its games out as tiles (`screens/homeLayout.ts`, Solitaire's
   `components/homeLayout.ts`): upright, the same column of rows with the preview (92pt wide, 360:200)
   in place of the icon; on a wide screen (rotated footprint wider than tall), two panes, the hero and
   seat 1's button on the left and a scrolling grid of up to three tile columns on the right, each
   tile its preview over its name and blurb, the rules button floating on the preview's corner. A game
   without a preview keeps its icon (centred in a preview-shaped box in the grid). The previews are
   held back until the frame after Home first paints (`previewsRevealed`), and the choice of layout is
   held while a screen covers Home (`hooks/useFrozenWhileHidden.ts`, Solitaire's, as it was). The hero
   gets `HeroTitleProps.fit`, the box it has in the left pane, in place of Solitaire's `heroScale`
   (which read Solitaire's own hero's size): how it shrinks is the pack's. What a preview draws stays
   with the game. A pack without previews keeps its column at every size, its hero without `fit`.

## Public API

`src/index.ts`, the one entry (`"."`). Served as source under the `react-native` and `browser`
conditions (Metro, Expo's web build, and an app's `tsc`, whose preset turns the `react-native`
condition on, so an app type-checks this source with its own settings), and as `dist/` for the rest.
Internal pieces (`Providers`, `Theme`, `Fonts`, `GuideHost`, `UpdateDialog`, `SeatTwoPanel`,
`LoadoutScreen`, the splash gates, `LastActiveGameProvider`/`useLastActiveGame`, `homeLayout`'s
geometry but `PREVIEW_ASPECT`) aren't exported: `RootLayout` and the routes mount them. The slices'
default-exported reducers are exported by name (`appSettingsReducer`, `liveplayReducer`,
`opponentReducer`, `profileSelectionReducer`). Step 3 added `seatTwoFor`, `GamePreviewProps`,
`PackStatsSectionsProps` and `PREVIEW_ASPECT` (the shape a game's `Preview` draws in).

## Peer Dependencies

Every package the source imports, none bundled. Each floor is the version PuckTastic and DuelTastic
had installed when the package was made (2026-10-28), the lower of the two where they differ: only
`@rific/toaster` did (DuelTastic 0.12.0, PuckTastic 0.10.1). Nothing is optional: every import is at
module scope. `redux` is imported for types only, but those types are in the built declarations. The
README's table says what each is for. Each peer is also a `devDependency`, at the apps' versions,
plus what jest-expo needs (`expo`, `jest-expo`, `@react-native/jest-preset`, `@babel/core`,
`@testing-library/react-native` and its `test-renderer`), what the peers themselves load at import
(`@rific/focus-chain`, `@rific/gestures`, `@rific/updater` with `expo-updates`, `expo-audio`,
`expo-system-ui`, `react-native-screens`, `react-native-worklets`), and the lint preset's plugins
(`eslint-plugin-react-hooks`, `eslint-plugin-react-native`, as in hud). The fleet's `.npmrc` sets
`legacy-peer-deps`, so npm installs none of these by itself.

## Testing

- **Framework:** Jest through `@infinitetoken/jest-config/expo` (jest-expo, Babel), not hud's
  ts-jest and jsdom preset: the shell is an Expo app's own code, and its tests came from the apps
  unchanged but for their imports. They run the real redux-persist over AsyncStorage's official Jest
  mock (the preset maps it) and the real `ProfilesProvider` over `@tastic/profile`'s native module,
  faked through `expo-modules-core`. That preset enforces no coverage floor.
- **Location:** `src/__tests__/`. `src/testUtils/` (`appState.ts`'s `emitAppState`, and `pack.tsx`:
  `standInGame`, `standInPack`, `standInStore` and `shellWrapper`, a two-seat stand-in a test
  overrides with what it's about) is outside it because Jest's default `testMatch` takes every file
  in `__tests__/` for a suite.
- **Suites:** `appSettingsSlice`, `createPackStore` (on a stand-in pack: the prefix, `liveplay` never
  saved, a game's keys merged, the pack's own keys mounted and saved, the resume key only with a
  resumable game and read back on a relaunch, `seatColors` and `appearance` reaching the theme,
  `migrate`), `profiles` (a stand-in game's per-profile data), `playerSettings`, `statusBar` (no
  source file mounts a `StatusBar`, and `Theme` turns auto-paper's off), and step 3's:
  `seatlessGames` (`seatTwoFor`, `useActiveRound`'s solo fallback, a solo How to Play, the loadout
  with no seat 2 button committing a solo round, one plain CPU row), `homeScreen` (a game with no
  loadout opened straight to play and its loadout link redirected; a resume used once, kept while its
  play screen is up and cleared on back, a second Home not resuming, a stale or non-resumable id
  dropped; a preview in place of the icon a frame after Home paints, an icon kept without one, the
  wide grid and the hero's `fit`, the layout held while Home is covered; a pack without previews
  unchanged), `lastActiveGame` (Solitaire's provider tests, plus no rewrite of an unchanged value and
  a store without the key), `packSections` (Settings: a play screen's rows then the pack's sections;
  stats: the pack's section first on Stats, following both filters, off Achievements), `homeLayout`
  (Solitaire's pane math, and the hero's box) and `useFrozenWhileHidden`. Each pack's own
  `store.test.ts` (its keys and saves) and its status bar source scan stay in the app.
- **The screens' tests** render the real screen inside the real store, pack and resume provider
  (`shellWrapper`), and replace per file, with `jest.mock`, what needs a native runtime or another
  provider: expo-router (its `router` built inside the factory, since `navigation.ts` reads it at
  import), the insets, the window (`react-native/Libraries/Utilities/useWindowDimensions`, for a wide
  screen), and heavy neighbours as recording stand-ins (the How to Play host, the Settings dialog,
  `useProfiles`, `useSeatColors`, hud's and @tastic/profile's buttons). The loadout's suite stands in
  for split-screen's `useDualZoneLayout`: the package's reanimated mock (the apps') has no
  `useAnimatedReaction`.
- `jest.setup.cjs` (auto-detected) is the apps': `IS_REACT_ACT_ENVIRONMENT` and the process error
  handlers.
- **Mocks:** `src/__mocks__/react-native-reanimated.ts` and `react-native-worklets.ts`, the apps'
  own, picked up for the bare specifiers with no `jest.mock()` call. Without them `@tastic/profile`'s
  barrel (through hud's `StaggeredWord`) and `Theme` load real Worklets, which throws under Jest.
  Copy another of the apps' mocks over the same way when a test reaches a native module.
- **Current suite** (2026-10-29): 11 suites, 79 tests, all passing.

## Code Style

Enforced by the shared `@infinitetoken/eslint-config/react-native` preset (a bare
`eslint.config.cjs`) and its Prettier config (`package.json`'s `"prettier"` field): single quotes,
no semicolons, no trailing commas, print width 1000. Comments say why, in the apps' voice; no em
dashes anywhere (Jay).
