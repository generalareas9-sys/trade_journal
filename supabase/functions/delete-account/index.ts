import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' })

  const authorization = request.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization?.startsWith('Bearer ') || !url || !anonKey || !serviceRoleKey) {
    return response(401, { error: 'A valid signed-in session is required.' })
  }

  const token = authorization.slice('Bearer '.length)
  const verifier = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: authData, error: authError } = await verifier.auth.getUser(token)
  if (authError || !authData.user) return response(401, { error: 'The session is invalid or expired.' })

  const userId = authData.user.id
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  for (const table of ['trades', 'journal_entries', 'notes', 'playbooks', 'accounts', 'profiles']) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error) return response(500, { error: `Could not remove account data from ${table}.` })
  }

  const folders = [userId]
  const paths: string[] = []
  while (folders.length) {
    const folder = folders.pop()!
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from('screenshots').list(folder, { limit: 1000, offset })
      if (error) return response(500, { error: 'Could not list account screenshot files.' })
      for (const item of data || []) {
        const path = `${folder}/${item.name}`
        if (item.id === null) folders.push(path)
        else paths.push(path)
      }
      if (!data || data.length < 1000) break
    }
  }
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await admin.storage.from('screenshots').remove(paths.slice(offset, offset + 100))
    if (error) return response(500, { error: 'Could not remove account screenshot files.' })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) return response(500, { error: 'Account data was removed, but the authentication account could not be deleted.' })
  return response(200, { success: true })
})
