import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import { business } from '../config/business'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('inicio')

  const links = [
    { label: t('nav.home'), href: '#inicio', id: 'inicio' },
    { label: t('nav.products'), href: '#productos', id: 'productos' },
    { label: t('nav.reviews'), href: '#resenas', id: 'resenas' },
    { label: t('nav.contact'), href: '#contacto', id: 'contacto' },
  ]

  useEffect(() => {
    const sections = links.map(l => document.getElementById(l.id)).filter(Boolean) as HTMLElement[]
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          )
          setActive(topmost.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
    localStorage.setItem('anis-lang', next)
  }

  return (
    <nav className="bg-cream-light/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm border-b border-beige">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="#inicio" className="flex items-center gap-2">
          <img src={business.logo} alt={business.name} className="h-12 w-12 rounded-full object-cover" />
          <span className="text-brown-dark font-bold text-xl hidden sm:block" style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}>
            {business.name}
          </span>
        </a>

        <ul className="hidden md:flex gap-6 items-center">
          {links.map(l => (
            <li key={l.href}>
              <a
                href={l.href}
                className={`transition-colors font-medium relative pb-0.5 ${
                  active === l.id
                    ? 'text-wine after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-wine after:rounded-full'
                    : 'text-brown-mid hover:text-wine'
                }`}
              >
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
                  className={`transition-colors font-medium block ${active === l.id ? 'text-wine' : 'text-brown-mid hover:text-wine'}`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}
