import { render } from '@testing-library/react-native'
import { router } from 'expo-router'
import { type ReactNode } from 'react'

import { EditProfileRoute } from '../screens/EditProfileRoute'
import { ProfilesRoute } from '../screens/ProfilesRoute'
import { shellWrapper, standInGame, standInPack, standInStore } from '../testUtils/pack'
import type { PackDefinition } from '../types'

// The Profiles screen and a profile's Edit Profile screen in every pack (hud's ScreenFrame: the
// delete confirm portaled into the frame, the column capped in the wide layout), a new profile's
// color, the list opening a profile's route, and both drawn over a pack's Backdrop. The frame and
// @tastic/profile's screens record what they're handed.

const mockFrame = jest.fn()
const mockProfilesScreen = jest.fn()
const mockEditProfileScreen = jest.fn()
const mockParams: { id?: string } = {}

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => mockParams }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], createProfile: jest.fn(), updateProfile: jest.fn(), deleteProfile: jest.fn() }) }))
jest.mock('@tastic/hud/chrome', () => ({
  ...jest.requireActual('@tastic/hud/chrome'),
  ScreenFrame: ({ children, ...props }: { children: ReactNode }) => {
    mockFrame(props)
    return children
  }
}))
jest.mock('@tastic/profile', () => ({
  ...jest.requireActual('@tastic/profile'),
  ProfilesScreen: (props: object) => {
    mockProfilesScreen(props)
    return null
  },
  EditProfileScreen: (props: object) => {
    mockEditProfileScreen(props)
    return null
  }
}))

async function renderProfiles(overrides: Partial<PackDefinition> = {}) {
  const pack = standInPack([standInGame('pong')], overrides)
  await render(<ProfilesRoute />, { wrapper: shellWrapper(pack, standInStore(pack)) })
  return mockProfilesScreen.mock.lastCall![0]
}

async function renderEditProfile(id: string, overrides: Partial<PackDefinition> = {}) {
  mockParams.id = id
  const pack = standInPack([standInGame('pong')], overrides)
  await render(<EditProfileRoute />, { wrapper: shellWrapper(pack, standInStore(pack)) })
  return mockEditProfileScreen.mock.lastCall![0]
}

beforeEach(() => {
  mockFrame.mockClear()
  mockProfilesScreen.mockClear()
  mockEditProfileScreen.mockClear()
  jest.mocked(router.push).mockClear()
})

describe('the Profiles screen', () => {
  it('turns with the phone, its insets in the frame, its roster capped in the wide layout', async () => {
    await renderProfiles()

    expect(mockFrame).toHaveBeenLastCalledWith(expect.objectContaining({ maxContentWidth: 640 }))
  })

  it("opens a profile's Edit Profile screen, the pack's profile/[id] route", async () => {
    const props = await renderProfiles()
    props.onEdit('abc')
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/profile/[id]', params: { id: 'abc' } })
    props.onEdit('new')
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/profile/[id]', params: { id: 'new' } })
  })

  it("draws over the pack's Backdrop in its foreground, and opaque by default", async () => {
    expect(await renderProfiles({ Backdrop: () => null, foreground: '#F5F1E6' })).toEqual(expect.objectContaining({ bg: 'transparent', fg: '#F5F1E6' }))
    expect(await renderProfiles()).toEqual(expect.objectContaining({ bg: undefined, fg: undefined }))
  })
})

describe("a profile's Edit Profile screen", () => {
  it('turns with the phone, its insets and delete confirm in the frame, its column capped in the wide layout', async () => {
    await renderEditProfile('abc')

    expect(mockFrame).toHaveBeenLastCalledWith(expect.objectContaining({ portalHost: true, maxContentWidth: 640 }))
  })

  it("edits the profile its route names, 'new' for a new one", async () => {
    expect((await renderEditProfile('abc')).profileId).toBe('abc')
    expect((await renderEditProfile('new')).profileId).toBe('new')
  })

  it("starts a new profile on auto-paper's first swatch, and on the pack's own color where it sets one", async () => {
    expect((await renderEditProfile('new')).defaultColor).toBe('#f44336')
    expect((await renderEditProfile('new', { newProfileColor: '#9c27b0' })).defaultColor).toBe('#9c27b0')
  })

  it("draws over the pack's Backdrop in its foreground, and opaque by default", async () => {
    expect(await renderEditProfile('abc', { Backdrop: () => null, foreground: '#F5F1E6' })).toEqual(expect.objectContaining({ bg: 'transparent', fg: '#F5F1E6' }))
    expect(await renderEditProfile('abc')).toEqual(expect.objectContaining({ bg: undefined, fg: undefined }))
  })

  it("draws the pack's own sections for the profile, and none where the pack has none", async () => {
    const Sections = ({ profile }: { profile: { name: string } }) => <>{profile.name}</>
    const props = await renderEditProfile('abc', { ProfileSections: Sections })
    const drawn = props.sections({ id: 'abc', name: 'Ada' })
    expect(drawn.type).toBe(Sections)
    expect(drawn.props.profile).toEqual({ id: 'abc', name: 'Ada' })
    expect((await renderEditProfile('abc')).sections).toBeUndefined()
  })
})
