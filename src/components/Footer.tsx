import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="bg-cream border-t border-rose py-6 px-4 text-center">
      <p className="text-brown-mid text-sm">
        © {new Date().getFullYear()} {t('footer.copy')}
      </p>
    </footer>
  )
}
