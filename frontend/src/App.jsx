/* global liff */
import { useState, useEffect } from 'react'
import { setTokenGetter } from './api'
import TodayTab from './components/TodayTab'
import CatsTab from './components/CatsTab'
import SettingsTab from './components/SettingsTab'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

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
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        setTokenGetter(() => liff.getIDToken())
        setReady(true)
      })
      .catch((err) => setError(`LIFF init ล้มเหลว: ${err.message}`))
  }, [])

  if (error) {
    return (
      <div className="wrap">
        <h1>PawDaily</h1>
        <div className="error-msg">{error}</div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="wrap">
        <div className="sub">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <>
      <div className="wrap">
        {tab === 'today' && <TodayTab />}
        {tab === 'cats' && <CatsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
      <div className="tabbar">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
          วันนี้
        </button>
        <button className={tab === 'cats' ? 'active' : ''} onClick={() => setTab('cats')}>
          แมวของฉัน
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          ตั้งค่า
        </button>
      </div>
    </>
  )
}
