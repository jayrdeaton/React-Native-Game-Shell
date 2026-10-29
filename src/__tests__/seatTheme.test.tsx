import { act, renderHook } from '@testing-library/react-native'
import type { UnknownAction } from 'redux'

import { useSeatColors } from '../hooks/useSeatColors'
import { seatColorsActions } from '../redux/seatColorsSlice'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { PackDefinition, Seat } from '../types'

// A pack's seatTheme (Solitaire's: a muted seed from seat 1's color, harmony 'triadic'): the theme is
// what seatTheme makes of the seats' colors, applied again when dark mode flips, and each seat's color
// is read from where it's remembered (the seatColors key) rather than from the theme. Without it the
// theme stays a triad of the raw seat colors, read back from its primary and secondary. The real hook
// over the real store and pack; auto-paper's live theme, the profiles and expo-router's focus effect
// are stand-ins.

let mockDark = false
let mockThemeSettings: { color: unknown; harmony: string } = { color: '#000000', harmony: 'split-complementary' }
const mockSetTheme = jest.fn((patch: { color?: unknown; harmony?: string }) => {
  mockThemeSettings = { ...mockThemeSettings, ...patch }
})
let mockProfiles: { id: string; name: string; color: string; tag: string; createdAt: number; updatedAt: number }[] = []
let mockSeatOne: string | null = null

jest.mock('@rific/auto-paper', () => ({
  ...jest.requireActual('@rific/auto-paper'),
  useAutoPaperTheme: () => ({ dark: mockDark, colors: { primary: '#aaaaaa', secondary: '#bbbbbb' } }),
  useThemeSettings: () => ({ settings: mockThemeSettings, set: mockSetTheme })
}))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: mockProfiles, lastSelected: { 1: mockSeatOne, 2: null } }) }))
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return { useFocusEffect: (callback: () => void) => useEffect(callback, [callback]), router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }
})

// Solitaire's shape: the seed is seat 1's color, marked with the mode it was muted for.
const seatTheme = jest.fn((colors: Record<Seat, string>, dark: boolean) => ({ color: `${colors[1]}/${dark ? 'dark' : 'light'}`, harmony: 'triadic' as const }))

async function renderSeatColors(overrides: Partial<PackDefinition> = {}) {
  const pack = standInPack([standInGame('pong')], overrides)
  const store = standInStore(pack)
  const view = await renderHook(() => useSeatColors(false), { wrapper: shellWrapper(pack, store) })
  return { store, ...view }
}

beforeEach(() => {
  mockDark = false
  mockThemeSettings = { color: '#000000', harmony: 'split-complementary' }
  mockSetTheme.mockClear()
  seatTheme.mockClear()
  mockProfiles = []
  mockSeatOne = null
})

describe('without a seatTheme', () => {
  it("keeps the theme a triad of the seats' colors, and reads each seat's color back from it", async () => {
    const { result } = await renderSeatColors()

    expect(mockSetTheme).toHaveBeenCalledWith({ color: expect.objectContaining({ primary: '#2196f3', secondary: '#f44336' }) })
    expect(result.current.p1Color).toBe('#aaaaaa')
    expect(result.current.p2Color).toBe('#bbbbbb')
  })
})

describe("a pack's seatTheme", () => {
  it("makes the theme from the seats' remembered colors, and hands each seat its own color", async () => {
    const { result } = await renderSeatColors({ seatTheme })

    expect(mockSetTheme).toHaveBeenLastCalledWith({ color: '#2196f3/light', harmony: 'triadic' })
    expect(seatTheme).toHaveBeenLastCalledWith({ 1: '#2196f3', 2: '#f44336' }, false)
    expect(result.current.p1Color).toBe('#2196f3')
    expect(result.current.p2Color).toBe('#f44336')
  })

  it('applies it again when dark mode flips', async () => {
    const { rerender } = await renderSeatColors({ seatTheme })
    mockDark = true
    await act(async () => rerender({}))

    expect(mockSetTheme).toHaveBeenLastCalledWith({ color: '#2196f3/dark', harmony: 'triadic' })
  })

  it('writes nothing when the theme already is what it makes', async () => {
    mockThemeSettings = { color: '#2196f3/light', harmony: 'triadic' }
    await renderSeatColors({ seatTheme })

    // Only the focus effect, which always re-derives on focus.
    expect(mockSetTheme).toHaveBeenCalledTimes(1)
  })

  it("follows a new color for seat 1: the theme at once, and the color remembered as the guest's", async () => {
    const { result, store } = await renderSeatColors({ seatTheme })
    await act(async () => result.current.handleP1ColorChange('#4caf50'))

    expect(mockSetTheme).toHaveBeenCalledWith({ color: '#4caf50/light', harmony: 'triadic' })
    expect(store.getState().seatColors.lastGuestColor[1]).toBe('#4caf50')
    expect(result.current.p1Color).toBe('#4caf50')
  })

  it("reads a profile's pick in this pack for the profile in seat 1", async () => {
    mockProfiles = [{ id: 'ada', name: 'Ada', color: '#9c27b0', tag: 'ADA', createdAt: 0, updatedAt: 0 }]
    mockSeatOne = 'ada'
    const { result, store } = await renderSeatColors({ seatTheme })
    expect(result.current.p1Color).toBe('#9c27b0')

    await act(async () => {
      store.dispatch(seatColorsActions.setProfileColor({ profile: mockProfiles[0], color: '#ff9800' }) as unknown as UnknownAction)
    })
    expect(result.current.p1Color).toBe('#ff9800')
    expect(mockSetTheme).toHaveBeenLastCalledWith({ color: '#ff9800/light', harmony: 'triadic' })
  })
})
