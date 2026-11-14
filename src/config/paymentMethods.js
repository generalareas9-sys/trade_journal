
/**
 * TradeJournal Payment Methods Configuration
 * Manual payments: Telebirr and CBE Bank Transfer.
 * All payments require admin verification before activation.
 */

export const MANUAL_PAYMENT_CONFIG = {
  telebirr: {
    methodName: 'Telebirr',
    currency: 'ETB',
    receiverName: 'Osman Seid Ebrahim',
    phoneNumber: '+251986446282',
    instructions: [
      'Open your Telebirr app or dial *127#.',
      'Select "Send Money" or "Pay".',
      'Send the exact subscription amount in ETB to Phone: +251986446282.',
      'Verify the recipient name shows Osman Seid Ebrahim.',
      'Copy the Transaction Number / Reference ID from the Telebirr confirmation SMS.',
      'Take a screenshot of the payment receipt or SMS, then enter the reference and upload the proof below.',
    ],
  },

  cbeBank: {
    methodName: 'CBE Bank Transfer',
    currency: 'ETB',
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    accountName: 'Usman Seid Ebrahim',
    accountNumber: '1000590932969',
    instructions: [
      'Open CBE Mobile Banking, CBE Plus, or Internet Banking, or visit a CBE branch.',
      'Transfer the exact subscription amount in ETB to Account: 1000590932969.',
      'Confirm the account holder name is Usman Seid Ebrahim.',
      'Copy the CBE Transaction Reference / FT Number.',
      'Take a clear screenshot or photo of your transfer slip/receipt and upload it below.',
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
