
/**
 * TradeJournal Payment Methods Configuration
 * Manual payments: Telebirr and CBE Bank Transfer.
 * All payments require admin verification before activation.
 */

export const MANUAL_PAYMENT_CONFIG = {
  telebirr: {
    methodName: 'Telebirr',
    currency: 'ETB',
    instructions: [
      'Open the Telebirr app or dial *127#.',
      'Select "Send Money" or "Pay".',
      'Send the exact amount in ETB to the phone number above.',
      'Check that the recipient name matches the account holder name above.',
      'Copy the Transaction Number / Reference ID from the Telebirr confirmation SMS.',
      'Take a screenshot of the receipt or SMS, then enter the reference and upload the proof below.',
      'Notify us using the box below.',
    ],
  },

  cbeBank: {
    methodName: 'CBE Bank Transfer',
    currency: 'ETB',
    instructions: [
      'Open the CBE mobile banking app or visit a CBE branch.',
      'Transfer the exact amount in ETB to the account above.',
      'Check that the account holder name matches.',
      'Keep the receipt or take a screenshot.',
      'Enter the transaction reference number from the receipt and upload the screenshot below.',
      'Notify us using the box below.',
    ],
  },
}

/**
 * Only enabled payment methods are listed here.
 */
export const PAYMENT_METHODS = [
  {
    id: 'telebirr',
    name: 'Telebirr',
    description: 'Manual mobile transfer via Telebirr app or *127#.',
    type: 'manual',
    icon: 'telebirr',
    enabled: true,
    countries: ['ET'],
    currencies: ['ETB'],
    badge: 'Manual Approval',
  },
  {
    id: 'cbe_bank',
    name: 'CBE Bank Transfer',
    description: 'Direct Commercial Bank of Ethiopia (CBE) account deposit.',
    type: 'manual',
    icon: 'cbe_bank',
    enabled: true,
    countries: ['ET'],
    currencies: ['ETB'],
    badge: 'Manual Approval',
  },
]

/**
 * Filter available payment methods by country and currency.
 */
export function getAvailablePaymentMethods(country = 'ET', currency = 'ETB') {
  return PAYMENT_METHODS.filter((method) => {
    const countryMatch =
      method.countries.includes('GLOBAL') ||
      method.countries.includes((country || '').toUpperCase())

    const currencyMatch =
      !method.currencies ||
      method.currencies.includes(currency)

    return method.enabled && countryMatch && currencyMatch
  })
}
