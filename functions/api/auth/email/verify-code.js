import { json,normalizeEmail,safeEqual,validEmail,verificationHash } from '../../../_lib/emailAuth.js'

export async function onRequestPost({ request,env }) {
  if (!env.DB || !env.SESSION_SECRET) return json({ error:'验证服务尚未配置' },503)
  let body
  try { body = await request.json() } catch { return json({ error:'请求格式不正确' },400) }
  const email = normalizeEmail(body?.email), code = String(body?.code || '').trim()
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return json({ error:'邮箱或验证码格式不正确' },400)
  const record = await env.DB.prepare('SELECT id,code_hash,expires_at,attempts FROM email_verification_codes WHERE email=? AND used=0 ORDER BY id DESC LIMIT 1').bind(email).first()
  if (!record) return json({ error:'请先获取验证码' },400)
  if (Number(record.expires_at) < Date.now()) return json({ error:'验证码已过期，请重新获取' },400)
  if (Number(record.attempts) >= 5) return json({ error:'验证码错误次数过多，请重新获取' },429)
  const actual = await verificationHash(email,code,env.SESSION_SECRET)
  if (!safeEqual(actual,String(record.code_hash))) {
    await env.DB.prepare('UPDATE email_verification_codes SET attempts=attempts+1 WHERE id=?').bind(record.id).run()
    return json({ error:'验证码不正确' },401)
  }
  await env.DB.prepare('UPDATE email_verification_codes SET used=1 WHERE id=?').bind(record.id).run()
  const canExport = email === '1226779246@qq.com'
  return json({ ok:true,member:{ email,nickname:'彩友',isAdmin:canExport,canExport } })
}
