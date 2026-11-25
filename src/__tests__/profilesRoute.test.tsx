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
const mockParams: { id?: string; seat?: string } = {}
const mockCreateProfile = jest.fn((patch: { name: string }) => ({ id: 'made', ...patch }))
const mockSelectProfile = jest.fn()

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => mockParams }))
jest.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [], createProfile: mockCreateProfile, updateProfile: jest.fn(), deleteProfile: jest.fn(), selectProfile: mockSelectProfile }) }))
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
  mockCreateProfile.mockClear()
  mockSelectProfile.mockClear()
  delete mockParams.seat
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

// Jay, 2026-11-16 in HexFleet: a new profile is selected in the seat that went to make it. Seat 1's Manage (Home, a loadout) and
// Settings' Profiles row for its guest open Profiles with the seat (profilesHref), New Profile carries it, and the profile made is
// picked for it. The stats screen's Manage opens Profiles for no seat.
describe('a new profile', () => {
  const patch = { name: 'Kid', color: '#2196f3', tag: 'K' }

  it('carries the seat that opened Profiles to New Profile, and to no saved profile', async () => {
    mockParams.seat = '1'
    const props = await renderProfiles()
    props.onEdit('new')
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/profile/[id]', params: { id: 'new', seat: '1' } })
    props.onEdit('abc')
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/profile/[id]', params: { id: 'abc' } })
  })

  it('carries no seat where none opened Profiles (the stats screen)', async () => {
    const props = await renderProfiles()
    props.onEdit('new')
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/profile/[id]', params: { id: 'new' } })
  })

  it('is picked for the seat that went to make it, the newest made winning', async () => {
    mockParams.seat = '1'
    const props = await renderEditProfile('new')
    props.onCreate(patch)
    expect(mockCreateProfile).toHaveBeenCalledWith(patch)
    expect(mockSelectProfile).toHaveBeenLastCalledWith(1, 'made')

    mockParams.seat = '2'
    ;(await renderEditProfile('new')).onCreate(patch)
    expect(mockSelectProfile).toHaveBeenLastCalledWith(2, 'made')
  })

  it('is picked for no seat when none opened Profiles, or one the pack has no such seat for', async () => {
    ;(await renderEditProfile('new')).onCreate(patch)
    mockParams.seat = '3'
    ;(await renderEditProfile('new')).onCreate(patch)
    expect(mockCreateProfile).toHaveBeenCalledTimes(2)
    expect(mockSelectProfile).not.toHaveBeenCalled()
  })
})
