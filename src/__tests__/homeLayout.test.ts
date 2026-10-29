import { computeHomeLayout, HOME_GRID_GAP, HOME_LEFT_PANE_PICKER_GAP, HOME_LEFT_PANE_PICKER_HEIGHT, HOME_MAX_COLUMNS, HOME_MIN_TILE_WIDTH, HOME_TILE_PADDING, HOME_TOP_BAND, HOME_WIDE_EDGE_PADDING, HOME_WIDE_PANE_GAP, HOME_WIDE_RIGHT_GUTTER } from '../screens/homeLayout'

// Home's geometry for a pack with previews: the pane math is Solitaire's (its homeLayout.test.ts, the
// same numbers), and the hero gets a box to fit in rather than a scale.

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

// Everything on the two panes' row adds back up to the window's width, as long as the window is wide
// enough for the row's own fixed parts.
const rowWidth = (l: ReturnType<typeof computeHomeLayout>) => l.paddingLeft + l.leftPaneWidth + HOME_WIDE_PANE_GAP + l.rightPaneWidth + l.paddingRight

// The height the left pane gives the hero: the window, less its insets, the corner buttons' band,
// seat 1's button and the gap above it, and the pane's 16pt bottom padding.
const heroHeight = (height: number, insets: typeof NO_INSETS) => height - insets.top - insets.bottom - HOME_TOP_BAND - HOME_LEFT_PANE_PICKER_GAP - HOME_LEFT_PANE_PICKER_HEIGHT - 16

describe('computeHomeLayout, upright', () => {
  it('is the one column: no panes, no paddings, and the hero at its own size', () => {
    const insets = { top: 59, right: 0, bottom: 34, left: 0 }
    const layout = computeHomeLayout(402, 874, insets)
    expect(layout).toEqual({ isWide: false, windowWidth: 402, windowHeight: 874, insets, paddingLeft: 0, paddingRight: 0, leftPaneWidth: 0, rightPaneWidth: 0, columns: 1, tileWidth: 0, previewWidth: 0, heroFit: undefined })
  })

  it('treats a square window as upright (wide needs width strictly greater than height)', () => {
    expect(computeHomeLayout(600, 600, NO_INSETS).isWide).toBe(false)
    expect(computeHomeLayout(601, 600, NO_INSETS).isWide).toBe(true)
  })
})

describe('computeHomeLayout, a phone held sideways (874x402)', () => {
  // +90: the island on the leading (left) side, the home indicator on the trailing one. usable = 874 -
  // 62 - 34 = 778; inner = 778 - 16 - 56 = 706; content 706, no slack; left round(0.38 * 706) = 268;
  // right 706 - 16 - 268 = 422; columns floor(434 / 152) = 2; tile floor(410 / 2) = 205; preview 185.
  const insets = { top: 0, right: 34, bottom: 0, left: 62 }

  it("hugs each side's own inset and splits the panes 268 / 422 into two 205pt columns", () => {
    const layout = computeHomeLayout(874, 402, insets)
    expect(layout.isWide).toBe(true)
    expect(layout.paddingLeft).toBe(62 + HOME_WIDE_EDGE_PADDING)
    expect(layout.paddingRight).toBe(34 + HOME_WIDE_RIGHT_GUTTER)
    expect(layout.leftPaneWidth).toBe(268)
    expect(layout.rightPaneWidth).toBe(422)
    expect(layout.columns).toBe(2)
    expect(layout.tileWidth).toBe(205)
    expect(layout.previewWidth).toBe(205 - 2 * HOME_TILE_PADDING)
    expect(rowWidth(layout)).toBe(874)
  })

  it('gives the hero the left pane, 16pt in from its sides, and the height under the corner buttons and over seat 1', () => {
    expect(computeHomeLayout(874, 402, insets).heroFit).toEqual({ width: 268 - 16, height: heroHeight(402, insets) })
    expect(heroHeight(402, insets)).toBe(274)
  })
})

describe('computeHomeLayout, across devices', () => {
  const cases = [
    { name: 'a small phone, 667x375', width: 667, height: 375, insets: NO_INSETS, paddingLeft: 16, paddingRight: 56, leftPaneWidth: 260, rightPaneWidth: 319, columns: 2, tileWidth: 153 },
    { name: 'an iPhone X-class phone, 812x375', width: 812, height: 375, insets: { top: 0, right: 44, bottom: 21, left: 44 }, paddingLeft: 60, paddingRight: 100, leftPaneWidth: 260, rightPaneWidth: 376, columns: 2, tileWidth: 182 },
    { name: 'an iPad, 1194x834', width: 1194, height: 834, insets: { top: 24, right: 0, bottom: 20, left: 0 }, paddingLeft: 27, paddingRight: 67, leftPaneWidth: 340, rightPaneWidth: 744, columns: 3, tileWidth: 240 },
    { name: 'a desktop browser, 1440x900', width: 1440, height: 900, insets: NO_INSETS, paddingLeft: 150, paddingRight: 190, leftPaneWidth: 340, rightPaneWidth: 744, columns: 3, tileWidth: 240 }
  ]

  it.each(cases)('$name', ({ width, height, insets, paddingLeft, paddingRight, leftPaneWidth, rightPaneWidth, columns, tileWidth }) => {
    const layout = computeHomeLayout(width, height, insets)
    expect(layout.paddingLeft).toBe(paddingLeft)
    expect(layout.paddingRight).toBe(paddingRight)
    expect(layout.leftPaneWidth).toBe(leftPaneWidth)
    expect(layout.rightPaneWidth).toBe(rightPaneWidth)
    expect(layout.columns).toBe(columns)
    expect(layout.tileWidth).toBe(tileWidth)
    expect(layout.heroFit).toEqual({ width: leftPaneWidth - 16, height: heroHeight(height, insets) })
    expect(rowWidth(layout)).toBe(width)
  })

  it('never uses more columns than the cap, or tiles narrower than the floor while there is room', () => {
    for (let width = 601; width <= 2600; width += 37) {
      const layout = computeHomeLayout(width, 600, NO_INSETS)
      expect(layout.columns).toBeLessThanOrEqual(HOME_MAX_COLUMNS)
      if (layout.columns > 1) expect(layout.tileWidth).toBeGreaterThanOrEqual(HOME_MIN_TILE_WIDTH)
      expect(layout.columns * layout.tileWidth + (layout.columns - 1) * HOME_GRID_GAP).toBeLessThanOrEqual(layout.rightPaneWidth)
    }
  })

  it('degrades to empty boxes, never negative ones, in a tiny window', () => {
    const layout = computeHomeLayout(120, 80, NO_INSETS)
    expect(layout.leftPaneWidth).toBeGreaterThanOrEqual(0)
    expect(layout.rightPaneWidth).toBeGreaterThanOrEqual(0)
    expect(layout.tileWidth).toBeGreaterThanOrEqual(0)
    expect(layout.previewWidth).toBeGreaterThanOrEqual(0)
    expect(layout.heroFit).toEqual({ width: 0, height: 0 })
  })
})
