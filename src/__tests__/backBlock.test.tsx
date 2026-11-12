import { router } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { useState } from 'react'
import { BackHandler, Pressable, Text, View } from 'react-native'

import { useBackBlock } from '../hooks/useBackBlock'
import { safeBack } from '../navigation'

// Runs useBackBlock under expo-router's real in-memory router (expo-router/testing-library), not a
// stand-in for usePreventRemove: DuelTastic's first copy of this passed its tests with the hook stubbed
// while Quit did nothing in the app.

// Android's back, as the router's container hears it: React Native's BackHandler is a no-op off
// Android, so this keeps every listener and calls them the way the OS does (the newest first, until
// one handles it).
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]
const backListeners: BackListener[] = []
jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
  backListeners.push(handler)
  return { remove: () => backListeners.splice(backListeners.indexOf(handler), 1) }
})
async function pressAndroidBack() {
  await act(async () => {
    for (const handler of [...backListeners].reverse()) if (handler({} as Parameters<BackListener>[0])) return
  })
}

// Whether the match has progress worth asking about (Game Over turns it off).
let mockHeld = true

// A play screen in miniature: Quit Match? as useQuitConfirmation (@tastic/hud) keeps it (asking only
// while there's progress, otherwise backing out with safeBack), a back chip, and the dialog's Quit.
function PlayScreen() {
  const [confirmVisible, setConfirmVisible] = useState(false)
  const requestBack = () => {
    if (mockHeld) setConfirmVisible(true)
    else safeBack()
  }
  const quit = useBackBlock(mockHeld, requestBack)
  return (
    <View>
      <Text>Match</Text>
      <Pressable accessibilityLabel='Back' onPress={requestBack} />
      {confirmVisible && (
        <View>
          <Text>Quit Match?</Text>
          <Pressable accessibilityLabel='Quit' onPress={quit} />
          <Pressable accessibilityLabel='Cancel' onPress={() => setConfirmVisible(false)} />
        </View>
      )}
    </View>
  )
}

const ROUTES = {
  index: () => <Text>Home</Text>,
  'play/[game]': PlayScreen
}

async function openMatch() {
  const rendered = await renderRouter(ROUTES, { initialUrl: '/' })
  await act(async () => router.push('/play/boxhockey'))
  expect(rendered.getPathname()).toBe('/play/boxhockey')
  return rendered
}

let warn: jest.SpyInstance
let error: jest.SpyInstance
beforeEach(() => {
  mockHeld = true
  backListeners.length = 0
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  error = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  // expo-router warns when a stopped navigation is carried on with the block still on.
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  warn.mockRestore()
  error.mockRestore()
})

describe('useBackBlock during a match', () => {
  it("opens Quit Match? on Android's back and stays in the match", async () => {
    const rendered = await openMatch()
    await pressAndroidBack()
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/boxhockey')
  })

  it("opens Quit Match? on the router's back (the browser's back goes through it)", async () => {
    const rendered = await openMatch()
    await act(async () => router.back())
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/boxhockey')
  })

  it("leaves on Quit Match?'s Quit", async () => {
    const rendered = await openMatch()
    await pressAndroidBack()
    await fireEvent.press(screen.getByLabelText('Quit'))
    expect(rendered.getPathname()).toBe('/')
    expect(screen.getByText('Home')).toBeTruthy()
  })

  it('stays on Cancel, and asks again on the next back', async () => {
    const rendered = await openMatch()
    await pressAndroidBack()
    await fireEvent.press(screen.getByLabelText('Cancel'))
    expect(screen.queryByText('Quit Match?')).toBeNull()
    await pressAndroidBack()
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/boxhockey')
  })

  it('leaves on the back chip once there is nothing to lose (Game Over)', async () => {
    mockHeld = false
    const rendered = await openMatch()
    await fireEvent.press(screen.getByLabelText('Back'))
    expect(rendered.getPathname()).toBe('/')
  })
})

describe('useBackBlock at Game Over', () => {
  it("leaves at once on Android's back", async () => {
    mockHeld = false
    const rendered = await openMatch()
    await pressAndroidBack()
    expect(screen.queryByText('Quit Match?')).toBeNull()
    expect(rendered.getPathname()).toBe('/')
  })

  it("leaves at once on the router's back", async () => {
    mockHeld = false
    const rendered = await openMatch()
    await act(async () => router.back())
    expect(rendered.getPathname()).toBe('/')
  })
})
