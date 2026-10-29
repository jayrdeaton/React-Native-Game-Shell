// One entry, the barrel (src/index.ts). Metro and Expo's web build read src/ through the
// "react-native" and "browser" export conditions, so dist/ only serves plain Node and type
// resolution. Providers.tsx requires the two UI sounds the package ships (assets/sounds/): the copy
// loader puts each next to the built files and points the require at it, so dist/ stays loadable.
module.exports = require('@infinitetoken/tsconfig/tsup/lib')('src/index.ts', { loader: { '.wav': 'copy' } })
