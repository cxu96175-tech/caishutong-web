const clean = (value,max=120) => String(value || '').replace(/[^\w\u4e00-\u9fa5.@\-:/ ]/g,'').slice(0,max)

const requestValue = (request,name,fallback='') => clean(request.headers.get(name) || fallback,96)

export async function recordAdminActivity({ request,env,adminEmail,event,page='',target='' }) {
  if (!env.DB || !adminEmail) return
  const userAgent = request.headers.get('User-Agent') || ''
  const device = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop'
  const deviceId = requestValue(request,'X-Admin-Device','unknown')
  const sessionId = requestValue(request,'X-Admin-Session','')
  await env.DB.prepare(`INSERT INTO admin_activity
    (admin_email,device_id,session_id,event_name,page_name,target_name,device_type)
    VALUES (?,?,?,?,?,?,?)`)
    .bind(clean(adminEmail,120),deviceId,sessionId,clean(event,60),clean(page,80),clean(target,120),device)
    .run()
}
