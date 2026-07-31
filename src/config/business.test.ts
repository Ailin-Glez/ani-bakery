import { describe, it, expect, vi } from 'vitest'
import {
  getMinOrderDate,
  getMaxOrderDate,
  getOrderLeadDays,
  isOrderDateValid,
  buildOrderMessage,
  buildWhatsAppOrderLink,
  openWhatsAppLink,
  isValidUSPhone,
  isValidEmail,
  isValidCustomerName,
  sanitizeNameInput,
  formatUSPhoneInput,
  getBlockedRange,
  getDeliveryFee,
  getTax,
  DELIVERY_FEE,
  ORDER_MIN_LEAD_DAYS,
  ORDER_MIN_LEAD_DAYS_WITH_COOKIES,
  LATE_ORDER_CUTOFF_HOUR,
} from './business'

// Wednesday 2026-07-29, well before and at/after the 8pm cutoff — expressed as fixed
// UTC instants for that exact wall-clock time in the bakery's timezone (America/New_York,
// UTC-4 during EDT), so the tests give the same result no matter what timezone the
// machine running them is in. This mirrors the real bug this file guards against: a
// customer's browser and the Netlify Function that re-validates the order run in
// different local timezones, so the lead-time math must not depend on either one.
const BEFORE_CUTOFF = new Date(Date.UTC(2026, 6, 29, 14, 0, 0)) // 10:00 EDT
const AT_CUTOFF = new Date(Date.UTC(2026, 6, 30, 0, 0, 0)) // 20:00 EDT
const AFTER_CUTOFF = new Date(Date.UTC(2026, 6, 30, 3, 30, 0)) // 23:30 EDT

describe('getOrderLeadDays', () => {
  it('returns the standard lead time before the cutoff hour', () => {
    expect(getOrderLeadDays(false, BEFORE_CUTOFF)).toBe(ORDER_MIN_LEAD_DAYS)
  })

  it('returns one extra day at/after the cutoff hour', () => {
    expect(getOrderLeadDays(false, AT_CUTOFF)).toBe(ORDER_MIN_LEAD_DAYS + 1)
    expect(getOrderLeadDays(false, AFTER_CUTOFF)).toBe(ORDER_MIN_LEAD_DAYS + 1)
  })

  it('returns the extended lead time when the order includes cookies', () => {
    expect(getOrderLeadDays(true, BEFORE_CUTOFF)).toBe(ORDER_MIN_LEAD_DAYS_WITH_COOKIES)
  })

  it('adds one extra day to the cookie lead time at/after the cutoff hour', () => {
    expect(getOrderLeadDays(true, AT_CUTOFF)).toBe(ORDER_MIN_LEAD_DAYS_WITH_COOKIES + 1)
    expect(getOrderLeadDays(true, AFTER_CUTOFF)).toBe(ORDER_MIN_LEAD_DAYS_WITH_COOKIES + 1)
  })
})

describe('getMinOrderDate', () => {
  it('defaults to the current time when no date is passed, computed in the business timezone', () => {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(now)
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
    const leadDays = ORDER_MIN_LEAD_DAYS + (get('hour') >= LATE_ORDER_CUTOFF_HOUR ? 1 : 0)
    const expected = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
    expected.setUTCDate(expected.getUTCDate() + leadDays)
    const yyyy = expected.getUTCFullYear()
    const mm = String(expected.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(expected.getUTCDate()).padStart(2, '0')
    expect(getMinOrderDate(false)).toBe(`${yyyy}-${mm}-${dd}`)
  })

  it('adds the standard lead time for orders placed before the cutoff hour', () => {
    expect(getMinOrderDate(false, BEFORE_CUTOFF)).toBe('2026-07-31')
  })

  it('adds one extra day for orders placed exactly at the cutoff hour', () => {
    expect(getMinOrderDate(false, AT_CUTOFF)).toBe('2026-08-01')
  })

  it('adds one extra day for orders placed after the cutoff hour', () => {
    expect(getMinOrderDate(false, AFTER_CUTOFF)).toBe('2026-08-01')
  })

  it('adds the extended lead time when the order includes cookies', () => {
    expect(getMinOrderDate(true, BEFORE_CUTOFF)).toBe('2026-08-01')
  })
})

describe('isOrderDateValid', () => {
  it('rejects an empty date', () => {
    expect(isOrderDateValid('', false)).toBe(false)
  })

  it('rejects a date before the minimum lead time', () => {
    expect(isOrderDateValid('2026-07-29', false, BEFORE_CUTOFF)).toBe(false)
  })

  it('accepts a date exactly at the minimum lead time before the cutoff hour', () => {
    expect(isOrderDateValid('2026-07-31', false, BEFORE_CUTOFF)).toBe(true)
  })

  it('rejects the standard lead-time date when placed after the cutoff hour', () => {
    expect(isOrderDateValid('2026-07-31', false, AFTER_CUTOFF)).toBe(false)
  })

  it('accepts the extended lead-time date when placed after the cutoff hour', () => {
    expect(isOrderDateValid('2026-08-01', false, AFTER_CUTOFF)).toBe(true)
  })

  it('rejects the bread-only lead-time date when the order includes cookies', () => {
    expect(isOrderDateValid('2026-07-31', true, BEFORE_CUTOFF)).toBe(false)
  })

  it('accepts the cookie lead-time date when the order includes cookies', () => {
    expect(isOrderDateValid('2026-08-01', true, BEFORE_CUTOFF)).toBe(true)
  })

  it('accepts a date within the 1-month advance window', () => {
    expect(isOrderDateValid('2026-08-20', false, BEFORE_CUTOFF)).toBe(true)
  })

  it('rejects a date more than 1 month in advance', () => {
    expect(isOrderDateValid('2099-01-01', false, BEFORE_CUTOFF)).toBe(false)
  })

  it('accepts a date exactly at the maximum lead time', () => {
    expect(isOrderDateValid(getMaxOrderDate(BEFORE_CUTOFF), false, BEFORE_CUTOFF)).toBe(true)
  })

  it('rejects a date one day past the maximum lead time', () => {
    const dayAfterMax = new Date(2026, 7, 29)
    const yyyy = dayAfterMax.getFullYear()
    const mm = String(dayAfterMax.getMonth() + 1).padStart(2, '0')
    const dd = String(dayAfterMax.getDate()).padStart(2, '0')
    expect(isOrderDateValid(`${yyyy}-${mm}-${dd}`, false, BEFORE_CUTOFF)).toBe(false)
  })
})

describe('isValidCustomerName', () => {
  it('accepts names with letters, accents, spaces, hyphens and apostrophes', () => {
    expect(isValidCustomerName('María García')).toBe(true)
    expect(isValidCustomerName("Anne-Marie O'Connor")).toBe(true)
  })

  it('rejects empty or whitespace-only names', () => {
    expect(isValidCustomerName('')).toBe(false)
    expect(isValidCustomerName('   ')).toBe(false)
  })

  it('rejects names containing digits or symbols', () => {
    expect(isValidCustomerName('Ana123')).toBe(false)
    expect(isValidCustomerName('Ana@Garcia')).toBe(false)
  })
})

describe('sanitizeNameInput', () => {
  it('strips digits and symbols while typing', () => {
    expect(sanitizeNameInput('Ana123 García!')).toBe('Ana García')
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

describe('openWhatsAppLink', () => {
  const link = 'https://wa.me/18035550123?text=hola'

  it('does not navigate away when the popup opens successfully', () => {
    const opener = vi.fn().mockReturnValue({ closed: false } as Window)
    const navigate = vi.fn()
    openWhatsAppLink(link, opener, navigate)
    expect(opener).toHaveBeenCalledWith(link)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to same-tab navigation when the popup is silently blocked (returns null)', () => {
    const opener = vi.fn().mockReturnValue(null)
    const navigate = vi.fn()
    openWhatsAppLink(link, opener, navigate)
    expect(navigate).toHaveBeenCalledWith(link)
  })

  it('falls back to same-tab navigation when the popup is opened but immediately closed', () => {
    const opener = vi.fn().mockReturnValue({ closed: true } as Window)
    const navigate = vi.fn()
    openWhatsAppLink(link, opener, navigate)
    expect(navigate).toHaveBeenCalledWith(link)
  })
})

describe('getDeliveryFee', () => {
  it('charges the delivery fee for delivery orders', () => {
    expect(getDeliveryFee('delivery')).toBe(DELIVERY_FEE)
  })

  it('charges nothing for pickup orders', () => {
    expect(getDeliveryFee('pickup')).toBe(0)
  })
})

describe('getTax', () => {
  it('charges nothing on a zero or negative subtotal', () => {
    expect(getTax(0)).toBe(0)
    expect(getTax(-10)).toBe(0)
  })

  it('charges a flat 6% of the subtotal', () => {
    expect(getTax(100)).toBe(6)
    expect(getTax(50)).toBe(3)
  })
})
