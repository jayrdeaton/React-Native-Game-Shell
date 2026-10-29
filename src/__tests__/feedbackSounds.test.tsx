import { render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import type { Persistor } from 'redux-persist'

import { Providers } from '../components/Providers'
import { PackProvider } from '../PackContext'
import { standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { FeedbackSounds, PackDefinition } from '../types'

// The two sounds feedback-press plays on every button press: the shell's own wavs, or the pack's
// (PackDefinition.useFeedbackSounds: Solitaire's card sound and invalid-move sound). The real
// Providers over the real store, with persistence, Edge Guard, Keep Awake and feedback-press's own
// provider passing their children through; feedback-press's bridge records the sounds it's handed.

const mockBridge = jest.fn((_props: { sound?: FeedbackSounds }) => ({}))
const mockAudioPool = jest.fn((_source: unknown) => () => {})

jest.mock('redux-persist/integration/react', () => ({ PersistGate: ({ children }: { children: ReactNode }) => children }))
jest.mock('@tastic/edge-guard', () => ({ useEdgeGestureGuard: () => {} }))
jest.mock('@rific/core', () => ({ ...jest.requireActual('@rific/core'), KeepAwakeProvider: ({ children }: { children: ReactNode }) => children }))
jest.mock('@rific/feedback-press', () => ({
  ...jest.requireActual('@rific/feedback-press'),
  FeedbackPressProvider: ({ children }: { children: ReactNode }) => children,
  useFeedbackBridgeProps: (props: { sound?: FeedbackSounds }) => mockBridge(props)
}))
jest.mock('@rific/feedback-press/audio', () => ({ useAudioPool: (source: unknown) => mockAudioPool(source) }))

async function renderProviders(overrides: Partial<PackDefinition> = {}) {
  const pack = standInPack([standInGame('pong')], overrides)
  await render(
    <PackProvider pack={pack}>
      <Providers store={standInStore(pack) as never} persistor={{} as Persistor}>
        {null}
      </Providers>
    </PackProvider>
  )
  return mockBridge.mock.lastCall![0].sound!
}

beforeEach(() => {
  mockBridge.mockClear()
  mockAudioPool.mockClear()
})

describe("every button's sounds", () => {
  it("are the shell's own two by default", async () => {
    const sound = await renderProviders()

    expect(mockAudioPool).toHaveBeenCalledTimes(2)
    expect(sound.selection).toBe(mockAudioPool.mock.results[0].value)
    expect(sound.notification).toBe(mockAudioPool.mock.results[1].value)
  })

  it("are the pack's own where it has them, and the shell's are never loaded", async () => {
    const selection = jest.fn()
    const notification = jest.fn()
    const sound = await renderProviders({ useFeedbackSounds: () => ({ selection, notification }) })

    expect(sound).toEqual({ selection, notification })
    expect(mockAudioPool).not.toHaveBeenCalled()
  })
})
