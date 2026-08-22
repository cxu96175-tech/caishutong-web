const json = (body,status = 200) => Response.json(body,{ status, headers:{ 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff' } })
const categories = new Set(['功能建议','数据问题','使用问题','其他'])
const text = (value,max) => String(value || '').trim().slice(0,max)

const requestKey = request => {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown'
  return ip.split(',')[0].trim().slice(0,64)
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error:'反馈服务未配置' },503)
  let payload
  try { payload = await request.json() } catch { return json({ error:'请求格式错误' },400) }
  const category = text(payload.category,20)
  const message = text(payload.message,500)
  const contact = text(payload.contact,120)
  if (!categories.has(category)) return json({ error:'请选择正确的反馈类型' },400)
  if (message.length < 5) return json({ error:'请至少填写5个字的反馈内容' },400)
  const key = requestKey(request)
  const recent = await env.DB.prepare("SELECT COUNT(*) count FROM user_feedback WHERE request_key=? AND created_at >= datetime('now','-15 minutes')").bind(key).first()
  if (Number(recent?.count || 0) >= 5) return json({ error:'提交过于频繁，请稍后再试' },429)
  const result = await env.DB.prepare('INSERT INTO user_feedback (category,message,contact,request_key) VALUES (?,?,?,?)').bind(category,message,contact,key).run()
  return json({ ok:true,id:result.meta?.last_row_id },201)
}

export function onRequestOptions() {
  return new Response(null,{ status:204, headers:{ Allow:'POST, OPTIONS' } })
}
