import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { useReviews } from '../context/ReviewContext'

function StarRating({ rating, interactive = false, onChange }: {
  rating: number
  interactive?: boolean
  onChange?: (r: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const display = interactive ? (hovered || rating) : rating

  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const val = i + 1
        return (
          <button
            key={i}
            type={interactive ? 'button' : undefined}
            onClick={interactive && onChange ? () => onChange(val) : undefined}
            onMouseEnter={interactive ? () => setHovered(val) : undefined}
            onMouseLeave={interactive ? () => setHovered(0) : undefined}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
          >
            <Star
              size={interactive ? 28 : 16}
              className={val <= display ? 'text-wine fill-wine' : 'text-rose'}
            />
          </button>
        )
      })}
    </div>
  )
}

export default function Reviews() {
  const { t } = useTranslation()
  const { approvedReviews, submitReview } = useReviews()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const ratingLabels: string[] = t('reviews.ratingLabels', { returnObjects: true }) as string[]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return
    submitReview({ name, comment, rating })
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setShowForm(false)
      setName('')
      setRating(0)
      setComment('')
    }, 3500)
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-3 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors'

  return (
    <section id="resenas" className="py-20 px-4 bg-cream">
      <div className="max-w-6xl mx-auto">
        <h2 className="section-title">{t('reviews.title')}</h2>
        <p className="section-subtitle">{t('reviews.subtitle')}</p>

        {approvedReviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {approvedReviews.map(review => (
              <div key={review.id} className="bg-cream-light rounded-2xl p-6 shadow-md flex flex-col gap-4 border border-rose">
                <StarRating rating={review.rating} />
                <p className="text-brown-mid leading-relaxed italic flex-1">"{review.comment}"</p>
                <div className="flex items-center justify-between pt-3 border-t border-rose">
                  <span className="font-bold text-brown-dark">{review.name}</span>
                  <span className="text-sm text-brown-mid">{review.date}</span>
                </div>
              </div>
            ))}
          </div>
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
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-brown-mid hover:text-brown-dark">
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
                  {rating > 0 && (
                    <span className="text-sm text-brown-mid">{ratingLabels[rating]}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-1">{t('reviews.formComment')} *</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} required placeholder={t('reviews.formCommentPlaceholder')} rows={4} className={`${inputClass} resize-none`} />
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
