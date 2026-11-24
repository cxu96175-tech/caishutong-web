import { clearAdminCookie,getAdminEmail } from '../../_lib/adminAuth.js'
import { recordAdminActivity } from '../../_lib/adminActivity.js'

export async function onRequestPost({ request,env }) {
  const email = await getAdminEmail(request,env)
  if (email) await recordAdminActivity({ request,env,adminEmail:email,event:'admin_logout',page:'admin_dashboard' })
  return Response.json({ ok:true },{ headers:{ 'Cache-Control':'private, no-store','Set-Cookie':clearAdminCookie } })
}
