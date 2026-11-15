import { supabase } from '../lib/supabase'

export async function checkManualPaymentStatus(requestId) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data?.session?.access_token
  if (!token) throw new Error('Please sign in to check payment status.')

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-manual-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestId ? { requestId } : {}),
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Could not check payment status.')
  }

  return result
}
