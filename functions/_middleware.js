const ADMIN_HOST = 'admin.888888c.xyz'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const host = url.hostname.toLowerCase()

  if (host === ADMIN_HOST) {
    if (url.pathname === '/') {
      url.pathname = '/admin'
      return Response.redirect(url.toString(), 302)
    }

    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin/')) {
      return new Response('Not found', { status: 404 })
    }

    if (!url.pathname.startsWith('/admin') && !url.pathname.startsWith('/api/admin/') && !url.pathname.startsWith('/assets/') && url.pathname !== '/favicon.ico') {
      url.pathname = '/admin'
      return Response.redirect(url.toString(), 302)
    }
  }

  return context.next()
}
