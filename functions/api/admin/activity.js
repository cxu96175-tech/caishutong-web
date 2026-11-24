import { getAdminEmail } from '../../_lib/adminAuth.js'
import { recordAdminActivity } from '../../_lib/adminActivity.js'

const json = (body,status=200) => Response.json(body,{ status,headers:{ 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff' } })

export async function onRequestGet({ request,env }) {
  const email = await getAdminEmail(request,env)
  if (!email) return json({ error:'需要管理员身份验证' },401)
  if (!env.DB) return json({ error:'管理员统计数据库未配置' },503)
  const url = new URL(request.url)
  const days = [7,30,90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30
  await recordAdminActivity({ request,env,adminEmail:email,event:'view_activity',page:'admin_activity',target:`${days}d` })
  const since = `-${days - 1} days`
  const [totals,today,series,events,recent] = await env.DB.batch([
    env.DB.prepare("SELECT SUM(event_name IN ('view_stats','view_feedback','view_activity')) views, SUM(event_name NOT IN ('view_stats','view_feedback','view_activity')) operations, COUNT(DISTINCT NULLIF(device_id,'')) devices, COUNT(DISTINCT NULLIF(session_id,'')) sessions FROM admin_activity"),
    env.DB.prepare("SELECT SUM(event_name IN ('view_stats','view_feedback','view_activity')) views, SUM(event_name NOT IN ('view_stats','view_feedback','view_activity')) operations, COUNT(DISTINCT NULLIF(device_id,'')) devices, COUNT(DISTINCT NULLIF(session_id,'')) sessions FROM admin_activity WHERE created_at >= datetime('now','start of day')"),
    env.DB.prepare("SELECT date(created_at,'localtime') day, SUM(event_name IN ('view_stats','view_feedback','view_activity')) views, SUM(event_name NOT IN ('view_stats','view_feedback','view_activity')) operations FROM admin_activity WHERE created_at >= datetime('now',?) GROUP BY day ORDER BY day").bind(since),
    env.DB.prepare("SELECT event_name name, COUNT(*) value FROM admin_activity WHERE created_at >= datetime('now',?) GROUP BY event_name ORDER BY value DESC LIMIT 20").bind(since),
    env.DB.prepare("SELECT admin_email,device_id,session_id,event_name,page_name,target_name,device_type,created_at FROM admin_activity ORDER BY created_at DESC LIMIT 100")
  ])
  const first = result => result.results?.[0] || {}
  return json({ days,totals:first(totals),today:first(today),series:series.results || [],events:events.results || [],recent:recent.results || [],generatedAt:new Date().toISOString() })
}
