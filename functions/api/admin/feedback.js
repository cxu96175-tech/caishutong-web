import { getAdminEmail } from '../../_lib/adminAuth.js'

const json = (body,status = 200) => Response.json(body,{ status, headers:{ 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff' } })
const statuses = new Set(['pending','processing','resolved'])

const authorize = async (request,env) => {
  const email = await getAdminEmail(request,env)
  return email && env.DB ? email : null
}

export async function onRequestGet({ request, env }) {
  const email = await authorize(request,env)
  if (!email) return json({ error:'需要管理员身份验证' },401)
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'all'
  const query = status === 'all'
    ? env.DB.prepare('SELECT id,category,message,contact,status,admin_note,created_at,updated_at FROM user_feedback ORDER BY created_at DESC LIMIT 100')
    : statuses.has(status)
      ? env.DB.prepare('SELECT id,category,message,contact,status,admin_note,created_at,updated_at FROM user_feedback WHERE status=? ORDER BY created_at DESC LIMIT 100').bind(status)
      : null
  if (!query) return json({ error:'处理状态无效' },400)
  const rows = await query.all()
  return json({ feedback:rows.results || [] })
}

export async function onRequestPatch({ request, env }) {
  const email = await authorize(request,env)
  if (!email) return json({ error:'需要管理员身份验证' },401)
  let payload
  try { payload = await request.json() } catch { return json({ error:'请求格式错误' },400) }
  const id = Number(payload.id)
  const status = String(payload.status || '')
  const note = String(payload.adminNote || '').trim().slice(0,1000)
  if (!Number.isInteger(id) || id < 1 || !statuses.has(status)) return json({ error:'反馈参数无效' },400)
  const result = await env.DB.prepare("UPDATE user_feedback SET status=?,admin_note=?,updated_at=datetime('now') WHERE id=?").bind(status,note,id).run()
  if (!result.meta?.changes) return json({ error:'反馈不存在' },404)
  return json({ ok:true })
}
