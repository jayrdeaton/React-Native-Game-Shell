import { useIsTouchPrimaryDevice } from '@tastic/core'
import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useAtComputer } from '../hooks/useAtComputer'

// A computer is the web without a touch-first screen (Jay, 2026-11-07: 2 Player is face to face only on
// a phone or tablet, natively or in its browser). core's own reading is a stand-in here.
jest.mock('@tastic/core', () => ({ ...jest.requireActual('@tastic/core'), useIsTouchPrimaryDevice: jest.fn() }))
const mockTouchPrimary = jest.mocked(useIsTouchPrimaryDevice)

afterEach(() => jest.restoreAllMocks())

describe('useAtComputer', () => {
  it('is a computer on the web without a touch-first screen, whatever the window', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    mockTouchPrimary.mockReturnValue(false)
    expect((await renderHook(() => useAtComputer())).result.current).toBe(true)
  })

  it("isn't in a phone's or tablet's browser", async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    mockTouchPrimary.mockReturnValue(true)
    expect((await renderHook(() => useAtComputer())).result.current).toBe(false)
  })

  it("isn't on a device", async () => {
    mockTouchPrimary.mockReturnValue(true)
    expect((await renderHook(() => useAtComputer())).result.current).toBe(false)
  })
})
