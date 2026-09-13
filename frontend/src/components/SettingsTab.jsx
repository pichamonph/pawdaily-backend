import { useState, useEffect } from 'react'
import { Bell, CreditCard } from 'lucide-react'
import { api } from '../api'

function fmtDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SettingsTab() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [renewMsg, setRenewMsg] = useState(false)

  useEffect(() => {
    api('/api/me')
      .then(setMe)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function toggle() {
    try {
      const updated = await api('/api/me/reminder', {
        method: 'PUT',
        body: JSON.stringify({ enabled: !me.daily_reminder_enabled }),
      })
      setMe(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>

  return (
    <>
      <h1>ตั้งค่า</h1>
      {error && <div className="error-msg">เกิดข้อผิดพลาด: {error}</div>}
      {me && (
        <>
          <div className="card">
            <div className="toggle">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} strokeWidth={1.8} color="var(--rhino-dim)" />
                แจ้งเตือนรายวันผ่าน LINE
              </span>
              <div
                className={`switch${me.daily_reminder_enabled ? ' on' : ''}`}
                onClick={toggle}
              />
            </div>
            <div className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
              ถ้าปิดไว้ ยังดูเช็คลิสต์วันนี้ได้ตามปกติในแท็บ "วันนี้"
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CreditCard size={18} strokeWidth={1.8} color="var(--rhino-dim)" />
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--rhino)' }}>สมาชิกภาพ</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--rhino-dim)', marginBottom: 12 }}>
              {me.membership_expires_at
                ? <>สมาชิกถึง: <strong style={{ color: 'var(--rhino)' }}>{fmtDate(me.membership_expires_at)}</strong></>
                : 'ทดลองใช้ฟรี'}
            </div>
            {renewMsg ? (
              <div style={{ fontSize: 13, color: 'var(--rhino-dim)', padding: '4px 0' }}>
                ระบบชำระเงินกำลังจะเปิดให้ใช้เร็ว ๆ นี้
              </div>
            ) : (
              <button className="primary" style={{ width: '100%' }} onClick={() => setRenewMsg(true)}>
                ต่ออายุสมาชิก
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
