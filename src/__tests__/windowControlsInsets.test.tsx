import { render, screen } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'
import { type EdgeInsets, SafeAreaCornerAdaptedInsetsContext, SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'

import { WindowControlsInsets } from '../components/WindowControlsInsets'

// WindowControlsInsets: on iPad every screen reads the vertically corner-adapted safe area (the top lowered below
// iPadOS's window controls when the app runs in a window), and on every other device the regular one. The numbers are
// the iPad 13" simulator's in a 375x667 window.

const REGULAR: EdgeInsets = { top: 10, right: 0, bottom: 10, left: 0 }
const VERTICAL: EdgeInsets = { top: 53, right: 0, bottom: 10, left: 0 }
const HORIZONTAL: EdgeInsets = { top: 10, right: 10, bottom: 10, left: 66 }

function setPlatform(os: 'ios' | 'android' | 'web', isPad: boolean) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
  Object.defineProperty(Platform, 'isPad', { configurable: true, get: () => isPad })
}

function Probe() {
  const { top, left } = useSafeAreaInsets()
  return <Text testID='insets'>{`${top} ${left}`}</Text>
}

async function renderInsets() {
  await render(
    <SafeAreaInsetsContext.Provider value={REGULAR}>
      <SafeAreaCornerAdaptedInsetsContext.Provider value={{ vertical: VERTICAL, horizontal: HORIZONTAL }}>
        <WindowControlsInsets>
          <Probe />
        </WindowControlsInsets>
      </SafeAreaCornerAdaptedInsetsContext.Provider>
    </SafeAreaInsetsContext.Provider>
  )
  return screen.getByTestId('insets').props.children
}

afterEach(() => setPlatform('ios', false))

it('hands every screen on an iPad the top lowered below the window controls', async () => {
  setPlatform('ios', true)
  expect(await renderInsets()).toBe('53 0')
})

it('leaves the safe area alone on an iPhone, whose vertical inset grows in landscape for its rounded corners', async () => {
  setPlatform('ios', false)
  expect(await renderInsets()).toBe('10 0')
})

it('leaves it alone on Android and the web', async () => {
  setPlatform('android', false)
  expect(await renderInsets()).toBe('10 0')
  setPlatform('web', false)
  expect(await renderInsets()).toBe('10 0')
})
