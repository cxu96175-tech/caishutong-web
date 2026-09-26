import { fetchRealtimeRecords, sourceSummary, LOTTERY_SOURCES } from '../_lib/lotterySources.js'

const ARCHIVE_BASE = 'https://data.17500.cn/'
const ARCHIVES = {
  fc3d: { file: '3d_asc.txt', count: 3 },
  ssq: { file: 'ssq_asc.txt', count: 7 },
  dlt: { file: 'dlt_asc.txt', count: 7 },
  pl3: { file: 'pl3_asc.txt', count: 3 },
  pl5: { file: 'pl5_asc.txt', count: 5 },
  qxc: { file: '7xc_asc.txt', count: 7 },
  qlc: { file: '7lc_asc.txt', count: 8 },
  kl8: { file: 'kl8_asc.txt', count: 20 }
}

function canonicalIssue(game, value) {
  const issue = String(value || '')
  return (game === 'dlt' || game === 'qxc') && /^20\d{5}$/.test(issue) ? issue.slice(2) : issue
}

function parseArchive(text, game, count) {
  const records = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < count + 2) continue
    const issue = canonicalIssue(game, fields[0])
    const drawDate = fields[1]
    const numbers = fields.slice(2, count + 2)
    if (!/^\d{4,8}$/.test(issue) || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) continue
    if (numbers.length !== count || numbers.some(value => !/^\d{1,2}$/.test(value))) continue
    records.push({ issue, drawDate, numbers: numbers.map(Number) })
  }
  return records
}

function issueNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return Number(digits || 0)
}

function mergeRecords(current, archive) {
  const byIssue = new Map()
  // 同一期号严格由实时源优先；归档只负责补齐实时源没有的旧期。
  for (const record of [...current, ...archive]) {
    if (record?.issue && !byIssue.has(String(record.issue))) byIssue.set(String(record.issue), record)
  }
  return [...byIssue.values()].sort((left, right) => issueNumber(right.issue) - issueNumber(left.issue))
}

async function fetchArchive(game) {
  const archive = ARCHIVES[game]
  const url = `${ARCHIVE_BASE}${archive.file}`
  const response = await fetch(url, {
    headers: { Accept: 'text/plain' },
    cf: { cacheEverything: true, cacheTtl: 3600 }
  })
  if (!response.ok) throw new Error(`历史归档 HTTP ${response.status}`)
  const records = parseArchive(await response.text(), game, archive.count)
  if (!records.length) throw new Error('历史归档为空')
  return { records, source: `third-party-archive:${new URL(url).hostname}`, sourceUrl: url, sourceName: '17500.cn 历史归档' }
}

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url)
  const game = incoming.searchParams.get('game') || ''
  if (!LOTTERY_SOURCES[game] || !ARCHIVES[game]) return Response.json({ error: '不支持的彩种' }, { status: 400 })

  // 实时源与历史归档并行请求，但最终选择严格按可信度排序，不按返回速度抢占。
  const [realtimeResult, archiveResult] = await Promise.all([
    fetchRealtimeRecords(game, 120).then(value => ({ value })).catch(error => ({ error })),
    fetchArchive(game).then(value => ({ value })).catch(error => ({ error }))
  ])
  const realtime = realtimeResult.value || null
  const realtimeError = realtimeResult.error ? (realtimeResult.error instanceof Error ? realtimeResult.error.message : String(realtimeResult.error)) : ''
  if (archiveResult.error && !realtime?.records?.length) return Response.json({ error: '历史开奖数据暂时不可用', detail: archiveResult.error instanceof Error ? archiveResult.error.message : String(archiveResult.error) }, { status: 502 })
  const archive = archiveResult.value || { records: [], source: '', sourceUrl: '', sourceName: '' }

  const current = realtime?.records || []
  const records = mergeRecords(current, archive.records)
  if (!records.length) return Response.json({ error: '历史开奖数据为空' }, { status: 502 })

  const primary = realtime || { source: archive.source, sourceUrl: archive.sourceUrl, sourceName: archive.sourceName, sourceType: 'third-party-archive', fallback: true, verified: false, stale: true, checkedAt: new Date().toISOString() }
  const provenance = sourceSummary(primary)
  return Response.json({
    ok: true,
    game,
    records,
    source: primary.source,
    sourceName: primary.sourceName,
    sourceType: primary.sourceType || 'third-party-archive',
    sourceUrl: primary.sourceUrl,
    fallback: Boolean(primary.fallback),
    stale: Boolean(primary.stale),
    verified: Boolean(primary.verified),
    checkedAt: primary.checkedAt,
    latestIssue: records[0]?.issue || null,
    latestDrawDate: records[0]?.drawDate || null,
    provenance,
    archiveSource: archive.source || null,
    archiveSourceUrl: archive.sourceUrl || null,
    realtimeError: realtimeError || null
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Data-Source': primary.source,
      'X-Data-Verified': String(Boolean(primary.verified)),
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
