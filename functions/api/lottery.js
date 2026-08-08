const UPSTREAM = 'https://lottery-official-data.cxu96175.workers.dev/lottery'
const GAMES = new Set(['fcsd', 'ssq', 'dlt', 'pls', 'plw', 'qxc', 'qlc', 'klb'])

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url)
  const game = incoming.searchParams.get('game') || ''
  const limit = Math.min(120, Math.max(1, Number(incoming.searchParams.get('limit')) || 30))
  const issue = incoming.searchParams.get('issue') || ''

  if (!GAMES.has(game)) {
    return Response.json({ error: '不支持的彩种' }, { status: 400 })
  }

  const upstream = new URL(UPSTREAM)
  upstream.searchParams.set('game', game)
  upstream.searchParams.set('limit', String(limit))
  upstream.searchParams.set('v', '18')
  if (issue) upstream.searchParams.set('issue', issue.slice(0, 16))

  try {
    const response = await fetch(upstream, {
      headers: { Accept: 'application/json' },
      cf: { cacheEverything: true, cacheTtl: 120 }
    })
    const body = await response.arrayBuffer()
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    return Response.json({ error: '开奖数据代理暂时不可用' }, { status: 502 })
  }
}
