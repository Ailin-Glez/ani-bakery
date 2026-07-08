import { describe, it, expect } from 'vitest'
import {
  getMinOrderDate,
  isOrderDateValid,
  buildOrderMessage,
  buildWhatsAppOrderLink,
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
    phone: '+1 803 555 0123',
    product: 'Pan Artesanal',
    quantity: 2,
    date: '2099-01-01',
    notes: '',
  }

  it('builds a Spanish message with the order details', () => {
    const message = buildOrderMessage(form, false)
    expect(message).toContain('Ana García')
    expect(message).toContain('Pan Artesanal')
    expect(message).toContain('2')
    expect(message).toContain('encargo')
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

describe('buildWhatsAppOrderLink', () => {
  it('url-encodes the message into a wa.me link', () => {
    const link = buildWhatsAppOrderLink('Hola & gracias')
    expect(link).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
    expect(link).toContain(encodeURIComponent('Hola & gracias'))
  })
})
