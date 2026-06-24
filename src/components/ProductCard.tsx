import { useTranslation } from 'react-i18next'
import type { Product } from '../types'

interface Props {
  product: Product
  onOrderClick: (productName: string) => void
}

export default function ProductCard({ product, onOrderClick }: Props) {
  const { t, i18n } = useTranslation()
  const isEn = i18n.language === 'en'
  const name = (isEn && product.nameEn) ? product.nameEn : product.name
  const description = (isEn && product.descriptionEn) ? product.descriptionEn : product.description

  return (
    <div className="bg-cream-light rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <div className="relative overflow-hidden h-56">
        <img
          src={product.image || '/bread.jpeg'}
          alt={name}
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/bread.jpeg' }}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
        />
        <span className="absolute top-3 left-3 bg-wine text-cream-light text-xs font-semibold px-3 py-1 rounded-full">
          {product.category}
        </span>
        {!product.available && (
          <div className="absolute inset-0 bg-brown-dark/50 flex items-center justify-center">
            <span className="text-cream-light font-bold text-lg">{t('products.unavailable')}</span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="text-xl font-bold text-brown-dark">{name}</h3>
          <p className="text-brown-mid text-sm mt-1 leading-relaxed">{description}</p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-rose">
          <span className="text-2xl font-bold text-wine">${product.price}</span>
          {product.available ? (
            <button
              onClick={() => onOrderClick(product.name)}
              className="btn-primary btn-burgundy text-sm py-2 px-4"
            >
              {t('products.orderBtn')}
            </button>
          ) : (
            <span className="text-brown-mid text-sm">{t('products.unavailable')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
