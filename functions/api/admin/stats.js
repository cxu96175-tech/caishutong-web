import { getAdminEmail } from '../../_lib/adminAuth.js'

const json = (body,status = 200) => Response.json(body,{ status, headers:{ 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } })

export async function onRequestGet({ request, env }) {
  const email = await getAdminEmail(request,env)
  if (!email) return json({ error:'需要管理员身份验证' },401)
  if (!env.DB) return json({ error:'统计数据库未配置' },503)
  const url = new URL(request.url)
  const days = [7,30,90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30
  const since = `-${days - 1} days`
  const [totals,today,series,events,pages,games,devices] = await env.DB.batch([
    env.DB.prepare("SELECT SUM(event_name='page_view') views, COUNT(DISTINCT visitor_id) visitors, SUM(event_name!='page_view') clicks FROM analytics_events"),
    env.DB.prepare("SELECT SUM(event_name='page_view') views, COUNT(DISTINCT visitor_id) visitors, SUM(event_name!='page_view') clicks FROM analytics_events WHERE created_at >= datetime('now','start of day')"),
    env.DB.prepare("SELECT date(created_at,'localtime') day, SUM(event_name='page_view') views, COUNT(DISTINCT visitor_id) visitors, SUM(event_name!='page_view') clicks FROM analytics_events WHERE created_at >= datetime('now',?) GROUP BY day ORDER BY day").bind(since),
    env.DB.prepare("SELECT event_name name, COUNT(*) value FROM analytics_events WHERE event_name!='page_view' AND created_at >= datetime('now',?) GROUP BY event_name ORDER BY value DESC LIMIT 12").bind(since),
    env.DB.prepare("SELECT page_name name, COUNT(*) value FROM analytics_events WHERE event_name='page_view' AND page_name!='' AND created_at >= datetime('now',?) GROUP BY page_name ORDER BY value DESC").bind(since),
    env.DB.prepare("SELECT game_name name, COUNT(*) value FROM analytics_events WHERE game_name!='' AND created_at >= datetime('now',?) GROUP BY game_name ORDER BY value DESC LIMIT 10").bind(since),
    env.DB.prepare("SELECT device_type name, COUNT(DISTINCT visitor_id) value FROM analytics_events WHERE created_at >= datetime('now',?) GROUP BY device_type ORDER BY value DESC").bind(since)
  ])
  const first = result => result.results?.[0] || {}
  return json({ days, totals:first(totals), today:first(today), series:series.results || [], events:events.results || [], pages:pages.results || [], games:games.results || [], devices:devices.results || [], generatedAt:new Date().toISOString() })
}
