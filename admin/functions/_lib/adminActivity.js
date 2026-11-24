const clean = (value,max=120) => String(value || '').replace(/[^\w\u4e00-\u9fa5.@\-:/ ]/g,'').slice(0,max)

const requestValue = (request,name,fallback='') => clean(request.headers.get(name) || fallback,96)
const activityPrefix = 'admin-activity:v1:'
const shardFor = value => {
  let hash = 0
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Math.abs(hash) % 8
}

export async function recordAdminActivity({ request,env,adminEmail,event,page='',target='' }) {
  if (!env.ADMIN_ACTIVITY || !adminEmail) return
  const userAgent = request.headers.get('User-Agent') || ''
  const device = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop'
  const deviceId = requestValue(request,'X-Admin-Device','unknown')
  const sessionId = requestValue(request,'X-Admin-Session','')
  const createdAt = new Date().toISOString()
  const day = createdAt.slice(0,10)
  const shard = shardFor(`${deviceId}|${sessionId}|${event}|${createdAt}`)
  const key = `${activityPrefix}${day}:${shard}`
  const current = await env.ADMIN_ACTIVITY.get(key,'json') || { version:1, events:[] }
  const events = Array.isArray(current.events) ? current.events : []
  events.push({
    admin_email:clean(adminEmail,120),
    device_id:deviceId,
    session_id:sessionId,
    event_name:clean(event,60),
    page_name:clean(page,80),
    target_name:clean(target,120),
    device_type:device,
    created_at:createdAt
  })
  if (events.length > 2000) events.splice(0,events.length - 2000)
  await env.ADMIN_ACTIVITY.put(key,JSON.stringify({ version:1,events,updated_at:createdAt }))
}

export { activityPrefix }
