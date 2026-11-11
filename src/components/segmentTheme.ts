/**
 * Paper's SegmentedButtons, drawn clean on iOS (Home's tabs, the stats screen's tabs). Paper rounds a switch's ends
 * at 5 x the theme's roundness (20pt) and lets the label set a segment's height, which on iOS comes out a third of a
 * point over a whole number (40.33pt). React Native draws the border of a segment with uneven corners (an end segment)
 * as a small image stretched to fit, and with a 20pt corner that image needs 41pt: at a fractional height short of
 * that, the last segment's left border is smeared across it, a thin line at mid-height ("Two Player" on Home,
 * "Achievements" on the stats screen, in CardTastic's App Store screenshots, 2026-11-11). A 19pt corner needs 39pt,
 * so it fits whatever the label's height, and the ends still look fully round. CardTastic found and fixed the same in
 * its own switches (2026-11-08); the web never shows it.
 */
export const SEGMENT_THEME = { roundness: 3.8 }

/** The ends' corner radius that `SEGMENT_THEME` gives (Paper's V3 segments round at 5 x roundness), for a surface drawn behind a switch. */
export const SEGMENT_RADIUS = 5 * SEGMENT_THEME.roundness
