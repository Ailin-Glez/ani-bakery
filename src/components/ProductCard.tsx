import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ZoomIn, X } from 'lucide-react'
import type { Product } from '../types'

interface Props {
  product: Product
  onOrderClick: (productName: string) => void
}

function ProductLightbox({ product, name, onClose }: {
  product: Product
  name: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-brown-dark/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative inline-block" onClick={e => e.stopPropagation()}>
        <img
          src={product.image || '/bread.webp'}
          alt={name}
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/bread.webp' }}
          className="block max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
        />
        <button onClick={onClose} aria-label={t('products.closeAlt')} className="absolute top-3 right-3 bg-brown-dark/60 hover:bg-brown-dark/80 text-cream-light rounded-full p-1.5 transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>,
    document.body
  )
}

export default function ProductCard({ product, onOrderClick }: Props) {
  const { t, i18n } = useTranslation()
  const [zoomed, setZoomed] = useState(false)
  const isEn = i18n.language === 'en'
  const name = (isEn && product.nameEn) ? product.nameEn : product.name
  const description = (isEn && product.descriptionEn) ? product.descriptionEn : product.description
  const category = (isEn && product.categoryEn) ? product.categoryEn : product.category

  return (
    <div className="group bg-cream-light rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col border border-rose/50 hover:-translate-y-1">
      {zoomed && (
        <ProductLightbox product={product} name={name} onClose={() => setZoomed(false)} />
      )}
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label={t('products.zoomAlt')}
        className="relative overflow-hidden aspect-[5/4] bg-brown-dark/5 cursor-zoom-in"
      >
        <img
          src={product.image || '/bread.webp'}
          alt=""
          aria-hidden="true"
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/bread.webp' }}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
        />
        <img
          src={product.image || '/bread.webp'}
          alt={name}
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/bread.webp' }}
          className="relative w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        {!product.available && (
          <div className="absolute inset-0 bg-brown-dark/50 flex items-center justify-center">
            <span className="text-cream-light font-bold text-base">{t('products.unavailable')}</span>
          </div>
        )}
        <span className="absolute bottom-2 right-2 bg-brown-dark/60 text-cream-light rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn size={16} />
        </span>
      </button>

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
