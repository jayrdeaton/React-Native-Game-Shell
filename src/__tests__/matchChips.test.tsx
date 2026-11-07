import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { MatchChips } from '../components/MatchChips'

const mockWindow = { width: 400, height: 800 }
let mockTouchPrimary = true
jest.mock('@tastic/core', () => ({ ...jest.requireActual('@tastic/core'), useIsTouchPrimaryDevice: () => mockTouchPrimary }))
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ ...mockWindow, scale: 1, fontScale: 1 }) }))
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 40, right: 2, bottom: 30, left: 4 }) }))
jest.mock('@rific/auto-paper', () => ({ useAutoPaperTheme: () => ({ dark: true }) }))
jest.mock('@rific/feedback-press', () => {
  const { Pressable: MockPressable } = jest.requireActual('react-native')
  return { IconButton: ({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) => <MockPressable onPress={onPress} accessibilityLabel={accessibilityLabel} /> }
})

const noop = () => {}
const slot = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style)

function setPlatform(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
}

beforeEach(() => {
  setPlatform('ios')
  mockTouchPrimary = true
  mockWindow.width = 400
  mockWindow.height = 800
})

describe('MatchChips', () => {
  it('sits in the window top corners with one human', async () => {
    await render(<MatchChips playing={false} faceToFace={false} onBack={noop} onSettings={noop} />)
    expect(slot('match-chips-back')).toMatchObject({ top: 48, left: 12 })
    expect(slot('match-chips-settings')).toMatchObject({ top: 48, right: 10 })
  })

  it('sits on the side edges at the line between the players face to face', async () => {
    await render(<MatchChips playing={false} faceToFace onBack={noop} onSettings={noop} />)
    expect(slot('match-chips-back')).toMatchObject({ top: 400 - 24, left: 12 })
    expect(slot('match-chips-settings')).toMatchObject({ top: 400 - 24, right: 10 })
  })

  it('follows a center line the game hands it', async () => {
    await render(<MatchChips playing={false} faceToFace centerLineY={300} onBack={noop} onSettings={noop} />)
    expect(slot('match-chips-back').top).toBe(276)
  })

  it('fades out and stops taking presses while play is on', async () => {
    await render(<MatchChips playing faceToFace={false} onBack={noop} onSettings={noop} />)
    for (const id of ['match-chips-back', 'match-chips-settings']) {
      expect(slot(id).opacity).toBe(0)
      expect(screen.getByTestId(id).props.pointerEvents).toBe('none')
    }
  })

  it('is up and pressable between plays', async () => {
    const onBack = jest.fn()
    const onSettings = jest.fn()
    await render(<MatchChips playing={false} faceToFace={false} onBack={onBack} onSettings={onSettings} />)
    expect(slot('match-chips-back').opacity).toBe(1)
    expect(screen.getByTestId('match-chips-back').props.pointerEvents).toBe('box-none')
    await fireEvent.press(screen.getByLabelText('Back'))
    await fireEvent.press(screen.getByLabelText('Settings'))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('stays up in the page corners at a computer, face to face or not, in a tall window too', async () => {
    setPlatform('web')
    mockTouchPrimary = false
    mockWindow.width = 900
    mockWindow.height = 1000
    await render(<MatchChips playing faceToFace onBack={noop} onSettings={noop} />)
    expect(slot('match-chips-back')).toMatchObject({ top: 48, left: 12, opacity: 1 })
    expect(screen.getByTestId('match-chips-back').props.pointerEvents).toBe('box-none')
  })

  it("treats a touch screen's browser as the device, however wide", async () => {
    setPlatform('web')
    mockWindow.width = 1280
    await render(<MatchChips playing faceToFace onBack={noop} onSettings={noop} />)
    expect(slot('match-chips-back')).toMatchObject({ top: 400 - 24, opacity: 0 })
  })
})
