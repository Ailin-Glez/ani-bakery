import { useTranslation } from 'react-i18next'
import { Phone, Clock, MapPin } from 'lucide-react'
import { business } from '../config/business'

const OLIVE = '#6B7A50'
const OLIVE_DARK = '#4E5C3A'
const CREAM = '#FFFCFA'
const CARD_BG = 'rgba(107, 122, 80, 0.35)'
const CARD_HOVER = 'rgba(107, 122, 80, 0.55)'
const SIDE_BG = 'rgba(107, 122, 80, 0.25)'

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function ContactCard({ href, children }: { href?: string; children: React.ReactNode }) {
  const base = "flex items-center gap-4 rounded-2xl p-5 transition-colors duration-200"
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={base}
        style={{ backgroundColor: CARD_BG }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = CARD_HOVER)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = CARD_BG)}
      >
        {children}
      </a>
    )
  }
  return <div className={base} style={{ backgroundColor: CARD_BG }}>{children}</div>
}

export default function Contact() {
  const { t } = useTranslation()

  return (
    <section id="contacto" className="py-20 px-4" style={{ backgroundColor: OLIVE }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={{ color: CREAM }}>{t('contact.title')}</h2>
        <p className="text-center mb-12 text-lg" style={{ color: 'rgba(255,252,250,0.75)' }}>{t('contact.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-6">
            <ContactCard href={business.phone.whatsappLink}>
              <div className="rounded-full p-3 flex-shrink-0" style={{ backgroundColor: CREAM }}>
                <Phone size={24} style={{ color: OLIVE_DARK }} />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: CREAM }}>{t('contact.whatsapp')}</p>
                <p style={{ color: 'rgba(255,252,250,0.85)' }}>{business.phone.display}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,252,250,0.65)' }}>{t('contact.whatsappSub')}</p>
              </div>
            </ContactCard>

            <ContactCard href={business.instagram.url}>
              <div className="rounded-full p-3 flex-shrink-0" style={{ backgroundColor: CREAM, color: OLIVE_DARK }}>
                <InstagramIcon />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: CREAM }}>{t('contact.instagram')}</p>
                <p style={{ color: 'rgba(255,252,250,0.85)' }}>{business.instagram.handle}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,252,250,0.65)' }}>{t('contact.instagramSub')}</p>
              </div>
            </ContactCard>

            <ContactCard>
              <div className="rounded-full p-3 flex-shrink-0" style={{ backgroundColor: CREAM }}>
                <Clock size={24} style={{ color: OLIVE_DARK }} />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: CREAM }}>{t('contact.hours')}</p>
                <p style={{ color: 'rgba(255,252,250,0.85)' }}>{t('contact.hoursValue')}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,252,250,0.65)' }}>{t('contact.hoursSub')}</p>
              </div>
            </ContactCard>

            <ContactCard>
              <div className="rounded-full p-3 flex-shrink-0" style={{ backgroundColor: CREAM }}>
                <MapPin size={24} style={{ color: OLIVE_DARK }} />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: CREAM }}>{t('contact.delivery')}</p>
                <p style={{ color: 'rgba(255,252,250,0.85)' }}>{t('contact.deliveryValue')}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,252,250,0.65)' }}>{t('contact.deliverySub')}</p>
              </div>
            </ContactCard>
          </div>

          <div className="rounded-3xl p-8" style={{ backgroundColor: SIDE_BG }}>
            <div>
              <img
                src={business.bakerPhoto}
                alt={business.bakerName}
                onError={e => { (e.currentTarget as HTMLImageElement).src = business.logo }}
                className="w-32 h-32 rounded-full object-cover mx-auto mb-6 border-4"
                style={{ borderColor: 'rgba(255,252,250,0.4)' }}
              />
              <h3 className="text-2xl font-bold text-center mb-1" style={{ color: CREAM }}>
                {business.bakerName}
              </h3>
              <p className="text-center text-sm mb-3" style={{ color: 'rgba(255,252,250,0.65)' }}>
                {business.name}
              </p>
              <div className="flex flex-col gap-3">
                {t('contact.bio').split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-center leading-relaxed" style={{ color: 'rgba(255,252,250,0.85)' }}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
