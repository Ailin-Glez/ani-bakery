import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../context/ProductContext'
import ProductCard from './ProductCard'

export default function Products() {
  const { t } = useTranslation()
  const { products } = useProducts()
  const [activeCategory, setActiveCategory] = useState('all')

  const categories = Array.from(new Set(products.map(p => p.category)))
  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory)

  return (
    <section id="productos" className="py-20 px-4 bg-cream">
      <div className="max-w-6xl mx-auto">
        <h2 className="section-title">{t('products.title')}</h2>
        <p className="section-subtitle">{t('products.subtitle')}</p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-5 py-2 rounded-full font-medium transition-colors duration-200 text-sm ${
              activeCategory === 'all'
                ? 'bg-wine text-cream-light'
                : 'bg-rose-light text-brown-mid hover:bg-rose'
            }`}
          >
            {t('products.all')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full font-medium transition-colors duration-200 text-sm ${
                activeCategory === cat
                  ? 'bg-wine text-cream-light'
                  : 'bg-rose-light text-brown-mid hover:bg-rose'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-brown-mid">
            <p className="text-6xl mb-4">🍞</p>
            <p className="text-xl">{t('products.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
