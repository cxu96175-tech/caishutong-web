import { getAdminEmail } from '../../_lib/adminAuth.js'
import { activityPrefix,recordAdminActivity } from '../../_lib/adminActivity.js'

const json = (body,status=200) => Response.json(body,{ status,headers:{ 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff' } })
const viewEvents = new Set(['view_stats','view_feedback','view_activity'])

const readEvents = async kv => {
  const keys = []
  let cursor
  do {
    const page = await kv.list({ prefix:activityPrefix, limit:1000, ...(cursor ? { cursor } : {}) })
    keys.push(...page.keys.map(key => key.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  const events = []
  for (let index=0; index<keys.length; index+=100) {
    const values = await kv.get(keys.slice(index,index+100),'json')
    for (const value of values.values()) if (Array.isArray(value?.events)) events.push(...value.events)
  }
  return events.sort((left,right) => String(right.created_at).localeCompare(String(left.created_at)))
}

const dayKey = value => new Date(value).toISOString().slice(0,10)

export async function onRequestGet({ request,env }) {
  const email = await getAdminEmail(request,env)
  if (!email) return json({ error:'需要管理员身份验证' },401)
  if (!env.ADMIN_ACTIVITY) return json({ error:'管理员数据存储未配置' },503)
  const url = new URL(request.url)
  const days = [7,30,90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30
  try { await recordAdminActivity({ request,env,adminEmail:email,event:'view_activity',page:'admin_activity',target:`${days}d` }) } catch (error) { console.warn('Admin activity KV write skipped',error) }
  let events
  try { events = await readEvents(env.ADMIN_ACTIVITY) } catch (error) {
    console.error('Admin activity KV read failed',error)
    return json({ error:'管理员数据暂时无法读取，请稍后再试' },503)
  }
  const todayKey = dayKey(new Date())
  const since = Date.now() - (days - 1) * 86400000
  const inWindow = events.filter(event => Date.parse(event.created_at) >= since)
  const summarize = rows => ({
    views:rows.filter(event => viewEvents.has(event.event_name)).length,
    operations:rows.filter(event => !viewEvents.has(event.event_name)).length,
    devices:new Set(rows.map(event => event.device_id).filter(Boolean)).size,
    sessions:new Set(rows.map(event => event.session_id).filter(Boolean)).size
  })
  const series = []
  for (let offset=days - 1; offset>=0; offset-=1) {
    const date = new Date(Date.now() - offset * 86400000)
    const day = date.toISOString().slice(0,10)
    const rows = inWindow.filter(event => dayKey(event.created_at) === day)
    series.push({ day,...summarize(rows) })
  }
  const eventsByName = new Map()
  for (const event of inWindow) eventsByName.set(event.event_name,(eventsByName.get(event.event_name) || 0) + 1)
  const eventRows = [...eventsByName].map(([name,value]) => ({ name,value })).sort((left,right) => right.value - left.value).slice(0,20)
  return json({
    days,
    totals:summarize(events),
    today:summarize(events.filter(event => dayKey(event.created_at) === todayKey)),
    series,
    events:eventRows,
    recent:events.slice(0,100),
    generatedAt:new Date().toISOString()
  })
}
