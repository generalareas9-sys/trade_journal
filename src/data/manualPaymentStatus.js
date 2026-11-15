
import { supabase } from '../lib/supabase'

export async function checkManualPaymentStatus(requestId) {
  const { data, error } = await supabase.functions.invoke(
    'check-manual-payment',
    {
      body: requestId ? { requestId } : {},
    }
  )

  if (error) {
    throw new Error(error.message || 'Could not check payment status.')
  }

  return data
}
