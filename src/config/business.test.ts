import { describe, it, expect } from 'vitest'
import {
  getMinOrderDate,
  isOrderDateValid,
  buildOrderMessage,
  buildWhatsAppOrderLink,
  isValidUSPhone,
  isValidEmail,
  formatUSPhoneInput,
  getBlockedRange,
  ORDER_MIN_LEAD_DAYS,
} from './business'

describe('getMinOrderDate', () => {
  it('returns today + ORDER_MIN_LEAD_DAYS in YYYY-MM-DD format', () => {
    const expected = new Date()
    expected.setDate(expected.getDate() + ORDER_MIN_LEAD_DAYS)
    const yyyy = expected.getFullYear()
    const mm = String(expected.getMonth() + 1).padStart(2, '0')
    const dd = String(expected.getDate()).padStart(2, '0')
    expect(getMinOrderDate()).toBe(`${yyyy}-${mm}-${dd}`)
  })
})

describe('isOrderDateValid', () => {
  it('rejects an empty date', () => {
    expect(isOrderDateValid('')).toBe(false)
  })

  it('rejects a date before the minimum lead time', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(isOrderDateValid(today)).toBe(false)
  })

  it('accepts a date exactly at the minimum lead time', () => {
    expect(isOrderDateValid(getMinOrderDate())).toBe(true)
  })

  it('accepts a date well in the future', () => {
    expect(isOrderDateValid('2099-01-01')).toBe(true)
  })
})

describe('buildOrderMessage', () => {
  const form = {
    name: 'Ana García',
    contact: { method: 'phone' as const, value: '+1 803 555 0123' },
    items: [{ product: 'Pan Artesanal', quantity: 2 }],
    date: '2099-01-01',
    notes: '',
  }

  it('builds a Spanish message with the order details', () => {
    const message = buildOrderMessage(form, false)
    expect(message).toContain('Ana García')
    expect(message).toContain('Pan Artesanal')
    expect(message).toContain('x2')
    expect(message).toContain('encargo')
  })

  it('lists multiple items, one per line', () => {
    const message = buildOrderMessage({
      ...form,
      items: [{ product: 'Pan Artesanal', quantity: 2 }, { product: 'Galletas de Avena', quantity: 6 }],
    }, false)
    expect(message).toContain('Pan Artesanal x2')
    expect(message).toContain('Galletas de Avena x6')
  })

  it('builds an English message with the order details', () => {
    const message = buildOrderMessage(form, true)
    expect(message).toContain('Ana García')
    expect(message).toContain('order')
  })

  it('omits the notes line when notes are empty', () => {
    const message = buildOrderMessage(form, false)
    expect(message).not.toContain('Notas')
  })

  it('includes the notes line when notes are present', () => {
    const message = buildOrderMessage({ ...form, notes: 'Sin nueces' }, false)
    expect(message).toContain('Sin nueces')
  })
})

describe('isValidUSPhone', () => {
  it('accepts a 10-digit number', () => {
    expect(isValidUSPhone('8035550123')).toBe(true)
  })

  it('accepts formatted numbers with country code', () => {
    expect(isValidUSPhone('+1 (803) 555-0123')).toBe(true)
  })

  it('rejects a number with too few digits', () => {
    expect(isValidUSPhone('55501230')).toBe(false)
  })

  it('rejects a number starting with 0 or 1 after the area code strip', () => {
    expect(isValidUSPhone('0035550123')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidUSPhone('')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('ana@example.com')).toBe(true)
  })

  it('rejects an email missing the @', () => {
    expect(isValidEmail('ana.example.com')).toBe(false)
  })

  it('rejects an email missing the domain', () => {
    expect(isValidEmail('ana@')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('formatUSPhoneInput', () => {
  it('formats a partial number as the area code only', () => {
    expect(formatUSPhoneInput('803')).toBe('(803')
  })

  it('formats a number mid-exchange', () => {
    expect(formatUSPhoneInput('803555')).toBe('(803) 555')
  })

  it('formats a complete 10-digit number', () => {
    expect(formatUSPhoneInput('8035550123')).toBe('(803) 555-0123')
  })

  it('strips a leading country code digit', () => {
    expect(formatUSPhoneInput('18035550123')).toBe('(803) 555-0123')
  })

  it('ignores non-digit characters already present', () => {
    expect(formatUSPhoneInput('(803) 555-0123')).toBe('(803) 555-0123')
  })

  it('returns an empty string for empty input', () => {
    expect(formatUSPhoneInput('')).toBe('')
  })
})

describe('getBlockedRange', () => {
  const ranges = [
    { startDate: '2099-01-10', endDate: '2099-01-15', reason: 'Vacaciones' },
    { startDate: '2099-02-01', endDate: '2099-02-03', reason: 'Viaje familiar' },
  ]

  it('returns the matching range when the date falls inside it', () => {
    expect(getBlockedRange('2099-01-12', ranges)?.reason).toBe('Vacaciones')
  })

  it('matches on the boundary dates (inclusive)', () => {
    expect(getBlockedRange('2099-01-10', ranges)?.reason).toBe('Vacaciones')
    expect(getBlockedRange('2099-01-15', ranges)?.reason).toBe('Vacaciones')
  })

  it('returns undefined when the date falls outside all ranges', () => {
    expect(getBlockedRange('2099-01-16', ranges)).toBeUndefined()
  })

  it('returns undefined for an empty ranges list', () => {
    expect(getBlockedRange('2099-01-12', [])).toBeUndefined()
  })
})

describe('buildWhatsAppOrderLink', () => {
  it('url-encodes the message into a wa.me link', () => {
    const link = buildWhatsAppOrderLink('Hola & gracias')
    expect(link).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
    expect(link).toContain(encodeURIComponent('Hola & gracias'))
  })
})
