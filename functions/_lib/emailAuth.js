const encoder = new TextEncoder()

const toHex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2,'0')).join('')

export const normalizeEmail = value => String(value || '').trim().toLowerCase()
export const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120

export const verificationHash = async (email,code,secret) => {
  const key = await crypto.subtle.importKey('raw',encoder.encode(String(secret)),{ name:'HMAC',hash:'SHA-256' },false,['sign'])
  return toHex(await crypto.subtle.sign('HMAC',key,encoder.encode(`${email}|${code}`)))
}

export const safeEqual = (left,right) => {
  if (!left || !right || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

export const requestKey = async (request,email,secret) => {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  return verificationHash(email,ip,secret)
}

// Keep the auth endpoint tolerant of a Pages deployment where the D1 migration
// was applied before the latest rate-limit columns were added. The normal path
// is still covered by migrations; this small compatibility check prevents an
// old table shape from crashing the Worker with Cloudflare error 1101.
export const ensureVerificationSchema = async DB => {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS email_verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    request_key TEXT NOT NULL DEFAULT '',
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run()
  const info = await DB.prepare('PRAGMA table_info(email_verification_codes)').all()
  const columns = new Set((info.results || []).map(column => column.name))
  const additions = [
    ['code_hash','TEXT NOT NULL DEFAULT \'\''],
    ['request_key','TEXT NOT NULL DEFAULT \'\''],
    ['expires_at','INTEGER NOT NULL DEFAULT 0'],
    ['attempts','INTEGER NOT NULL DEFAULT 0'],
    ['used','INTEGER NOT NULL DEFAULT 0'],
    ['created_at',"TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'"]
  ]
  for (const [name,definition] of additions) {
    if (!columns.has(name)) await DB.prepare(`ALTER TABLE email_verification_codes ADD COLUMN ${name} ${definition}`).run()
  }
  await DB.batch([
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_email_verification_email_created ON email_verification_codes(email,created_at)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_email_verification_request_created ON email_verification_codes(request_key,created_at)')
  ])
}

export const json = (body,status=200) => new Response(JSON.stringify(body),{ status,headers:{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' } })
