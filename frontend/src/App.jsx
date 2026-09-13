/* global liff */
import { useState, useEffect } from 'react'
import { setTokenGetter } from './api'
import TodayTab from './components/TodayTab'
import CatsTab from './components/CatsTab'
import SettingsTab from './components/SettingsTab'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

const TABS = [
  { id: 'today',    icon: '☀️', label: 'วันนี้' },
  { id: 'cats',     icon: '🐾', label: 'แมวของฉัน' },
  { id: 'settings', icon: '⚙️', label: 'ตั้งค่า' },
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
      .then(() => {
        if (!liff.isLoggedIn()) { liff.login(); return }
        setTokenGetter(() => liff.getIDToken())
        setReady(true)
      })
      .catch((err) => setError(`LIFF init ล้มเหลว: ${err.message}`))
  }, [])

  const header = <header className="app-header">🐾 PawDaily</header>

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
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </>
  )
}
