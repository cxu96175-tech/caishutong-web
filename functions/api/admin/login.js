import { adminCookie,clientKey,createAdminToken,passwordMatches } from '../../_lib/adminAuth.js'

const json = (body,status = 200,headers = {}) => Response.json(body,{ status,headers:{ 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers } })

export async function onRequestPost({ request,env }) {
  if (!env.DB || !env.SESSION_SECRET || !env.ADMIN_PASSWORD) return json({ error:'管理员登录尚未配置' },503)
  let body
  try { body = await request.json() } catch { return json({ error:'请求格式无效' },400) }
  const email = String(body?.email || '').trim().toLowerCase()
  const allowed = String(env.ADMIN_EMAIL || '').trim().toLowerCase()
  const key = await clientKey(request,env,email)
  const recent = await env.DB.prepare("SELECT COUNT(*) count FROM admin_login_attempts WHERE attempt_key=? AND created_at >= datetime('now','-15 minutes')").bind(key).first()
  if (Number(recent?.count || 0) >= 8) return json({ error:'尝试次数过多，请15分钟后再试' },429,{ 'Retry-After':'900' })
  const emailMatches = email && allowed && email === allowed
  const valid = emailMatches && await passwordMatches(body?.password,env)
  if (!valid) {
    await env.DB.prepare('INSERT INTO admin_login_attempts (attempt_key) VALUES (?)').bind(key).run()
    return json({ error:'邮箱或密码不正确' },401)
  }
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE attempt_key=?').bind(key).run()
  const token = await createAdminToken(email,env)
  return json({ ok:true,email },200,{ 'Set-Cookie':adminCookie(token) })
}
