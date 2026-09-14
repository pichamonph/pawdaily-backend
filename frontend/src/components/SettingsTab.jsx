import { useState, useEffect } from 'react'
import { Bell, Clock, CreditCard } from 'lucide-react'
import { api } from '../api'

function fmtDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function membershipStatus(expiresAt) {
  if (!expiresAt) return { type: 'none' }
  const expiry = new Date(String(expiresAt).slice(0, 10) + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((expiry - today) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { type: 'expired' }
  if (daysLeft > 30) return { type: 'paid', daysLeft, expiresAt }
  return { type: 'trial', daysLeft, expiresAt }
}

// ตัวเลือกเวลา 06:00–22:00
const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 6)

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
        body: JSON.stringify({
          enabled: !me.daily_reminder_enabled,
          preferred_reminder_hour: me.preferred_reminder_hour ?? 8,
        }),
      })
      setMe(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  async function changeHour(h) {
    try {
      const updated = await api('/api/me/reminder', {
        method: 'PUT',
        body: JSON.stringify({ enabled: me.daily_reminder_enabled, preferred_reminder_hour: h }),
      })
      setMe(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>

  const currentHour = me?.preferred_reminder_hour ?? 8
  const membership = membershipStatus(me?.membership_expires_at)

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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <Clock size={16} strokeWidth={1.8} color="var(--rhino-dim)" />
              <span style={{ fontSize: 13.5, flex: 1, color: me.daily_reminder_enabled ? 'var(--rhino)' : 'var(--rhino-dim)' }}>
                เวลาที่จะแจ้งเตือน
              </span>
              <select
                value={currentHour}
                onChange={e => changeHour(parseInt(e.target.value, 10))}
                disabled={!me.daily_reminder_enabled}
                style={{ width: 'auto', marginBottom: 0, minWidth: 90 }}
              >
                {HOUR_OPTIONS.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00 น.</option>
                ))}
              </select>
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

            {membership.type === 'expired' && (
              <div style={{ fontSize: 13.5, color: '#dc2626', fontWeight: 600, marginBottom: 12 }}>
                หมดอายุแล้ว
              </div>
            )}
            {membership.type === 'trial' && (
              <div style={{ fontSize: 13.5, color: 'var(--rhino-dim)', marginBottom: 12 }}>
                ทดลองใช้ฟรี — เหลืออีก <strong style={{ color: 'var(--rhino)' }}>{membership.daysLeft} วัน</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  (ถึง {fmtDate(membership.expiresAt)})
                </div>
              </div>
            )}
            {membership.type === 'paid' && (
              <div style={{ fontSize: 13.5, color: 'var(--rhino-dim)', marginBottom: 12 }}>
                สมาชิกแบบชำระเงิน — ใช้ได้ถึง{' '}
                <strong style={{ color: 'var(--rhino)' }}>{fmtDate(membership.expiresAt)}</strong>
              </div>
            )}
            {membership.type === 'none' && (
              <div style={{ fontSize: 13.5, color: 'var(--rhino-dim)', marginBottom: 12 }}>
                ทดลองใช้ฟรี
              </div>
            )}

            {renewMsg ? (
              <div style={{ fontSize: 13, color: 'var(--rhino-dim)', padding: '4px 0' }}>
                ระบบชำระเงินกำลังจะเปิดให้ใช้เร็ว ๆ นี้ — ติดต่อแอดมินผ่านแชท LINE เพื่อต่ออายุ
              </div>
            ) : (
              <button
                className="primary"
                style={{ width: '100%', ...(membership.type === 'expired' ? { backgroundColor: '#dc2626' } : {}) }}
                onClick={() => setRenewMsg(true)}
              >
                ต่ออายุสมาชิก 39 บาท/เดือน
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
