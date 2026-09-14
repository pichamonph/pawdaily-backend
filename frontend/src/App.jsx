/* global liff */
import { useState, useEffect } from 'react'
import { Sun, PawPrint, Settings } from 'lucide-react'
import { setTokenGetter, api } from './api'
import TodayTab from './components/TodayTab'
import CatsTab from './components/CatsTab'
import SettingsTab from './components/SettingsTab'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

const TABS = [
  { id: 'today',    Icon: Sun,      label: 'วันนี้' },
  { id: 'cats',     Icon: PawPrint, label: 'แมวของฉัน' },
  { id: 'settings', Icon: Settings, label: 'ตั้งค่า' },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!LIFF_ID) {
      setError('VITE_LIFF_ID ยังไม่ได้ตั้งค่า — ใส่ใน Environment Variables ของ Render แล้ว deploy ใหม่')
      return
    }
    liff
      .init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) { liff.login(); return }
        setTokenGetter(() => liff.getIDToken())
        try {
          const cats = await api('/api/cats')
          setTab(cats.length === 0 ? 'cats' : 'today')
        } catch {
          // fallback to default tab if check fails
        }
        setReady(true)
      })
      .catch((err) => setError(`LIFF init ล้มเหลว: ${err.message}`))
  }, [])

  const header = (
    <header className="app-header">
      <PawPrint size={20} strokeWidth={2} />
      PawDaily
    </header>
  )

  if (error) return (
    <>
      {header}
      <div className="wrap"><div className="error-msg">{error}</div></div>
    </>
  )

  if (!ready) return (
    <>
      {header}
      <div className="wrap"><div className="sub">กำลังโหลด...</div></div>
    </>
  )

  return (
    <>
      {header}
      <div className="wrap">
        {tab === 'today'    && <TodayTab />}
        {tab === 'cats'     && <CatsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
      <div className="tabbar">
        {TABS.map(({ id, Icon, label }) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={22} strokeWidth={tab === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </div>
    </>
  )
}
