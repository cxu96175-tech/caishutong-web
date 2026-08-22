const clean = (value, max = 48) => String(value || '').replace(/[^\w\u4e00-\u9fa5.-]/g, '').slice(0,max)

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return Response.json({ error:'统计服务未配置' }, { status:503 })
  let payload
  try { payload = await request.json() } catch { return Response.json({ error:'请求格式错误' }, { status:400 }) }
  const visitorId = clean(payload.visitorId,64)
  const sessionId = clean(payload.sessionId,64)
  const eventName = clean(payload.event,40)
  if (!visitorId || !sessionId || !eventName) return Response.json({ error:'缺少统计字段' }, { status:400 })
  const userAgent = request.headers.get('User-Agent') || ''
  const device = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop'
  const query = env.DB.prepare('INSERT INTO analytics_events (visitor_id, session_id, event_name, page_name, game_name, device_type) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(visitorId,sessionId,eventName,clean(payload.page),clean(payload.game),device)
  waitUntil(query.run())
  return new Response(null,{ status:204, headers:{ 'Cache-Control':'no-store' } })
}

export function onRequestOptions() {
  return new Response(null,{ status:204, headers:{ Allow:'POST, OPTIONS' } })
}
