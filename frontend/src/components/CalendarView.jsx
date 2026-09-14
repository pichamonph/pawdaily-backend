import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../api'

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function currentYYYYMM() {
  return new Date().toLocaleDateString('sv').slice(0, 7)
}

function todayStr() {
  return new Date().toLocaleDateString('sv')
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(currentYYYYMM)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [calData, setCalData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ok = true
    setLoading(true)
    api(`/api/calendar?month=${currentMonth}`)
      .then(d => { if (ok) { setCalData(d); setLoading(false) } })
      .catch(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [currentMonth])

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCurrentMonth(d.toLocaleDateString('sv').slice(0, 7))
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCurrentMonth(d.toLocaleDateString('sv').slice(0, 7))
  }

  // Build calendar grid
  const [year, month] = currentMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todStr = todayStr()

  const monthLabel = `${THAI_MONTHS[month - 1]} ${year + 543}`

  const selectedEvents = selectedDate ? (calData[selectedDate] || []) : []

  return (
    <div>
      {/* Month navigation */}
      <div className="cal-nav">
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--rhino)' }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--rhino)' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day headers */}
      <div className="cal-grid">
        {DAY_HEADERS.map(h => (
          <div key={h} className="cal-day-header">{h}</div>
        ))}
      </div>

      {/* Day cells */}
      {loading
        ? <div className="sub" style={{ textAlign: 'center', padding: '20px 0' }}>กำลังโหลด...</div>
        : (
          <div className="cal-grid">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />
              const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`
              const events = calData[dateStr] || []
              const hasRoutine = events.some(e => e.type === 'routine')
              const hasMedical = events.some(e => e.type === 'medical_event')
              const isToday = dateStr === todStr
              const isSelected = dateStr === selectedDate

              let cls = 'cal-day'
              if (isToday) cls += ' today'
              if (isSelected) cls += ' selected'

              return (
                <div key={dateStr} className={cls} onClick={() => setSelectedDate(dateStr)}>
                  <span className="cal-day-num">{day}</span>
                  <div className="cal-dots">
                    {hasRoutine && <span className="cal-dot" style={{ background: '#4A5D80' }} />}
                    {hasMedical && <span className="cal-dot" style={{ background: '#E3982E' }} />}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* Selected date events */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="cal-events">
          {selectedEvents.map((ev, i) => (
            <div key={i} className="cal-event-row">
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: ev.type === 'routine' ? '#4A5D80' : '#E3982E',
              }} />
              <span style={{ color: 'var(--rhino-dim)', fontSize: 12 }}>{ev.pet_name}</span>
              <span>{ev.title}</span>
            </div>
          ))}
        </div>
      )}
      {selectedDate && selectedEvents.length === 0 && !loading && (
        <div className="empty" style={{ marginTop: 12 }}>ไม่มีกำหนดการในวันนี้</div>
      )}
    </div>
  )
}
