import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '../i18n'
import ProductCard from './ProductCard'
import type { Product } from '../types'

const baseProduct: Product = {
  id: '1',
  name: 'Pan Artesanal',
  nameEn: 'Artisan Bread',
  description: 'Masa madre, trigo y sal marina.',
  descriptionEn: 'Sourdough, wheat and sea salt.',
  price: 8,
  image: '/bread.jpeg',
  category: 'Pan',
  categoryEn: 'Bread',
  available: true,
}

describe('ProductCard', () => {
  it('renders the Spanish name, category and price by default', () => {
    render(<ProductCard product={baseProduct} onOrderClick={vi.fn()} />)
    expect(screen.getByText('Pan Artesanal')).toBeInTheDocument()
    expect(screen.getByText('Pan')).toBeInTheDocument()
    expect(screen.getByText('$8')).toBeInTheDocument()
  })

  it('renders the English translation when the language is English', async () => {
    await i18n.changeLanguage('en')
    render(<ProductCard product={baseProduct} onOrderClick={vi.fn()} />)
    expect(screen.getByText('Artisan Bread')).toBeInTheDocument()
    expect(screen.getByText('Bread')).toBeInTheDocument()
    await i18n.changeLanguage('es')
  })

  it('falls back to the Spanish category when no English translation exists', async () => {
    await i18n.changeLanguage('en')
    render(<ProductCard product={{ ...baseProduct, categoryEn: undefined }} onOrderClick={vi.fn()} />)
    expect(screen.getByText('Pan')).toBeInTheDocument()
    await i18n.changeLanguage('es')
  })

  it('calls onOrderClick with the product name when ordering an available product', () => {
    const onOrderClick = vi.fn()
    render(<ProductCard product={baseProduct} onOrderClick={onOrderClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOrderClick).toHaveBeenCalledWith('Pan Artesanal')
  })

  it('shows an unavailable badge and no order button when the product is unavailable', () => {
    render(<ProductCard product={{ ...baseProduct, available: false }} onOrderClick={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByText(/no disponible/i).length).toBeGreaterThan(0)
  })
})
