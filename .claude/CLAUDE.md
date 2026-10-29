# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# @tastic/shell

The app around a pack of React Native games: Home, each game's loadout, the stats screen, Profiles
and Settings, the pack's one Redux store, and every provider the games run under, driven by one
`PackDefinition`. An app keeps only its games, its hero, its `src/pack.ts` and six thin expo-router
routes. Built for two-seat packs (PuckTastic, DuelTastic), and since step 3 also for card games
(CardTastic): games for one player, games with no loadout, a resume, previews on Home (see "What a
pack can leave out or add"), and since 0.2.0 for a pack for one player at a time with its own table,
theme, toaster, How to Play and stats tabs (see "What CardTastic needs (0.2.0)").

Part of the `@tastic` package ecosystem, on npm since 2026-10-29 (0.1.1). Created 2026-10-28
(step 2 of the `@tastic/shell` plan in DuelTastic's `TODO.md`) from the `src/shell/` folder PuckTastic
(`../PuckTastic`) and DuelTastic (`../DuelTastic`) each carried, which step 1 made byte-identical the
same day. **Both apps run on the package since step 4 (2026-10-29)**: their `src/shell/` copies are
gone (that switch was still uncommitted in both repos when 0.2.0 was written), so this is the one copy.
Solitaire moves onto it next, as CardTastic (Solitaire's `TODO.md`, "Step 2 in detail"). Read
DuelTastic's or PuckTastic's `.claude/CLAUDE.md`, "Pack structure", for how a pack is laid out around
the shell.

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

**The first release went out by hand (2026-10-29).** npm's trusted publishing is set per package on
npmjs.com, which needs the package to exist, so Jay published 0.1.0 with `npm publish` and then added
the GitHub repo (`jayrdeaton/React-Native-Game-Shell`, workflow `publish.yml`) as its trusted
publisher. npm holds a new package's first version for review: until it's released, npmjs.com shows a
`0.0.0-stage` stub ("Temporary Holding Version") as `latest`, the registry answers 404, `npm stage list`
shows nothing, and a tag for the held version fails in the workflow with "You cannot publish over the
previously published versions" (the `v0.1.0` run). 0.1.0 came out of review minutes later. 0.1.1,
which only bumps the version, is the first from the workflow (published by GitHub Actions, with
provenance), and every later version goes out by tag the same way.

### Local development: a packed tarball, never yalc

```bash
npm pack                                   # from this package: tastic-shell-<version>.tgz
cd ../DuelTastic && npm install --no-save ../React-Native-Game-Shell/tastic-shell-<version>.tgz
```

Unreleased hud work goes in the same way, both tarballs in one `npm install --no-save` (a second
`--no-save` install prunes the first, since neither is in the lockfile). Here too: 0.2.0 was built
against hud's `/lobby` entry from a packed tarball before hud 0.26.0 was released.

`--no-save` leaves the app's `package.json` and lockfile alone, and adds only `@tastic/shell` (the
fleet's `legacy-peer-deps` installs no peers); a plain `npm install` in the app prunes it again and
puts `node_modules` back to the lockfile. **Never `yalc push`**: it rewrites every project registered
in yalc's store, not just one. `*.tgz` is gitignored.

Both packs import the package, so a plain run of a pack's `tsc` and tests exercises it. For an app
not on it yet (Solitaire), drop a probe in the app that imports `@tastic/shell` (a pack of its shape
assigned to `PackDefinition`, `createPackStore(pack, ...)`, the screens kept as exports so a web
export bundles them) and delete it afterwards. An app's `tsc` reads this package's `src/` (its preset
turns the `react-native` condition on) and so does its Jest (jest-expo resolves the same condition).

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
| `routes.ts` | The shell's own hrefs (`playHref`, `loadoutHref`, `STATS_HREF`, `PROFILES_HREF`), as plain `Href`s. Internal. |
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

## What CardTastic needs (0.2.0, 2026-10-29)

Solitaire's move onto the shell (its `TODO.md`, "Step 2 in detail", items 1-12), each optional and
off when unset, so a pack that sets none (PuckTastic, DuelTastic) builds the same store and draws the
same screens, but for six fixes Solitaire had already made to the same screens, now on every pack
(below). README.md's tables say what each option does; this says why the shapes are what they are.

- **No Skia through the barrel (item 1).** Every hud import is `@tastic/hud/chrome`, `/guide` or
  `/lobby` (hud 0.26.0's Skia-free loadout entry: `PlayerSetupPanel`, `ReadyButton`,
  `SharedActionBand`, `useZoneClampedAlign`, `MenuOption`). hud's main entry reaches Skia
  (`TriggerGaugeHost`, `loadSkiaWeb`), and the barrel loads the loadout in every pack, so before this
  an app with no Skia (Solitaire dropped it on 2026-10-18; it's a native module and a CanvasKit
  `.wasm`) couldn't install the shell. `__tests__/hudImports.test.ts` fails on any other quoted hud
  specifier under `src/`, test mocks included. No pack's own imports change.
- **Peer floors an OTA can meet (item 2).** `@tastic/profile` >=0.16.2 (0.17 is native: a new build;
  the suites pass on 0.16.2, checked with it installed), and the Expo floors at Solitaire's installed
  versions (expo-router .23, expo-font .8, expo-splash-screen .10, expo-constants .12, expo-blur .4),
  native modules where even a patch can change the fingerprint. The devDependencies stay at the packs'
  versions, but for hud: **0.2.0 is released after hud 0.26.0**, with `npm install -D @tastic/hud@^0.26.0`
  here first, since this repo's own tests and tsc read `/lobby` (0.2.0 was built against hud's packed
  tarball).
- **`Backdrop`, `foreground` (item 3).** The navigation theme with a transparent background is built
  as `AppStack` renders, never at import: the packs' own tests load the barrel with expo-router stood in
  by its `router` alone, and a module-level `DarkTheme` read failed 15 of their suites before they ran
  (`__tests__/barrelImport.test.ts`). The root window is `useThemedRootBackground(true, ...)` under a
  backdrop whatever the mode: a light root window flashed white around Solitaire's felt on a push.
- **Root pieces (item 4).** `Provider` sits inside every game's provider and around the profiles gate,
  How to Play and the stack. `useScreenOptions` and `useFeedbackSounds` are hooks on the pack, called
  unconditionally through a default (`noScreenOptions`, `useShellFeedbackSounds`), since the pack never
  changes while it runs. `keepStatusBar` makes the play route's options a function of its `game` param.
  A pack `Toaster` renders inline in an absolute-fill, pass-through `RotatedFrame` (Solitaire's
  `RootOverlays`), so `ToastProvider` gets no `paper` then: with Paper the toaster portals out of the
  frame. `edgeGuard: false` leaves out the two props that make hud draw the row.
- **`seatTheme`, `previewColor` (item 5).** With a seatTheme, `useSeatColors` returns each seat's
  remembered color (a profile's pick, its own color, the guest's or the CPU's, seat 2 stepped aside on
  a clash) instead of the theme's primary and secondary, which no longer hold the raw colors; the theme
  is re-applied when `dark` flips (a ref keeps the focus effect's copy current), and skipped when it
  already is what it makes. `createShellReducers` seeds a fresh install's theme with
  `seatTheme(seatColors, appearance === 'dark')`. `previewColor` is mounted as `ProfileColorProvider`
  inside the theme, and Home hands it to seat 1's button (`color`, `colorSection.previewValue`) and the
  stats screen's player rows, which don't read the provider.
- **The pack's guide (item 6).** `GuideHost` shows one subject at a time, the pack's (`__pack__`) or a
  game's. Home's `autoShowPack()` runs from an effect above the resume `Redirect`, so it never opens over
  a game a cold launch is dropping into; once per session, like hud's `useAutoShowGuide`, which reads
  whichever subject is current and so couldn't be used. **`GameDefinition.guide` stays required**: the
  plan made it optional, but DuelTastic's `packGuides` test reads `game.guide.getSteps` on its
  `GameDefinition`s and stopped compiling. A game without cards is a `GuidelessGameDefinition`
  (`guide?: undefined`), and `PackDefinition.games` takes either (`PackGameDefinition`).
- **Home (item 7).** A game's `Rules` renders inside a Paper `Portal.Host` in Home's frame (`RulesHost`,
  only in a pack with one, so the frame is unchanged otherwise): Solitaire's `RulesDialog` portals and
  lays out against the frame. The plan's two "check first" items, settled on the iOS 27 simulator
  (2026-10-29, a Solitaire-shaped probe pack swapped as a JS bundle into a copy of Solitaire's Release
  app, on a throwaway simulator, with a fake tilt): **Home's Settings sideways needs no change** (hud's
  sheet turns in its own frame and fits the short edge; Lock Orientation, its first row, is in reach),
  but **hud's own placement of seat 1's menu is wrong sideways**, as Solitaire found: held at +90 it
  opened toward the frame's bottom, where a low button has no room, and cut Manage off the screen. So
  `usePickerAlign` (a pack hook, `PickerAlign`) places seat 1's menu, the stats screen's two pickers and
  Profiles' color swatch where a pack has one; with Solitaire's `useFrameAutoAlign` the same menu
  flipped above and stayed on screen. Unset keeps hud's placement, so the two packs are unchanged. The
  same run confirmed the press-away bug before fixing it: with the overlay back as the frame's first
  child, pressing a row with seat 1's menu open opened that game.
- **Optional game fields (item 8):** `icon` (with a `Preview`), `Provider`, `AchievementList`,
  `resetStats`. Neither pack reads them off a `GameDefinition`, so unlike `guide` they could go optional.
- **The stats screen (item 9).** `GUEST_PLAYER_ID` is `'guest'`, Solitaire's id, not `seatPlayerKey`'s
  `guest:1`. `resetStats` is a hook plus labels, not an action: Solitaire's reset clears saves and
  records through its own hooks. `statsGameTitles: false` exists because Solitaire's rule-set wells
  already say "KLONDIKE · DRAW 3" under the heading the screen would add.
- **Profiles (item 10).** `newProfileColor` is an option rather than `seatColors[1]`: DuelTastic's
  seat 1 is blue, and a new profile there has always started on auto-paper's first swatch (red).
- **The store (item 11):** `blacklist`, `serializableIgnoredPaths`, `middleware` on `PackStoreConfig`.
- **Typed routes.** `routes.ts` hands expo-router the shell's routes as plain `Href`s. An app with
  expo-router's typed routes (Solitaire) type-checks this source against its own route tree, which has
  `play/[game]` and `stats` only once it has moved onto the shell, so pushing them as literals failed
  its `tsc` from the first import.
- **`playersRowFade`.** `LoadoutScreen` casts split-screen's fade style (typed for any component) to a
  view style: an app whose generated `expo-env.d.ts` pulls in Expo's react-native-web types (which widen
  Text's `cursor` to any string) couldn't hand it to `Animated.View`. It only sets opacity.

**On every pack (Decisions for Jay 5 in Solitaire's plan):** Home's press-away overlay sits in the
scroller beside seat 1's button in the upright layout, at zIndex 5 under the raised button (as the
frame's first child it was under the whole scroller, which on a phone took a press on a row), and at
zIndex 5 over the grid in the wide layout; seat 1's menu closes on every turn and resize, not only a
switch of layout; both of Home's scrollers are auto-paper's `FadingScrollView`; the stats screen sits
in `StatsPressAway` (a responder outside the frame that takes a press nothing else claims, so the header
and margins close a menu too) and hud's `RotatedFrame` (insets turned onto its edges, the reset confirm
in its own Portal.Host at rotation 0, the column capped at 640pt in the wide layout); and Profiles turns
with the phone in the same frame, roster capped at 640pt.

## Public API

`src/index.ts`, the one entry (`"."`). Served as source under the `react-native` and `browser`
conditions (Metro, Expo's web build, and an app's `tsc`, whose preset turns the `react-native`
condition on, so an app type-checks this source with its own settings), and as `dist/` for the rest.
Internal pieces (`Providers`, `Theme`, `Fonts`, `GuideHost`, `UpdateDialog`, `SeatTwoPanel`,
`LoadoutScreen`, the splash gates, `LastActiveGameProvider`/`useLastActiveGame`, `homeLayout`'s
geometry but `PREVIEW_ASPECT`) aren't exported: `RootLayout` and the routes mount them. The slices'
default-exported reducers are exported by name (`appSettingsReducer`, `liveplayReducer`,
`opponentReducer`, `profileSelectionReducer`). Step 3 added `seatTwoFor`, `GamePreviewProps`,
`PackStatsSectionsProps` and `PREVIEW_ASPECT` (the shape a game's `Preview` draws in). 0.2.0 added
`GUEST_PLAYER_ID` and the types `GuidelessGameDefinition`, `PackGameDefinition`, `PackGuide`,
`GameRulesProps`, `StackScreenOptions`, `FeedbackSounds`, `PackStatsTab`, `PackStatsReset` and
`PickerAlign`.

## Peer Dependencies

Every package the source imports, none bundled. Each floor is the version PuckTastic and DuelTastic
had installed when the package was made (2026-10-28), the lower of the two where they differ: only
`@rific/toaster` did (DuelTastic 0.12.0, PuckTastic 0.10.1). 0.2.0 lowered six to what Solitaire has
installed, so it can move onto the shell in an OTA (see "What CardTastic needs"), and raised
`@tastic/hud` to 0.26.0 for `/lobby`. Nothing is optional: every import is at
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
  (Solitaire's pane math, and the hero's box) and `useFrozenWhileHidden`. And 0.2.0's: `hudImports`
  (no quoted hud specifier but `/chrome`, `/guide` and `/lobby`), `barrelImport` (the barrel loads with
  expo-router stood in by its `router` alone), `createPackStore`'s new cases (`seatTheme` seeding the
  theme, `blacklist`, `serializableIgnoredPaths`, `middleware`), `packRoot` (the real `RootLayout`
  with recording stand-ins: `Backdrop`, `useScreenOptions`, `keepStatusBar`, the pack's and a game's
  `Provider`, `Toaster` with no Paper, `portraitWhileKeyboard`, `previewColor`; Settings' `edgeGuard`),
  `feedbackSounds` (the real `Providers`: the shell's two wavs or the pack's), `seatTheme`
  (`useSeatColors` with and without one), `packGuide` (the real `GuideHost`: shown once per session while
  unseen, marked seen on close, `openPack`, games without cards and with them), `homeOptions` (rules
  sheets, seat 1's labels and color preview, the pack's guide on Home and in Settings, the press-away
  overlay's place in both layouts, closing on a turn, the fading scrollers, a backdrop), `statsOptions`
  (`guestStats`, the pack's achievement list and tabs, `resetStats`, `statsGameTitles`, the press-away
  over the header, the frame and its cap, a backdrop, `usePickerAlign`) and `profilesRoute` (the frame,
  `newProfileColor`, the swatch's `usePickerAlign` with the column's cap, a backdrop). `homeOptions`
  also has `usePickerAlign` for seat 1's menu. `testUtils/pack.tsx`'s `standInGame` gives a `GuidelessGameDefinition` when handed
  `guide: undefined`. Each pack's own `store.test.ts` (its keys and saves) and its status bar source
  scan stay in the app.
- **The screens' tests** render the real screen inside the real store, pack and resume provider
  (`shellWrapper`), and replace per file, with `jest.mock`, what needs a native runtime or another
  provider: expo-router (its `router` built inside the factory, since `navigation.ts` reads it at
  import), the insets, the window (`react-native/Libraries/Utilities/useWindowDimensions`, for a wide
  screen), and heavy neighbours as recording stand-ins (the How to Play host, the Settings dialog,
  `useProfiles`, `useSeatColors`, hud's and @tastic/profile's buttons). The loadout's suite stands in
  for split-screen's `useDualZoneLayout`: the package's reanimated mock (the apps') has no
  `useAnimatedReaction`. RNTL 14 has no `UNSAFE_` queries: a component a test needs to find by type
  (auto-paper's `FadingScrollView`, feedback-press's `IconButton`, Paper's `SegmentedButtons`) is a
  recording stand-in with a test id.
- `jest.setup.cjs` (auto-detected) is the apps': `IS_REACT_ACT_ENVIRONMENT` and the process error
  handlers.
- **Mocks:** `src/__mocks__/react-native-reanimated.ts` and `react-native-worklets.ts`, the apps'
  own, picked up for the bare specifiers with no `jest.mock()` call. Without them `@tastic/profile`'s
  barrel (through hud's `StaggeredWord`) and `Theme` load real Worklets, which throws under Jest.
  Copy another of the apps' mocks over the same way when a test reaches a native module.
- **Current suite** (2026-10-29, 0.2.0): 20 suites, 149 tests, all passing (11 suites and 79 tests
  before).

## Code Style

Enforced by the shared `@infinitetoken/eslint-config/react-native` preset (a bare
`eslint.config.cjs`) and its Prettier config (`package.json`'s `"prettier"` field): single quotes,
no semicolons, no trailing commas, print width 1000. Comments say why, in the apps' voice; no em
dashes anywhere (Jay).
