let getToken = () => null

export function setTokenGetter(fn) {
  getToken = fn
}

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.status === 204 ? null : res.json()
}

// สำหรับ multipart/form-data (upload รูป) — ไม่ตั้ง Content-Type เพื่อให้ browser จัดการ boundary เอง
export async function apiForm(path, formData) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}
