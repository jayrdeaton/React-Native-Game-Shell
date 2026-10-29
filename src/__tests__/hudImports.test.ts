import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// The shell takes everything it needs from @tastic/hud through hud's light entries: './chrome' (the
// dialogs, the stats screen, the popover pieces), './guide' (How to Play) and './lobby' (the loadout's
// seat panels and ready buttons). hud's main entry also re-exports its Skia trigger gauge, so a single
// import from it would make every pack on the shell bundle and type-check @shopify/react-native-skia,
// which CardTastic (Solitaire, renamed) doesn't install: Skia is a native module (a new build) and a
// CanvasKit .wasm on the web. This checks every quoted '@tastic/hud...' string under src/, so a
// jest.mock() or jest.requireActual() of the bare entry fails too (comments name hud without quotes).

const SRC = join(__dirname, '..')
const HUD_SPECIFIER = /(['"`])(@tastic\/hud(?:\/[^'"`]*)?)\1/g
const ALLOWED = ['@tastic/hud/chrome', '@tastic/hud/guide', '@tastic/hud/lobby']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    // This file names the bare specifier itself, in the pattern above.
    return /\.tsx?$/.test(name) && path !== __filename ? [path] : []
  })
}

describe('@tastic/hud import boundary', () => {
  const found = sourceFiles(SRC).flatMap((file) => [...readFileSync(file, 'utf8').matchAll(HUD_SPECIFIER)].map((match) => ({ file: relative(SRC, file), specifier: match[2] })))

  it('sees the hud imports it guards, in source and in the test mocks', () => {
    expect(found.map(({ file }) => file)).toEqual(expect.arrayContaining(['RootLayout.tsx', join('screens', 'LoadoutScreen.tsx'), join('components', 'SeatTwoPanel.tsx'), join('components', 'GuideHost.tsx'), join('__tests__', 'seatlessGames.test.tsx')]))
  })

  it("names only '@tastic/hud/chrome', '@tastic/hud/guide' and '@tastic/hud/lobby'", () => {
    expect(found.filter(({ specifier }) => !ALLOWED.includes(specifier))).toEqual([])
  })
})
