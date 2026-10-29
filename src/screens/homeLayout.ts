import { clamp, rotateInsets, useRotatedWindowDimensions, useRotation } from '@tastic/core'
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context'

// Home's geometry for a pack whose games have previews (GameDefinition.Preview), ported from
// Solitaire's components/homeLayout.ts. Upright, Home is the one scrolling column every pack has: the
// hero, seat 1's button, then a row per game, each row's preview at its start. Held sideways a phone
// is only ~400pt tall, and that column would spend the whole height on the hero before showing a
// single game, so a "wide" layout (any window whose ROTATED footprint is landscape: a phone held
// sideways, an iPad, a desktop browser) splits it into two panes: the hero and seat 1's button on the
// left, and a scrolling grid of game tiles on the right. The trophy (top-left) and cog (top-right)
// corner buttons stay where they are; the right pane stops short of the cog so tiles never scroll
// underneath it. A pack without previews keeps the column at every size.
//
// Everything here works in the ROTATED frame's own coordinates (Home's FakeLandscapeView): `width`/
// `height` are the rotated footprint and `insets` are the safe-area insets already remapped onto the
// frame's edges (rotateInsets). The rotated top/bottom insets are ~0 under a portrait-locked OS (a
// phone held sideways only has left/right insets), so nothing here leans on them for breathing room.

// Every preview's width / height: Solitaire's preview canvas (360 x 200), so its deals fit as drawn.
export const PREVIEW_ASPECT = 360 / 200
// A preview's width at the start of an upright row, where every other pack's icon sits.
export const ROW_PREVIEW_WIDTH = 92

// Wide layout: gap between the safe edge and the left pane.
export const HOME_WIDE_EDGE_PADDING = 16
// Wide layout: gap between the two panes.
export const HOME_WIDE_PANE_GAP = 16
// Wide layout: width reserved on the trailing side for the cog corner button (8pt margin, a 40pt
// IconButton, 8pt of air) ON TOP of the trailing safe-area inset.
export const HOME_WIDE_RIGHT_GUTTER = 56
// Cap on the two panes' combined width on a very wide window; past it the leftover is split into
// equal empty margins on both sides.
export const HOME_WIDE_MAX_CONTENT_WIDTH = 1100
export const HOME_LEFT_PANE_FRACTION = 0.38
export const HOME_LEFT_PANE_MIN = 260
export const HOME_LEFT_PANE_MAX = 340
// Gap between grid tiles (both axes).
export const HOME_GRID_GAP = 12
// Narrowest a wide-layout tile may get before the grid drops a column, and the most columns it uses.
export const HOME_MIN_TILE_WIDTH = 140
export const HOME_MAX_COLUMNS = 3
// Padding inside a wide-layout tile around its preview and text.
export const HOME_TILE_PADDING = 10
// Vertical band the corner buttons occupy at the top of a pane (8pt margin + 40pt button + 8pt air).
export const HOME_TOP_BAND = 56
// What the left pane stacks under the hero: seat 1's button (44, a 32pt chip in a pill padded 6pt)
// and the gap above it, and the pane's own bottom padding.
export const HOME_LEFT_PANE_PICKER_HEIGHT = 44
export const HOME_LEFT_PANE_PICKER_GAP = 12
const HOME_LEFT_PANE_BOTTOM_PADDING = 16
// The hero keeps this much clear of the left pane's sides.
const HOME_HERO_SIDE_ROOM = 16

export interface HomeLayout {
  // The rotated footprint is landscape: the two-pane layout is in effect (for a pack with previews).
  isWide: boolean
  // The window's footprint AFTER rotation.
  windowWidth: number
  windowHeight: number
  // Safe-area insets remapped onto the rotated frame's own edges (see @tastic/core's rotateInsets).
  insets: EdgeInsets
  // Wide layout: padding on the two panes' row. Each side hugs ITS OWN inset (a phone held sideways
  // has a large inset only on the island side), the trailing one also reserves the cog's gutter, and
  // both carry the equal margin left over once the content hits its cap. 0 upright.
  paddingLeft: number
  paddingRight: number
  leftPaneWidth: number
  rightPaneWidth: number
  columns: number
  // Outer width of one wide-layout tile, and of the preview inside it.
  tileWidth: number
  previewWidth: number
  // The box the hero has to fit in beside the grid (HeroTitleProps.fit); undefined upright.
  heroFit: { width: number; height: number } | undefined
}

// Pure form of useHomeLayout, for tests.
export function computeHomeLayout(windowWidth: number, windowHeight: number, insets: EdgeInsets): HomeLayout {
  const isWide = windowWidth > windowHeight
  if (!isWide) {
    return { isWide, windowWidth, windowHeight, insets, paddingLeft: 0, paddingRight: 0, leftPaneWidth: 0, rightPaneWidth: 0, columns: 1, tileWidth: 0, previewWidth: 0, heroFit: undefined }
  }

  const usable = windowWidth - insets.left - insets.right
  const inner = Math.max(0, usable - HOME_WIDE_EDGE_PADDING - HOME_WIDE_RIGHT_GUTTER)
  const content = Math.min(inner, HOME_WIDE_MAX_CONTENT_WIDTH)
  const slack = (inner - content) / 2

  // The left pane is a fraction of the content (within its own floor/ceiling), but never so wide that
  // the grid is left without room for at least one tile: a tiny window degrades to one narrow column,
  // never a negative width.
  const leftPaneWidth = Math.min(clamp(Math.round(HOME_LEFT_PANE_FRACTION * content), HOME_LEFT_PANE_MIN, HOME_LEFT_PANE_MAX), Math.max(0, content - HOME_WIDE_PANE_GAP - HOME_MIN_TILE_WIDTH))
  const rightPaneWidth = Math.max(0, content - HOME_WIDE_PANE_GAP - leftPaneWidth)
  const columns = clamp(Math.floor((rightPaneWidth + HOME_GRID_GAP) / (HOME_MIN_TILE_WIDTH + HOME_GRID_GAP)), 1, HOME_MAX_COLUMNS)
  const tileWidth = Math.max(0, Math.floor((rightPaneWidth - (columns - 1) * HOME_GRID_GAP) / columns))
  const previewWidth = Math.max(0, tileWidth - 2 * HOME_TILE_PADDING)

  // The hero gets the pane's width and whatever height the pane has left once the corner buttons'
  // band, seat 1's button and the bottom padding are taken: how it shrinks to fit is the pack's own.
  const heroFit = {
    width: Math.max(0, leftPaneWidth - HOME_HERO_SIDE_ROOM),
    height: Math.max(0, windowHeight - insets.top - insets.bottom - HOME_TOP_BAND - HOME_LEFT_PANE_PICKER_GAP - HOME_LEFT_PANE_PICKER_HEIGHT - HOME_LEFT_PANE_BOTTOM_PADDING)
  }

  return {
    isWide,
    windowWidth,
    windowHeight,
    insets,
    paddingLeft: insets.left + HOME_WIDE_EDGE_PADDING + slack,
    paddingRight: insets.right + HOME_WIDE_RIGHT_GUTTER + slack,
    leftPaneWidth,
    rightPaneWidth,
    columns,
    tileWidth,
    previewWidth,
    heroFit
  }
}

// The live layout for the current window and rotation. Reads useRotatedWindowDimensions()/
// rotateInsets() rather than raw useWindowDimensions()/useSafeAreaInsets(), so it describes the
// footprint a rotated Home actually renders into (both are exact identities at 0deg).
export function useHomeLayout(): HomeLayout {
  const { width, height } = useRotatedWindowDimensions()
  const rotation = useRotation()
  const insets = rotateInsets(useSafeAreaInsets(), rotation)
  return computeHomeLayout(width, height, insets)
}
