import { supabase } from '../lib/supabase'

const profileRequests = new Map()

export class StaleAuthSessionError extends Error {
  constructor() {
    super('The signed-in account no longer exists in Supabase Auth.')
    this.name = 'StaleAuthSessionError'
  }
}

function isMissingAuthUserError(error) {
  return error?.code === '23503'
    && error?.message?.includes('profiles_user_id_fkey')
    && error?.details?.includes('table "users"')
}

async function loadOrCreateProfile(user) {
  try {
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('Failed to load user profile:', selectError)
      return null
    }

    if (existingProfile) return existingProfile

    const metadataName = typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : ''
    const displayName = metadataName || user.email?.split('@')[0] || 'Trader'
    const { data: createdProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        display_name: displayName,
        settings: {
          appSettings: {
            themePreference: 'dark',
            themeChosen: false,
            theme: true,
            demoDataInitialized: false,
          },
        },
      })
      .select('*')
      .single()

    if (insertError) {
      if (isMissingAuthUserError(insertError)) throw new StaleAuthSessionError()
      console.error('Failed to create user profile:', insertError)
      return null
    }

    return createdProfile
  } catch (error) {
    if (error instanceof StaleAuthSessionError) throw error
    console.error('Failed to get or create user profile:', error)
    return null
  }
}

export async function getOrCreateProfile(user) {
  if (!user?.id) {
    console.error('Cannot load profile without an authenticated user.')
    return null
  }

  const existingRequest = profileRequests.get(user.id)
  if (existingRequest) return existingRequest

  const request = loadOrCreateProfile(user)
  profileRequests.set(user.id, request)

  try {
    return await request
  } finally {
    if (profileRequests.get(user.id) === request) profileRequests.delete(user.id)
  }
}
