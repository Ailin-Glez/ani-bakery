import { useTranslation } from 'react-i18next'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
  tone?: 'default' | 'danger'
}

export default function ConfirmDialog({ message, onConfirm, onCancel, tone = 'default' }: Props) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-brown-dark/60 flex items-center justify-center z-[60] px-4" onClick={onCancel}>
      <div className="bg-cream-light rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <p className="text-brown-dark font-medium mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 text-center text-sm py-3 rounded-xl font-semibold transition-colors ${
              tone === 'danger' ? 'bg-burgundy text-cream-light hover:bg-burgundy-dark' : 'btn-primary'
            }`}
          >
            {t('admin.confirmYes')}
          </button>
          <button
            onClick={onCancel}
            className={`flex-1 text-center text-sm py-3 rounded-xl font-semibold transition-colors ${
              tone === 'danger'
                ? 'bg-rose-light text-burgundy hover:bg-rose'
                : 'btn-secondary btn-burgundy'
            }`}
          >
            {t('admin.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
