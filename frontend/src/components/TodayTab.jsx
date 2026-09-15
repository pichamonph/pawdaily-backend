import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Scale, Stethoscope, Wallet, BookOpen } from 'lucide-react'
import { api } from '../api'
import CatAvatarStrip from './CatAvatarStrip'

const CAT_MENU_ITEMS = [
  { id: 'routines', Icon: ListChecks,  label: 'กิจวัตร',     color: '#2E4060' },
  { id: 'weight',   Icon: Scale,       label: 'น้ำหนัก',     color: '#4A5D80' },
  { id: 'health',   Icon: Stethoscope, label: 'สุขภาพ',      color: '#DD8C96' },
  { id: 'expenses', Icon: Wallet,      label: 'ค่าใช้จ่าย',  color: '#E3982E' },
  { id: 'diary',    Icon: BookOpen,    label: 'ไดอารี่',      color: '#65a30d' },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'สวัสดีตอนเช้า'
  if (h < 17) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}

function isOverdue(item) {
  if (!item.last_done_at) return false
  const last = new Date(String(item.last_done_at).slice(0, 10) + 'T00:00:00')
  const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
  return daysSince > item.frequency_days * 2
}

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function MiniCalendar({ selectedDate, onSelectDate, calEvents }) {
  const todayStr = new Date().toLocaleDateString('sv')
  // Parse selectedDate to determine displayed month
  const [displayMonth, setDisplayMonth] = useState(() => {
    return selectedDate ? selectedDate.slice(0, 7) : todayStr.slice(0, 7)
  })

  // Update displayMonth when selectedDate changes to a different month
  useEffect(() => {
    if (selectedDate && selectedDate.slice(0, 7) !== displayMonth) {
      setDisplayMonth(selectedDate.slice(0, 7))
    }
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const [year, mon] = displayMonth.split('-').map(Number)

  function prevMonth() {
    const d = new Date(year, mon - 2, 1)
    setDisplayMonth(d.toLocaleDateString('sv').slice(0, 7))
  }
  function nextMonth() {
    const d = new Date(year, mon, 1)
    setDisplayMonth(d.toLocaleDateString('sv').slice(0, 7))
  }

  // Build calendar grid
  const firstDay = new Date(year, mon - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, mon, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  return (
    <div className="card" style={{ marginBottom: 12, padding: '12px 12px 8px' }}>
      <div className="cal-nav" style={{ marginBottom: 8 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: 'var(--rhino-dim)', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rhino)' }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: 'var(--rhino-dim)', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="cal-grid">
        {DAY_HEADERS.map(h => (
          <div key={h} className="cal-day-header" style={{ fontSize: 10 }}>{h}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />
          const dateStr = `${displayMonth}-${String(day).padStart(2, '0')}`
          const evs = calEvents[dateStr] || []
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          return (
            <div
              key={dateStr}
              className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              style={{ minHeight: 32, padding: '2px 1px', cursor: 'pointer' }}
              onClick={() => onSelectDate(dateStr)}
            >
              <span className="cal-day-num" style={{ fontSize: 12 }}>{day}</span>
              {evs.length > 0 && (
                <div className="cal-dots">
                  {evs.slice(0, 3).map((ev, i) => (
                    <div
                      key={i}
                      className="cal-dot"
                      style={{ background: ev.type === 'medical_event' ? 'var(--dull-pink)' : 'var(--rhino-dim)' }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TodayTab({ selectedCatId, onSelectCat, doneIds, setDoneIds, onNavigateToCat }) {
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('sv'))
  const [calEvents, setCalEvents] = useState({})
  const calMonth = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [todayData, catsData] = await Promise.all([
        api('/api/today'),
        api('/api/cats'),
      ])
      setItems(todayData)
      setCats(catsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Fetch calendar events for the selected month
  useEffect(() => {
    const month = selectedDate.slice(0, 7)
    if (calMonth.current === month) return
    calMonth.current = month
    api(`/api/calendar?month=${month}`)
      .then(data => setCalEvents(data))
      .catch(() => {})
  }, [selectedDate])

  async function toggleDone(id) {
    const isDone = doneIds.has(id)
    setDoneIds(prev => {
      const next = new Set(prev)
      isDone ? next.delete(id) : next.add(id)
      return next
    })
    try {
      await api(`/api/routines/${id}/complete`, { method: isDone ? 'DELETE' : 'POST' })
    } catch (err) {
      setError(err.message)
      // revert on error
      setDoneIds(prev => {
        const next = new Set(prev)
        isDone ? next.add(id) : next.delete(id)
        return next
      })
    }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>

  const filteredItems = selectedCatId
    ? items.filter(it => it.cat_id === selectedCatId)
    : items

  const selectedDateLabel = (() => {
    const today = new Date().toLocaleDateString('sv')
    if (selectedDate === today) return 'วันนี้'
    const d = new Date(selectedDate + 'T00:00:00')
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })
  })()

  return (
    <>
      {/* Greeting card first */}
      <div className="greeting-card">
        <div className="greeting-text">{greeting()}</div>
        <div className="greeting-sub">
          {filteredItems.length > 0
            ? `มี ${filteredItems.length} รายการที่ต้องดูแล`
            : 'วันนี้ดูแลครบแล้ว!'}
        </div>
      </div>

      {/* Avatar strip after greeting */}
      {cats.length > 1 && (
        <CatAvatarStrip cats={cats} selectedCatId={selectedCatId} onSelect={onSelectCat} />
      )}

      {error && <div className="error-msg">โหลดไม่ได้: {error}</div>}

      {/* Mini calendar */}
      <MiniCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        calEvents={calEvents}
      />

      {/* Section header */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rhino-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {selectedDateLabel}
      </div>

      {/* Routine list */}
      {!error && filteredItems.length === 0 && (
        <div className="empty-state">
          <CheckCircle2 size={64} strokeWidth={1.2} color="var(--dull-pink)" />
          <div className="empty-title">เยี่ยมมาก!</div>
          <div className="empty-sub">ไม่มีรายการที่ต้องทำ</div>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          {filteredItems.map(it => {
            const done = doneIds.has(it.id)
            return (
              <div
                key={it.id}
                className={`routine-row${done ? ' done-anim' : ''}`}
                style={{ padding: '10px 16px' }}
              >
                <button
                  className={`circle-check${done ? ' checked' : ''}`}
                  onClick={() => toggleDone(it.id)}
                  aria-label={done ? 'ยกเลิก' : 'ทำแล้ว'}
                >
                  {done && <CheckCircle2 size={22} strokeWidth={2} />}
                  {!done && <span className="circle-check-empty" />}
                </button>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap', flex: 1 }}>
                  {isOverdue(it) && <span className="overdue-badge">เลยกำหนด</span>}
                  <span style={{ fontSize: 14 }}>{it.title}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick access cat menu grid */}
      {selectedCatId && onNavigateToCat && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rhino-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            จัดการแมว
          </div>
          <div className="cat-menu-grid">
            {CAT_MENU_ITEMS.map(({ id, Icon, label, color }) => (
              <div key={id} className="cat-menu-item" onClick={() => onNavigateToCat(id)}>
                <Icon size={24} color={color} strokeWidth={1.8} />
                <span className="cat-menu-item-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
