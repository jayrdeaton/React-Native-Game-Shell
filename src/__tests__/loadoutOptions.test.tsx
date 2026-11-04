import type { AlignResult } from '@tastic/hud/chrome'
import { act, render, screen } from '@testing-library/react-native'
import { createRef, type ReactNode } from 'react'
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native'

import { opponentActions } from '../redux/opponentSlice'
import { type LoadoutGame, LoadoutScreen } from '../screens/LoadoutScreen'
import { shellWrapper, STAND_IN_LOADOUT, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { GameLoadout, LoadoutOptionsProps, PackDefinition, SeatControlLook, SeatTwo } from '../types'

// The loadout's options for a pack for one player at a time on a felt (Solitaire's, adding RatSlap),
// the ones Home already honored: a Backdrop under a transparent loadout drawn in the pack's
// foreground, seat 1's guest labels, every seat color through previewColor, the seat buttons on a
// surface over the backdrop, and the seat buttons' menus placed by the pack in the one-human row. A
// pack without them keeps the loadout as it was. The real loadout over the real store and pack; the
// insets, expo-router, How to Play host, Settings, profiles and seat colors are stand-ins, and so are
// hud's seat 1 panel, Ready button, corner buttons and shared band, @tastic/profile's menu button
// (seat 2's) and split-screen's zones, which record what they're handed.

jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => {
  const { useEffect: useReactEffect } = require('react')
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useFocusEffect: (effect: () => void) => useReactEffect(effect, [effect])
  }
})
jest.mock('../components/GuideHost', () => ({ ...jest.requireActual('../components/GuideHost'), useGameGuide: () => ({ openFirstTime: jest.fn(), openFor: jest.fn(), openPack: jest.fn(), autoShowPack: jest.fn() }) }))
jest.mock('../components/SettingsDialog', () => ({ SettingsDialog: () => null }))
const ADA = { id: 'ada', name: 'Ada', color: '#00ff00', tag: 'ADA', createdAt: 0, updatedAt: 0 }
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [ADA], lastSelected: { 1: null, 2: null }, selectProfile: jest.fn() }) }))
jest.mock('../hooks/useSeatColors', () => ({ useSeatColors: () => ({ p1Color: '#2196f3', p2Color: '#f44336', handleP1ColorChange: jest.fn(), handleP2ColorChange: jest.fn() }) }))

const mockPanel = jest.fn()
const mockPanelMounts = jest.fn()
const mockReady = jest.fn()
const mockCorner = jest.fn()
const mockBand = jest.fn()
jest.mock('@tastic/hud/lobby', () => {
  const { View: RNView } = require('react-native')
  const { useEffect: useReactEffect } = require('react')
  return {
    ...jest.requireActual('@tastic/hud/lobby'),
    PlayerSetupPanel: (props: Record<string, unknown>) => {
      mockPanel(props)
      useReactEffect(() => mockPanelMounts(), [])
      return <RNView testID='seat-1' />
    },
    ReadyButton: (props: { color: string }) => {
      mockReady(props)
      return null
    },
    SharedActionBand: ({ fg, children }: { fg: string; children: ReactNode }) => {
      mockBand(fg)
      return <RNView>{children}</RNView>
    }
  }
})
jest.mock('@tastic/hud/chrome', () => ({
  ...jest.requireActual('@tastic/hud/chrome'),
  CornerActionButtons: ({ fg }: { fg: string }) => {
    mockCorner(fg)
    return null
  }
}))
// The panels' fade runs on Reanimated, which the package's mock doesn't animate: the layout follows
// the reading at once, and 2 Player's two halves and the band between them are all drawn.
jest.mock('@tastic/split-screen', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/split-screen'),
    useDualZoneLayout: (orientationMode: string, p1OnRight: boolean, _resolved: boolean, upsideDown: boolean) => ({ panelLayout: { orientationMode, p1OnRight, upsideDown }, panelFadeStyle: {} }),
    DualZoneLayout: ({ p1, p2, shared }: { p1: ReactNode; p2: ReactNode; shared: ReactNode }) => (
      <RNView>
        {p1}
        {shared}
        {p2}
      </RNView>
    )
  }
})
const mockOptionPicker = jest.fn()
jest.mock('@tastic/profile', () => {
  const { View: RNView } = require('react-native')
  return {
    ...jest.requireActual('@tastic/profile'),
    OptionPicker: (props: { id: string }) => {
      mockOptionPicker(props)
      return <RNView testID={props.id} />
    }
  }
})

const lastPanel = () => mockPanel.mock.lastCall![0]
const lastSeatTwo = () =>
  mockOptionPicker.mock.calls
    .map(([props]) => props)
    .filter((props) => props.id === 'p2-seat')
    .pop()

// A loadout that records what its options row and seat controls are handed.
const optionsArgs = jest.fn((_args: LoadoutOptionsProps) => null)
const controlLooks = jest.fn((_seat: number, _look: SeatControlLook) => undefined)
const recordingLoadout: GameLoadout = { ...STAND_IN_LOADOUT, options: optionsArgs, seatControl: (seat, _host, look) => controlLooks(seat, look) }
const ratslap = standInGame('ratslap', { seatTwo: ['cpu', 'person'], useLoadout: () => recordingLoadout }) as LoadoutGame

async function renderLoadout(overrides: Partial<PackDefinition> = {}, seatTwo: SeatTwo = 'cpu') {
  const pack = standInPack([ratslap], overrides)
  const store = standInStore(pack)
  store.dispatch(opponentActions.setSeatTwo(seatTwo))
  const view = await render(<LoadoutScreen game={ratslap} />, { wrapper: shellWrapper(pack, store) as (props: { children: ReactNode }) => ReactNode })
  return { ...view, store }
}

beforeEach(() => {
  for (const mock of [mockPanel, mockPanelMounts, mockReady, mockCorner, mockBand, mockOptionPicker, optionsArgs, controlLooks]) mock.mockClear()
})

describe("a pack's Backdrop and foreground", () => {
  const rootBackground = () => StyleSheet.flatten((screen.toJSON() as unknown as { props: { style: StyleProp<ViewStyle> } }).props.style).backgroundColor

  it('leave the loadout opaque, in black or white, with plain seat buttons, by default', async () => {
    await renderLoadout()

    expect(rootBackground()).toBe('#FFFFFF')
    expect(mockCorner).toHaveBeenLastCalledWith('#000000')
    expect(optionsArgs.mock.lastCall![0].mutedColor).toBe('rgba(0,0,0,0.5)')
    expect(lastPanel().triggerStyle).toBeUndefined()
    expect(lastSeatTwo().triggerStyle).toBeUndefined()
  })

  it('draw the loadout transparent over the backdrop, in the foreground and half of it, with the seat buttons on a surface', async () => {
    await renderLoadout({ Backdrop: () => null, foreground: '#F5F1E6' })

    expect(rootBackground()).toBe('transparent')
    expect(mockCorner).toHaveBeenLastCalledWith('#F5F1E6')
    expect(optionsArgs.mock.lastCall![0].mutedColor).toBe('rgba(245,241,230,0.5)')
    expect(controlLooks.mock.lastCall![1].mutedColor).toBe('rgba(245,241,230,0.5)')
    const pill = expect.objectContaining({ borderRadius: 999, backgroundColor: expect.any(String) })
    expect(StyleSheet.flatten(lastPanel().triggerStyle)).toEqual(pill)
    expect(StyleSheet.flatten(lastSeatTwo().triggerStyle)).toEqual(pill)
  })

  it("draw 2 Player's shared band in the foreground too", async () => {
    await renderLoadout({ Backdrop: () => null, foreground: '#F5F1E6' }, 'person')

    expect(mockBand).toHaveBeenLastCalledWith('#F5F1E6')
  })
})

describe("seat 1's button", () => {
  it('says P1 for a guest by default, and what the pack says where it says', async () => {
    await renderLoadout()
    expect(lastPanel()).toEqual(expect.objectContaining({ guestLabel: 'P1', nullLabel: undefined }))

    await renderLoadout({ guestLabel: 'GUEST', nullLabel: 'Guest' })
    expect(lastPanel()).toEqual(expect.objectContaining({ guestLabel: 'GUEST', nullLabel: 'Guest' }))
  })
})

describe("the seats' colors", () => {
  const previewColor = (hex: string, dark: boolean) => `${hex}/${dark ? 'dark' : 'light'}`

  it("draw through the pack's previewColor on both seat buttons, the Ready button and the seat controls, keeping the saved ones", async () => {
    await renderLoadout({ previewColor })

    expect(lastPanel().color).toBe('#2196f3')
    expect(lastPanel().previewValue('#ff0000')).toBe('#ff0000/light')
    expect(lastSeatTwo().color).toBe('#f44336/light')
    expect(lastSeatTwo().colorSection.value).toBe('#f44336')
    expect(lastSeatTwo().colorSection.previewValue('#ff0000')).toBe('#ff0000/light')
    expect(mockReady.mock.lastCall![0].color).toBe('#2196f3/light')
    expect(controlLooks).toHaveBeenLastCalledWith(1, expect.objectContaining({ seatColor: '#2196f3/light' }))
  })

  it("draw each profile in seat 2's menu through it too", async () => {
    await renderLoadout({ previewColor })

    expect(lastSeatTwo().options).toContainEqual(expect.objectContaining({ label: 'Ada', color: '#00ff00/light' }))
  })

  it('draw raw, with no preview, in a pack without one', async () => {
    await renderLoadout()

    expect(lastPanel().previewValue).toBeUndefined()
    expect(lastSeatTwo().color).toBe('#f44336')
    expect(lastSeatTwo().colorSection.previewValue).toBeUndefined()
    expect(lastSeatTwo().options).toContainEqual(expect.objectContaining({ label: 'Ada', color: '#00ff00' }))
    expect(mockReady.mock.lastCall![0].color).toBe('#2196f3')
  })
})

describe("the seat buttons' menu placement", () => {
  // A stand-in placement that says where it was asked to place what.
  const placement = (open: boolean, width: number, height: number): AlignResult => ({ align: 'center', verticalAlign: open ? 'above' : 'below', maxHeight: width + height, measured: true, triggerRef: createRef() })

  it("is the panels' own by default", async () => {
    await renderLoadout()

    expect(lastPanel().useSeatPickerAlign).toBeUndefined()
  })

  it("is the pack's own in the one-human row, for seat 1's menu and seat 2's", async () => {
    const usePickerAlign = jest.fn(placement)
    await renderLoadout({ usePickerAlign })

    expect(lastPanel().useSeatPickerAlign).toBe(usePickerAlign)
    expect(lastSeatTwo().alignOverride.verticalAlign).toBe('below')
    const [open, width, height] = usePickerAlign.mock.lastCall!
    expect(open).toBe(false)
    expect(lastSeatTwo().alignOverride.maxHeight).toBe(width + height)
  })

  it("keeps each menu in its own player's half in 2 Player", async () => {
    const usePickerAlign = jest.fn(placement)
    await renderLoadout({ usePickerAlign }, 'person')

    expect(lastPanel().useSeatPickerAlign).toBeUndefined()
    expect(usePickerAlign).not.toHaveBeenCalled()
  })

  it("remounts seat 1's panel when the layout changes, so its placement hook never changes under it", async () => {
    const { store } = await renderLoadout({ usePickerAlign: jest.fn(placement) })
    expect(mockPanelMounts).toHaveBeenCalledTimes(1)

    await act(async () => store.dispatch(opponentActions.setSeatTwo('person')))
    expect(lastPanel().useSeatPickerAlign).toBeUndefined()
    expect(mockPanelMounts).toHaveBeenCalledTimes(2)
  })
})
