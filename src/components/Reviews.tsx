import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, Camera, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReviews } from '../context/ReviewContext'
import type { Review } from '../context/ReviewContext'

const DESKTOP_PAGE_SIZE = 6

function StarRating({ rating, interactive = false, onChange }: {
  rating: number
  interactive?: boolean
  onChange?: (r: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const display = interactive ? (hovered || rating) : rating

  return (
    <div className="flex gap-1" role={interactive ? undefined : 'img'} aria-label={interactive ? undefined : `Calificación: ${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const val = i + 1
        const star = (
          <Star
            size={interactive ? 28 : 16}
            className={val <= display ? 'text-wine fill-wine' : 'text-rose'}
          />
        )
        return interactive ? (
          <button
            key={i}
            type="button"
            aria-label={`Calificar con ${val} estrella${val > 1 ? 's' : ''}`}
            onClick={onChange ? () => onChange(val) : undefined}
            onMouseEnter={() => setHovered(val)}
            onMouseLeave={() => setHovered(0)}
            className="cursor-pointer"
          >
            {star}
          </button>
        ) : (
          <span key={i} aria-hidden="true">{star}</span>
        )
      })}
    </div>
  )
}

// Resize + compress image in the browser and return a base64 string
function compressImage(file: File, maxPx = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

function PhotoLightbox({ review, onClose }: { review: Review; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-brown-dark/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-cream-light rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img src={review.image} alt={review.name} className="w-full max-h-96 object-cover" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-bold text-brown-dark text-lg">{review.name}</p>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < review.rating ? 'text-wine fill-wine' : 'text-rose'} />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-brown-mid hover:text-brown-dark p-1 flex-shrink-0">
              <X size={20} />
            </button>
          </div>
          <p className="text-brown-mid italic leading-relaxed">"{review.comment}"</p>
          <p className="text-xs text-brown-light mt-3">{review.date}</p>
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ review, onZoom, seeMoreLabel }: { review: Review; onZoom: () => void; seeMoreLabel: string }) {
  return (
    <div className="bg-cream-light rounded-2xl overflow-hidden shadow-md flex flex-col border border-rose h-full">
      <div className="p-6 flex flex-col gap-3 flex-1">
        <StarRating rating={review.rating} />
        <p className="text-brown-mid leading-relaxed italic flex-1 line-clamp-4">"{review.comment}"</p>
        <div className="flex items-center justify-between pt-3 border-t border-rose mt-auto">
          <span className="font-bold text-brown-dark">{review.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-brown-mid">{review.date}</span>
            {review.image && (
              <button
                onClick={onZoom}
                className="flex items-center gap-1 text-xs text-wine hover:text-wine-dark font-semibold transition-colors"
              >
                <ZoomIn size={13} /> {seeMoreLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Reviews() {
  const { t } = useTranslation()
  const { approvedReviews, submitReview } = useReviews()

  const [lightbox, setLightbox] = useState<Review | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [imageData, setImageData] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [desktopPage, setDesktopPage] = useState(0)
  const [mobileIndex, setMobileIndex] = useState(0)
  const mobileScrollRef = useRef<HTMLDivElement>(null)

  const ratingLabels: string[] = t('reviews.ratingLabels', { returnObjects: true }) as string[]

  const totalPages = Math.ceil(approvedReviews.length / DESKTOP_PAGE_SIZE)
  const desktopPageItems = approvedReviews.slice(desktopPage * DESKTOP_PAGE_SIZE, desktopPage * DESKTOP_PAGE_SIZE + DESKTOP_PAGE_SIZE)

  const handleMobileScroll = () => {
    const el = mobileScrollRef.current
    if (!el || approvedReviews.length === 0) return
    const cardWidth = el.scrollWidth / approvedReviews.length
    setMobileIndex(Math.round(el.scrollLeft / cardWidth))
  }

  const scrollToMobileIndex = (i: number) => {
    const el = mobileScrollRef.current
    if (!el) return
    const cardWidth = el.scrollWidth / approvedReviews.length
    el.scrollTo({ left: cardWidth * i, behavior: 'smooth' })
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setImageData(compressed)
  }

  const clearImage = () => {
    setImageData('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const resetForm = () => {
    setName(''); setRating(0); setComment('')
    clearImage(); setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return
    await submitReview({ name, comment, rating, ...(imageData ? { image: imageData } : {}) })
    setSubmitted(true)
    setTimeout(() => { setSubmitted(false); resetForm() }, 3500)
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-3 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors'

  return (
    <section id="resenas" className="py-20 px-4 bg-cream">
      <div className="max-w-6xl mx-auto">
        <h2 className="section-title">{t('reviews.title')}</h2>
        <p className="section-subtitle">{t('reviews.subtitle')}</p>

        {lightbox && <PhotoLightbox review={lightbox} onClose={() => setLightbox(null)} />}

        {approvedReviews.length > 0 ? (
          <>
            {/* Mobile: swipeable carousel, one card at a time */}
            <div className="md:hidden mb-12">
              <div
                ref={mobileScrollRef}
                onScroll={handleMobileScroll}
                className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-1 scrollbar-hide"
              >
                {approvedReviews.map(review => (
                  <div key={review.id} className="snap-center shrink-0 w-[88%]">
                    <ReviewCard review={review} onZoom={() => setLightbox(review)} seeMoreLabel={t('reviews.seeMore')} />
                  </div>
                ))}
              </div>
              {approvedReviews.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {approvedReviews.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToMobileIndex(i)}
                      aria-label={`${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === mobileIndex ? 'w-5 bg-wine' : 'w-1.5 bg-rose'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Desktop: paginated grid, 2 rows of 3 */}
            <div className="hidden md:block mb-12">
              <div className="grid grid-cols-3 gap-6">
                {desktopPageItems.map(review => (
                  <ReviewCard key={review.id} review={review} onZoom={() => setLightbox(review)} seeMoreLabel={t('reviews.seeMore')} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => setDesktopPage(p => Math.max(0, p - 1))}
                    disabled={desktopPage === 0}
                    className="text-brown-mid hover:text-wine disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <div className="flex gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setDesktopPage(i)}
                        aria-label={`${i + 1}`}
                        className={`h-2 rounded-full transition-all ${i === desktopPage ? 'w-6 bg-wine' : 'w-2 bg-rose'}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setDesktopPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={desktopPage === totalPages - 1}
                    className="text-brown-mid hover:text-wine disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={22} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-brown-mid mb-12">
            <p className="text-5xl mb-3">🌟</p>
            <p>{t('reviews.empty')}</p>
          </div>
        )}

        <div className="bg-rose-light border border-rose rounded-2xl p-8">
          {!showForm ? (
            <div className="text-center">
              <p className="text-brown-dark text-lg font-medium mb-2">{t('reviews.leaveTitle')}</p>
              <p className="text-brown-mid mb-4">{t('reviews.leaveSubtitle')}</p>
              <button onClick={() => setShowForm(true)} className="btn-secondary text-sm">
                {t('reviews.leaveBtn')}
              </button>
            </div>
          ) : submitted ? (
            <div className="text-center py-6">
              <p className="text-5xl mb-3">🥰</p>
              <p className="text-brown-dark font-semibold text-lg">{t('reviews.formSuccess')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-xl mx-auto flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-brown-dark">{t('reviews.formTitle')}</h3>
                <button type="button" onClick={resetForm} className="text-sm text-brown-mid hover:text-brown-dark">
                  {t('reviews.hideForm')}
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-1">{t('reviews.formName')} *</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder={t('reviews.formNamePlaceholder')} className={inputClass} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-2">{t('reviews.formRating')} *</label>
                <div className="flex items-center gap-3">
                  <StarRating rating={rating} interactive onChange={setRating} />
                  {rating > 0 && <span className="text-sm text-brown-mid">{ratingLabels[rating]}</span>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-1">{t('reviews.formComment')} *</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} required placeholder={t('reviews.formCommentPlaceholder')} rows={4} className={`${inputClass} resize-none`} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-2">{t('reviews.formPhoto')}</label>
                {imageData ? (
                  <div className="relative inline-block">
                    <img src={imageData} alt="preview" className="h-36 w-36 object-cover rounded-2xl border border-rose" />
                    <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-wine text-white rounded-full p-0.5">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 border-2 border-dashed border-rose rounded-2xl px-5 py-4 text-brown-mid hover:border-wine hover:text-wine transition-colors text-sm"
                  >
                    <Camera size={18} />
                    {t('reviews.formPhotoBtn')}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              </div>

              <button type="submit" disabled={!rating} className="btn-primary text-center w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {t('reviews.formSubmit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
