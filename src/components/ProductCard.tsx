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
  const category = (isEn && product.categoryEn) ? product.categoryEn : product.category

  return (
    <div className="group bg-cream-light rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col border border-rose/50 hover:-translate-y-1">
      <div className="relative overflow-hidden aspect-[5/4] bg-brown-dark/5">
        <img
          src={product.image || '/bread.jpeg'}
          alt=""
          aria-hidden="true"
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/bread.jpeg' }}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
        />
        <img
          src={product.image || '/bread.jpeg'}
          alt={name}
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/bread.jpeg' }}
          className="relative w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        {!product.available && (
          <div className="absolute inset-0 bg-brown-dark/50 flex items-center justify-center">
            <span className="text-cream-light font-bold text-base">{t('products.unavailable')}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-1">
        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-wine">{category}</span>
        <h3 className="font-display text-lg text-brown-dark leading-tight line-clamp-2 min-h-[2.8rem]">{name}</h3>
        <p className="text-brown-mid text-xs leading-relaxed line-clamp-3 min-h-[3.75rem]">{description}</p>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-rose/60">
          <span className="font-display text-lg text-wine">${product.price}</span>
          {product.available ? (
            <button
              onClick={() => onOrderClick(product.name)}
              className="btn-primary btn-burgundy text-xs py-1.5 px-3"
            >
              {t('products.orderBtn')}
            </button>
          ) : (
            <span className="text-brown-mid text-xs">{t('products.unavailable')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
