import type { SeedColor } from '@rific/auto-paper'
import type { AlignResult, PopoverHost } from '@tastic/hud/chrome'
import { type MenuOption, useZoneClampedAlign } from '@tastic/hud/lobby'
import { getOptionPickerContentSize, OptionPicker, type OptionPickerOption, type ProfilePickerColorSection } from '@tastic/profile'
import { useMemo } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'

import type { SeatTwo } from '../types'

// Player 1's say over seat 2 (Jay, 2026-11-07): one button on player 1's side, beside their own
// seat button, in every mode. It lists the CPU's levels (or one CPU row for a CPU with none), Solo
// (seat 2 empty, 'nobody') where the game has a solo mode, and Player, which hands seat 2 to a person,
// each kind of choice behind a divider (Jay, 2026-11-07): the loadout splits face
// to face and player 2 gets their own seat button (hud's PlayerSetupPanel, Player 2 or a profile,
// never the CPU). Player 1 keeps this button, so they're the one who takes the seat back for the CPU.
//
// The CPU's color is this button's Color row, as it was seat 2's: a CPU has no button of its own. A
// person's color is on their own button and Solo has none, so the row is only here for the CPU.
//
// Built on @tastic/profile's OptionPicker, so it opens, places itself and closes like the seat
// buttons beside it. It opens under `${idPrefix}-opponent` on player 1's host, so the loadout counts
// it as one of player 1's menus.

const CPU_PREFIX = 'cpu:'
const NOBODY = 'nobody'
const PERSON = 'person'

const PERSON_ICON = 'account-outline'
const NOBODY_ICON = 'account-off-outline'
const CPU_ICON = 'robot'

export function getOpponentPopoverId(idPrefix: string): string {
  return `${idPrefix}-opponent`
}

export interface OpponentPickerProps {
  // Player 1's prefix: this button is one of their menus.
  idPrefix: string
  host: PopoverHost
  // Seat 2's choices in this game (GameDefinition.seatTwo), in menu order.
  choices: readonly SeatTwo[]
  seatTwo: SeatTwo
  onSeatTwoChange: (seatTwo: SeatTwo) => void
  // The CPU's levels (GameLoadout.cpuDifficulty), or undefined for a CPU with none: one CPU row then.
  cpuDifficulty?: { value: string; options: MenuOption<string>[]; onChange: (value: string) => void }
  // Seat 2's color: the button's chip, and the CPU's Color row.
  color: string
  onColorChange: (hex: string) => void
  swatches: SeedColor[]
  takenColor?: string
  allowSwapTaken?: boolean
  dark: boolean
  // How seat 2's color is drawn (PackDefinition.previewColor), as PlayerSetupPanel's own previewValue:
  // `color` and what onColorChange receives stay the saved values.
  previewValue?: (hex: string) => string
  // The button's trigger style (a surface behind its pill over the pack's backdrop).
  triggerStyle?: StyleProp<ViewStyle>
  // A placement hook of the pack's own for the menu, in place of the zone clamp (PlayerSetupPanel's
  // useSeatPickerAlign): left unset inside a split-screen zone, and the same one for the button's life.
  usePickerAlign?: (open: boolean, contentWidth: number, contentHeight: number) => AlignResult
}

export function OpponentPicker({ idPrefix, host, choices, seatTwo, onSeatTwoChange, cpuDifficulty, color, onColorChange, swatches, takenColor, allowSwapTaken, dark, previewValue, triggerStyle, usePickerAlign }: OpponentPickerProps) {
  const drawn = previewValue ? previewValue(color) : color

  const cpuOptions = cpuDifficulty?.options
  const options = useMemo<OptionPickerOption<string>[]>(() => {
    const list: OptionPickerOption<string>[] = []
    if (choices.includes('cpu')) list.push(...(cpuOptions ? cpuOptions.map((o) => ({ value: `${CPU_PREFIX}${o.value}`, label: o.label, icon: o.icon })) : [{ value: CPU_PREFIX, label: 'CPU', icon: CPU_ICON }]))
    if (choices.includes('nobody')) list.push({ value: NOBODY, label: 'Solo', icon: NOBODY_ICON, dividerBefore: true })
    if (choices.includes('person')) list.push({ value: PERSON, label: 'Player', icon: PERSON_ICON, dividerBefore: true })
    return list
  }, [choices, cpuOptions])

  const value = seatTwo === 'cpu' ? `${CPU_PREFIX}${cpuDifficulty?.value ?? ''}` : seatTwo === 'nobody' ? NOBODY : PERSON
  const icon = seatTwo === 'cpu' ? CPU_ICON : seatTwo === 'nobody' ? NOBODY_ICON : PERSON_ICON

  const handleChange = (next: string) => {
    if (next.startsWith(CPU_PREFIX)) {
      cpuDifficulty?.onChange(next.slice(CPU_PREFIX.length))
      onSeatTwoChange('cpu')
    } else {
      onSeatTwoChange(next === NOBODY ? 'nobody' : 'person')
    }
  }

  const colorSection: ProfilePickerColorSection | undefined = seatTwo === 'cpu' ? { value: color, onChange: onColorChange, swatches, takenValue: takenColor, allowSwapTaken, previewValue } : undefined

  const pickerId = getOpponentPopoverId(idPrefix)
  const size = getOptionPickerContentSize(options, colorSection)
  // Kept inside player 1's half in 2 Player, like their own seat button, or placed by the pack's own
  // hook where it's given one.
  const useAlign = usePickerAlign ?? useZoneClampedAlign
  const align = useAlign(host.openId === pickerId, size.width, size.height)

  return (
    <View style={[styles.button, host.openId === pickerId && styles.buttonOpen]}>
      <OptionPicker id={pickerId} host={host} options={options} value={value} onChange={handleChange} color={drawn} dark={dark} icon={icon} colorSection={colorSection} alignOverride={align} triggerStyle={triggerStyle} />
    </View>
  )
}

const styles = StyleSheet.create({
  // Its own column, so a row of seat buttons doesn't stretch the pill to the tallest of them.
  button: {
    alignItems: 'center'
  },
  // A popover escaping this button needs the button itself elevated to paint above a later sibling.
  buttonOpen: {
    zIndex: 100
  }
})
