import { useTranslation } from 'react-i18next'

export default function Hero() {
  const { t } = useTranslation()

  return (
    <section id="inicio" className="min-h-[90vh] flex items-center justify-center bg-gradient-to-b from-cream-light to-cream px-4 py-20">
      <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-8">
        <img
          src="/ana-logo.jpeg"
          alt="Ani's Bakery"
          className="w-56 h-56 md:w-72 md:h-72 rounded-full object-cover shadow-2xl border-4 border-rose"
        />

        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl md:text-7xl font-bold text-brown-dark leading-tight">
            Ani's Bakery
          </h1>
          <p className="text-wine font-medium tracking-[0.25em] text-sm uppercase italic">
            {t('hero.tagline')}
          </p>
          <p className="text-brown-mid text-lg md:text-xl max-w-xl leading-relaxed">
            {t('hero.description')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <a href="#productos" className="btn-primary text-lg py-4 px-8">
            {t('hero.btnProducts')}
          </a>
          <a href="#encargos" className="btn-secondary text-lg py-4 px-8">
            {t('hero.btnOrder')}
          </a>
        </div>

        <div className="flex gap-8 mt-6 text-center">
          <div>
            <p className="text-3xl font-bold text-wine">{t('hero.stat1Value')}</p>
            <p className="text-brown-mid text-sm">{t('hero.stat1Label')}</p>
          </div>
          <div className="w-px bg-rose" />
          <div>
            <p className="text-3xl font-bold text-wine">♥</p>
            <p className="text-brown-mid text-sm">{t('hero.stat2Label')}</p>
          </div>
          <div className="w-px bg-rose" />
          <div>
            <p className="text-3xl font-bold text-wine">{t('hero.stat3Value')}</p>
            <p className="text-brown-mid text-sm">{t('hero.stat3Label')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
