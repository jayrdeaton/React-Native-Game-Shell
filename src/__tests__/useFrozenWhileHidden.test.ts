import { renderHook } from '@testing-library/react-native'

import { useFrozenWhileHidden } from '../hooks/useFrozenWhileHidden'

// What holds Home's layout while another screen covers it (screens/HomeScreen.tsx).
describe('useFrozenWhileHidden', () => {
  const setup = async (value: string, hidden: boolean) => renderHook(({ value: v, hidden: h }: { value: string; hidden: boolean }) => useFrozenWhileHidden(v, h), { initialProps: { value, hidden } })

  it('follows the value while shown', async () => {
    const { result, rerender } = await setup('column', false)
    await rerender({ value: 'grid', hidden: false })
    expect(result.current).toBe('grid')
  })

  it('holds the value from before it was hidden, whatever it becomes meanwhile', async () => {
    const { result, rerender } = await setup('column', false)
    await rerender({ value: 'column', hidden: true })
    await rerender({ value: 'grid', hidden: true })
    await rerender({ value: 'column', hidden: true })
    await rerender({ value: 'grid', hidden: true })
    expect(result.current).toBe('column')
  })

  // The value can change in the very commit that hides it: the outgoing value is the one kept.
  it('keeps the outgoing value when it changes in the same commit that hides it', async () => {
    const { result, rerender } = await setup('column', false)
    await rerender({ value: 'grid', hidden: true })
    expect(result.current).toBe('column')
  })

  it('catches up as soon as it is shown again', async () => {
    const { result, rerender } = await setup('column', false)
    await rerender({ value: 'grid', hidden: true })
    await rerender({ value: 'grid', hidden: false })
    expect(result.current).toBe('grid')
  })
})
