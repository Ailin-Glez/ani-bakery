import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../context/ProductContext'
import ProductCard from './ProductCard'

export default function Products({ onOrderClick }: { onOrderClick: (productName: string) => void }) {
  const { t, i18n } = useTranslation()
  const { products } = useProducts()
  const [activeCategory, setActiveCategory] = useState('all')
  const isEn = i18n.language === 'en'

  const categories = Array.from(new Set(products.map(p => p.category))).map(cat => ({
    value: cat,
    label: (isEn && products.find(p => p.category === cat)?.categoryEn) || cat,
  }))
  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory)

  return (
    <section id="productos" className="py-10 px-4 bg-cream">
      <div className="max-w-6xl mx-auto">
        <h2 className="section-title !mb-1">{t('products.title')}</h2>
        <p className="section-subtitle !mb-5">{t('products.subtitle')}</p>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors duration-200 ${
              activeCategory === 'all'
                ? 'bg-wine border-wine text-cream-light'
                : 'bg-transparent border-rose text-brown-mid hover:border-wine hover:text-wine'
            }`}
          >
            {t('products.all')}
          </button>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors duration-200 ${
                activeCategory === cat.value
                  ? 'bg-wine border-wine text-cream-light'
                  : 'bg-transparent border-rose text-brown-mid hover:border-wine hover:text-wine'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-brown-mid">
            <p className="text-6xl mb-4">🍞</p>
            <p className="text-xl">{t('products.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} onOrderClick={onOrderClick} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
