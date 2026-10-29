// The Expo preset (jest-expo), as in the apps this code came from, rather than @tastic/hud's ts-jest
// and jsdom: the shell is an Expo app's own code (expo-router screens, the splash screen, fonts), and
// its tests run the real redux-persist over AsyncStorage's own Jest mock and the real ProfilesProvider
// over @tastic/profile's native module (faked through expo-modules-core), which jest-expo provides.
// It enforces no coverage floor: the screens and providers are checked in the apps, not unit tested.
// maxWorkers is capped like the apps': Jest's own default (CPUs - 1) reliably triggers "A worker
// process has failed to exit gracefully" on a machine where several dev sessions share the cores.
module.exports = require('@infinitetoken/jest-config/expo')({ overrides: { maxWorkers: '50%' } })
