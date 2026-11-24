import { adminCookie,createAdminToken,passwordMatches } from '../../_lib/adminAuth.js'
import { recordAdminActivity } from '../../_lib/adminActivity.js'

const json = (body,status = 200,headers = {}) => Response.json(body,{ status,headers:{ 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers } })

export async function onRequestPost({ request,env }) {
  const fail = (stage,error,status=500) => {
    console.error('Admin login failed',stage,error)
    return json({ error:'管理员登录服务暂时不可用' },status)
  }
  try {
    // Authentication is intentionally stateless. D1 is not part of the login path,
    // so daily analytics limits cannot prevent the administrator from signing in.
    if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD || !env.ADMIN_EMAIL) return json({ error:'管理员登录尚未配置' },503)
    let body
    try { body = await request.json() } catch { return json({ error:'请求格式无效' },400) }
    const email = String(body?.email || '').trim().toLowerCase()
    const allowed = String(env.ADMIN_EMAIL || '').trim().toLowerCase()
    const emailMatches = email && allowed && email === allowed
    let valid = false
    try { valid = emailMatches && await passwordMatches(body?.password,env) } catch (error) { return fail('password-check',error) }
    if (!valid) return json({ error:'邮箱或密码不正确' },401)
    let token
    try { token = await createAdminToken(email,env) } catch (error) { return fail('token-create',error) }
    try { await recordAdminActivity({ request,env,adminEmail:email,event:'admin_login',page:'admin_login' }) } catch (error) { console.warn('Admin login activity write skipped',error) }
    return json({ ok:true,email },200,{ 'Set-Cookie':adminCookie(token) })
  } catch (error) {
    return fail('unknown',error)
  }
}
