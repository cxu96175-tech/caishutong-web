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

export const json = (body,status=200) => new Response(JSON.stringify(body),{ status,headers:{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' } })
