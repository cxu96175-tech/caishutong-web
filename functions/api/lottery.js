import { fetchRealtimeRecords, sourceSummary, LOTTERY_SOURCES } from '../_lib/lotterySources.js'

const GAMES = new Set(Object.keys(LOTTERY_SOURCES))

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url)
  const game = incoming.searchParams.get('game') || ''
  const limit = Math.min(120, Math.max(1, Number(incoming.searchParams.get('limit')) || 30))
  const issue = incoming.searchParams.get('issue') || ''

  if (!GAMES.has(game)) return Response.json({ error: '不支持的彩种' }, { status: 400 })

  try {
    const result = await fetchRealtimeRecords(game, limit)
    const records = issue ? result.records.filter(record => String(record.issue) === String(issue).replace(/\D/g, '')) : result.records
    const provenance = sourceSummary(result)
    return Response.json({
      ok: true,
      game,
      records,
      source: result.source,
      sourceName: result.sourceName,
      sourceType: result.sourceType,
      sourceUrl: result.sourceUrl,
      fallback: Boolean(result.fallback),
      stale: Boolean(result.stale),
      verified: Boolean(result.verified),
      checkedAt: result.checkedAt,
      fallbackReason: result.fallbackReason || null,
      latestIssue: result.records[0]?.issue || null,
      latestDrawDate: result.records[0]?.drawDate || null,
      provenance
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Data-Source': result.source,
        'X-Data-Verified': String(Boolean(result.verified)),
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    return Response.json({ ok: false, error: '开奖数据暂时不可用', detail: error instanceof Error ? error.message : String(error), game }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
    })
  }
}
