import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)

  const links = [
    { label: t('nav.home'), href: '#inicio' },
    { label: t('nav.products'), href: '#productos' },
    { label: t('nav.orders'), href: '#encargos' },
    { label: t('nav.reviews'), href: '#resenas' },
    { label: t('nav.contact'), href: '#contacto' },
  ]

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
    localStorage.setItem('anis-lang', next)
  }

  return (
    <nav className="bg-cream-light/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm border-b border-beige">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="#inicio" className="flex items-center gap-2">
          <img src="/ana-logo.jpeg" alt="Ani's Bakery" className="h-12 w-12 rounded-full object-cover" />
          <span className="text-brown-dark font-bold text-xl hidden sm:block" style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}>
            Ani's Bakery
          </span>
        </a>

        <ul className="hidden md:flex gap-6 items-center">
          {links.map(l => (
            <li key={l.href}>
              <a href={l.href} className="text-brown-mid hover:text-wine transition-colors font-medium">
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 text-sm font-semibold text-brown-mid hover:text-brown-dark transition-colors border border-beige rounded-full px-3 py-1.5"
              title={i18n.language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <span className="text-base">{i18n.language === 'es' ? '🇺🇸' : '🇪🇸'}</span>
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </button>
          </li>
          <li>
            <a href="#encargos" className="btn-primary text-sm py-2 px-5">
              {t('nav.cta')}
            </a>
          </li>
        </ul>

        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 text-sm font-semibold text-brown-mid border border-beige rounded-full px-2.5 py-1"
          >
            <span className="text-base">{i18n.language === 'es' ? '🇺🇸' : '🇪🇸'}</span>
            {i18n.language === 'es' ? 'EN' : 'ES'}
          </button>
          <button className="text-brown-dark" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-cream-light border-t border-beige px-4 py-4">
          <ul className="flex flex-col gap-4">
            {links.map(l => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-brown-mid hover:text-wine transition-colors font-medium block"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#encargos" className="btn-primary text-sm py-2 px-5" onClick={() => setOpen(false)}>
                {t('nav.cta')}
              </a>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}
