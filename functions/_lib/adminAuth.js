const encoder = new TextEncoder()

const toBase64Url = bytes => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

const sign = async (value,secret) => {
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{ name:'HMAC',hash:'SHA-256' },false,['sign'])
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))))
}

const safeEqual = (left,right) => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

export const createAdminToken = async (email,env) => {
  const expires = Date.now() + 12 * 60 * 60 * 1000
  const payload = `${email.toLowerCase()}|${expires}`
  return `${payload}|${await sign(payload,String(env.SESSION_SECRET || ''))}`
}

export const getAdminEmail = async (request,env) => {
  const accessEmail = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase()
  const allowed = String(env.ADMIN_EMAIL || '').toLowerCase()
  if (accessEmail && allowed && safeEqual(accessEmail,allowed)) return accessEmail
  const cookie = request.headers.get('Cookie') || ''
  const token = cookie.match(/(?:^|;\s*)caishutong_admin=([^;]+)/)?.[1]
  if (!token || !allowed || !env.SESSION_SECRET) return ''
  const parts = decodeURIComponent(token).split('|')
  if (parts.length !== 3) return ''
  const [email,expires,signature] = parts
  if (email !== allowed || Number(expires) <= Date.now()) return ''
  const expected = await sign(`${email}|${expires}`,String(env.SESSION_SECRET))
  return safeEqual(signature,expected) ? email : ''
}

export const adminCookie = token => `caishutong_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
export const clearAdminCookie = 'caishutong_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'

export const passwordMatches = async (provided,env) => {
  const expected = String(env.ADMIN_PASSWORD || '')
  if (!provided || !expected) return false
  const digest = async value => toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))
  return safeEqual(await digest(String(provided)),await digest(expected))
}

export const clientKey = async (request,env,email) => {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  return sign(`${ip}|${String(email).toLowerCase()}`,String(env.SESSION_SECRET || 'rate-limit'))
}
