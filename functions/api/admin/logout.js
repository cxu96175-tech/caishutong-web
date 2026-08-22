import { clearAdminCookie } from '../../_lib/adminAuth.js'

export function onRequestPost() {
  return Response.json({ ok:true },{ headers:{ 'Cache-Control':'private, no-store','Set-Cookie':clearAdminCookie } })
}
