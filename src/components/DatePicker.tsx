import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BlockedRange {
  startDate: string
  endDate: string
  reason: string
}

interface Props {
  value: string
  onChange: (date: string) => void
  minDate: string
  maxDate: string
  blockedRanges: BlockedRange[]
  isEn: boolean
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const WEEKDAYS_ES = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function DatePicker({ value, onChange, minDate, maxDate, blockedRanges, isEn }: Props) {
  const [minYear, minMonth] = minDate.split('-').map(Number)
  const initial = value || minDate
  const [initYear, initMonth] = initial.split('-').map(Number)
  const [viewYear, setViewYear] = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth - 1)

  const [maxYear, maxMonthNum] = maxDate.split('-').map(Number)
  const viewKey = viewYear * 12 + viewMonth
  const minKey = minYear * 12 + (minMonth - 1)
  const maxKey = maxYear * 12 + (maxMonthNum - 1)

  const goToPrevMonth = () => {
    if (viewKey <= minKey) return
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11 }
      return m - 1
    })
  }
  const goToNextMonth = () => {
    if (viewKey >= maxKey) return
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0 }
      return m + 1
    })
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const weekdays = isEn ? WEEKDAYS_EN : WEEKDAYS_ES
  const months = isEn ? MONTHS_EN : MONTHS_ES

  const getBlocked = (dateStr: string) => blockedRanges.find(r => dateStr >= r.startDate && dateStr <= r.endDate)

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="bg-cream-light border border-rose rounded-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goToPrevMonth}
          disabled={viewKey <= minKey}
          aria-label={isEn ? 'Previous month' : 'Mes anterior'}
          className="p-1.5 rounded-lg text-brown-mid hover:bg-rose-light disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-bold text-brown-dark">{months[viewMonth]} {viewYear}</p>
        <button
          type="button"
          onClick={goToNextMonth}
          disabled={viewKey >= maxKey}
          aria-label={isEn ? 'Next month' : 'Mes siguiente'}
          className="p-1.5 rounded-lg text-brown-mid hover:bg-rose-light disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((w, i) => (
          <span key={i} className="text-[10px] font-semibold text-brown-light text-center">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <span key={`blank-${i}`} />
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const blocked = getBlocked(dateStr)
          const outOfRange = dateStr < minDate || dateStr > maxDate
          const disabled = outOfRange || !!blocked
          const selected = dateStr === value
          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              title={blocked ? blocked.reason : undefined}
              onClick={() => onChange(dateStr)}
              className={`text-xs h-8 rounded-lg flex items-center justify-center transition-colors ${
                selected
                  ? 'bg-wine text-cream-light font-bold'
                  : disabled
                    ? 'text-brown-light/60 bg-black/5 cursor-not-allowed'
                    : 'text-brown-dark hover:bg-rose-light font-medium'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
