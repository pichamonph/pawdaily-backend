/* global liff */
import { useState, useEffect } from 'react'
import { Sun, PawPrint, Settings } from 'lucide-react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { setTokenGetter, api } from './api'
import TodayTab from './components/TodayTab'
import CatsTab from './components/CatsTab'
import SettingsTab from './components/SettingsTab'
import RoutinesPage from './pages/RoutinesPage'
import { Navigate } from 'react-router-dom'
import WeightPage from './pages/WeightPage'
import HealthPage from './pages/HealthPage'
import ExpensesPage from './pages/ExpensesPage'
import DiaryPage from './pages/DiaryPage'
import PassportPage from './pages/PassportPage'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

const TABS = [
  { id: 'today',    Icon: Sun,      label: 'หน้าแรก', path: '/' },
  { id: 'cats',     Icon: PawPrint, label: 'แมวของฉัน', path: '/cats' },
  { id: 'settings', Icon: Settings, label: 'ตั้งค่า', path: '/settings' },
]

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}

function AppContent() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [doneIds, setDoneIds] = useState(new Set())
  const navigate = useNavigate()
  const location = useLocation()

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
          if (cats.length > 0) {
            setSelectedCatId(cats[0].id)
            navigate('/')          // explicit navigate to home so hash-route is always correct
          } else {
            navigate('/cats')
          }
        } catch {
          navigate('/')            // fallback to home on API failure
        }
        setReady(true)
      })
      .catch((err) => setError(`LIFF init ล้มเหลว: ${err.message}`))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 12 }}>
        <img src="/image/cat-wink.png" alt="" style={{ width: 88, animation: 'mascot-bounce 1.4s ease-in-out infinite' }} />
        <div className="sub">กำลังโหลด...</div>
      </div>
    </>
  )

  // Hide tabbar on passport page
  const isPassportPage = /^\/cats\/\d+\/passport/.test(location.pathname)

  return (
    <>
      {header}
      <div className="wrap">
        <Routes>
          <Route path="/" element={
            <TodayTab
              selectedCatId={selectedCatId}
              onSelectCat={setSelectedCatId}
              doneIds={doneIds}
              setDoneIds={setDoneIds}
            />
          } />
          <Route path="/cats" element={
            <CatsTab
              selectedCatId={selectedCatId}
              onSelectCat={setSelectedCatId}
            />
          } />
          <Route path="/cats/:id/passport" element={<PassportPage />} />
          <Route path="/cats/:id/routines" element={<RoutinesPage />} />
          <Route path="/cats/:id/weight" element={<WeightPage />} />
          <Route path="/cats/:id/health" element={<HealthPage />} />
          <Route path="/cats/:id/expenses" element={<ExpensesPage />} />
          <Route path="/cats/:id/diary" element={<DiaryPage />} />
          <Route path="/settings" element={<SettingsTab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isPassportPage && (
        <div className="tabbar">
          {TABS.map(({ id, Icon, label, path }) => {
            const isActive = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path)
            return (
              <button
                key={id}
                className={isActive ? 'active' : ''}
                onClick={() => navigate(path)}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
