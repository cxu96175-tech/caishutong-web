import { fetchRealtimeRecords, sourceSummary, LOTTERY_SOURCES } from '../_lib/lotterySources.js'
import { readLatestSnapshot, saveLatestSnapshot, shanghaiDate } from '../_lib/lotterySnapshot.js'

const GAMES = new Set(Object.keys(LOTTERY_SOURCES))

export async function onRequestGet({ request, waitUntil, env }) {
  const incoming = new URL(request.url)
  const game = incoming.searchParams.get('game') || ''
  const limit = Math.min(120, Math.max(1, Number(incoming.searchParams.get('limit')) || 30))
  const issue = incoming.searchParams.get('issue') || ''
  const snapshotMode = limit === 1 && !issue && Boolean(env?.DB)

  if (!GAMES.has(game)) return Response.json({ error: '不支持的彩种' }, { status: 400 })

  // 首页只读持久快照。刷新页面和手动刷新都不能引发重复的上游抓取。
  if (snapshotMode) {
    try {
      const snapshot = await readLatestSnapshot(env.DB, game)
      if (snapshot) {
        const source = { ...snapshot.source, checkedAt: snapshot.checkedAt, stale: false }
        return Response.json({
          ok: true, game, records: [snapshot.record],
          ...source, provenance: sourceSummary(source),
          latestIssue: snapshot.issue, latestDrawDate: snapshot.record.drawDate || null,
          completedToday: snapshot.completedOn === shanghaiDate(),
          snapshot: true
        }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
      }
    } catch { /* 快照表尚未迁移时沿用原实时接口。 */ }
  }

  // 统一缓存键，避免前端版本参数导致同一彩种反复触发慢速上游请求。
  const cache = globalThis.caches?.default
  const cacheUrl = new URL(incoming.origin + '/api/lottery')
  cacheUrl.searchParams.set('game', game)
  cacheUrl.searchParams.set('limit', String(limit))
  if (issue) cacheUrl.searchParams.set('issue', issue)
  const cacheKey = new Request(cacheUrl.toString())
  try {
    const cached = snapshotMode || incoming.searchParams.has('fresh') ? null : await cache?.match(cacheKey)
    if (cached) return cached
  } catch { /* Cache API 不可用时继续从上游读取。 */ }

  try {
    const result = await fetchRealtimeRecords(game, limit)
    if (limit === 1 && !issue && env?.DB) {
      try { await saveLatestSnapshot(env.DB, game, result) } catch { /* 数据库暂不可用不能阻断开奖结果。 */ }
    }
    const records = issue ? result.records.filter(record => String(record.issue) === String(issue).replace(/\D/g, '')) : result.records
    const provenance = sourceSummary(result)
    const shanghaiTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
    const [hour, minute] = shanghaiTime.split(':').map(Number)
    const drawWindow = hour * 60 + minute >= 20 * 60 + 50 && hour * 60 + minute <= 22 * 60 + 30
    const cacheSeconds = drawWindow ? 60 : 15 * 60
    const response = Response.json({
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
        'Cache-Control': `public, max-age=${cacheSeconds}`,
        'X-Data-Source': result.source,
        'X-Data-Verified': String(Boolean(result.verified)),
        'X-Content-Type-Options': 'nosniff'
      }
    })
    if (cache && waitUntil) waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}))
    return response
  } catch (error) {
    return Response.json({ ok: false, error: '开奖数据暂时不可用', detail: error instanceof Error ? error.message : String(error), game }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
    })
  }
}
