import type { AlignResult } from '@tastic/hud/chrome'
import { render, renderHook } from '@testing-library/react-native'
import { createRef, type ReactNode } from 'react'

import { ProfilesRoute } from '../screens/ProfilesRoute'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { PackDefinition } from '../types'

// The Profiles screen turned with the phone in every pack (hud's RotatedFrame: the insets remapped onto
// its edges for ProfilesManager, the delete confirm portaled into the frame, the roster capped in the
// wide layout), a new profile's color, the swatch placed by the pack's usePickerAlign, and the screen
// drawn over a pack's Backdrop. The frame and
// @tastic/profile's screen record what they're handed.

const mockFrame = jest.fn()
const mockProfilesScreen = jest.fn()

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], createProfile: jest.fn(), updateProfile: jest.fn(), deleteProfile: jest.fn() }) }))
jest.mock('@tastic/hud/chrome', () => ({
  ...jest.requireActual('@tastic/hud/chrome'),
  RotatedFrame: ({ children, ...props }: { children: ReactNode }) => {
    mockFrame(props)
    return children
  }
}))
jest.mock('@tastic/profile', () => ({
  ...jest.requireActual('@tastic/profile'),
  ProfilesScreen: (props: object) => {
    mockProfilesScreen(props)
    return null
  }
}))

async function renderProfiles(overrides: Partial<PackDefinition> = {}) {
  const pack = standInPack([standInGame('pong')], overrides)
  await render(<ProfilesRoute />, { wrapper: shellWrapper(pack, standInStore(pack)) })
  return mockProfilesScreen.mock.lastCall![0]
}

beforeEach(() => {
  mockFrame.mockClear()
  mockProfilesScreen.mockClear()
})

describe('the Profiles screen', () => {
  it('turns with the phone, its insets and delete confirm in the frame, its roster capped in the wide layout', async () => {
    await renderProfiles()

    expect(mockFrame).toHaveBeenLastCalledWith(expect.objectContaining({ rotatedSafeArea: true, portalHost: true, maxContentWidth: 640 }))
  })

  it("starts a new profile on auto-paper's first swatch, and on the pack's own color where it sets one", async () => {
    expect((await renderProfiles()).defaultColor).toBe('#f44336')
    expect((await renderProfiles({ newProfileColor: '#9c27b0' })).defaultColor).toBe('#9c27b0')
  })

  it("places a profile's color swatch with the pack's usePickerAlign, inside the roster's capped column", async () => {
    const usePickerAlign = jest.fn((_open: boolean, _width: number, _height: number, _options?: { maxContentWidth?: number }): AlignResult => ({ align: 'center', verticalAlign: 'below', maxHeight: 300, measured: true, triggerRef: createRef() }))
    const props = await renderProfiles({ usePickerAlign })
    const pack = standInPack([standInGame('pong')], { usePickerAlign })
    await renderHook(() => props.useColorPickerAlign(true, 200, 100), { wrapper: shellWrapper(pack, standInStore(pack)) })

    expect(usePickerAlign).toHaveBeenLastCalledWith(true, 200, 100, { maxContentWidth: 640 })
    expect((await renderProfiles()).useColorPickerAlign).toBeUndefined()
  })

  it("draws over the pack's Backdrop in its foreground, and opaque by default", async () => {
    expect(await renderProfiles({ Backdrop: () => null, foreground: '#F5F1E6' })).toEqual(expect.objectContaining({ bg: 'transparent', fg: '#F5F1E6' }))
    expect(await renderProfiles()).toEqual(expect.objectContaining({ bg: undefined, fg: undefined }))
  })
})
