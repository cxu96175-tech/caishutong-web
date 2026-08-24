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

function parseArchive(text, count) {
  const records = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < count + 2) continue
    const issue = fields[0]
    const drawDate = fields[1]
    const numbers = fields.slice(2, count + 2)
    if (!/^\d{4,8}$/.test(issue) || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) continue
    if (numbers.length !== count || numbers.some(value => !/^\d{1,2}$/.test(value))) continue
    records.push({ issue, drawDate, numbers })
  }
  return records.reverse()
}

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url)
  const game = incoming.searchParams.get('game') || ''
  const archive = ARCHIVES[game]
  if (!archive) return Response.json({ error: '不支持的彩种' }, { status: 400 })

  try {
    const response = await fetch(`${ARCHIVE_BASE}${archive.file}`, {
      headers: { Accept: 'text/plain' },
      cf: { cacheEverything: true, cacheTtl: 86400 }
    })
    if (!response.ok) return Response.json({ error: '历史开奖数据暂时不可用' }, { status: 502 })
    const records = parseArchive(await response.text(), archive.count)
    if (!records.length) return Response.json({ error: '历史开奖数据为空' }, { status: 502 })
    return Response.json({ game, records, source: '公开历史开奖归档' }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return Response.json({ error: '历史开奖数据代理暂时不可用' }, { status: 502 })
  }
}
