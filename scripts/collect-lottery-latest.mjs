import { fetchOfficial, fetchProxy, LOTTERY_SOURCES } from '../functions/_lib/lotterySources.js'
import { parseOfficialSsqNoticeHtml, parseOfficialWelfareNoticeHtml } from '../functions/_lib/ssqNotice.js'

const games = Object.keys(LOTTERY_SOURCES)
const errorText = error => {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error?.cause?.code || error?.cause?.message
  return cause ? `${message} (${cause})` : message
}
const sameIssue = (game, left, right) => {
  const canonical = value => ['dlt', 'qxc', 'pl3', 'pl5'].includes(game) ? String(value).slice(-5) : String(value)
  return canonical(left) === canonical(right)
}
const sameNumbers = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((value, index) => Number(value) === Number(right[index]))
const mergeMissingDrawMetadata = (record, supplement) => {
  const merged = { ...record }
  for (const key of ['saleAmount', 'poolAmount', 'poolApplicable', 'firstPrize', 'prizeRows']) {
    if (merged[key] === undefined && supplement?.[key] !== undefined) merged[key] = supplement[key]
  }
  return merged
}

const MIRROR_URL = 'https://raw.githubusercontent.com/wenjinliuu/lottery-data-repo/main/public_data/v2/bootstrap.json'
const SWLC_SSQ_URL = 'https://www.swlc.net.cn/lottery/ssq.html?limit=100&view=previous'
const MIRROR_TYPES = Object.freeze({ fc3d: 'fc3d', ssq: 'ssq', dlt: 'dlt', pl3: 'pl3', pl5: 'pl5', qxc: 'qxc', qlc: 'qlc', kl8: 'kl8' })
const mirrorRecord = (game, item) => {
  if (!item || typeof item !== 'object' || !item.numbers) return null
  const numberGroups = {
    fc3d: item.numbers.digits,
    ssq: [...(item.numbers.red || []), ...(item.numbers.blue || [])],
    dlt: [...(item.numbers.front || []), ...(item.numbers.back || [])],
    pl3: item.numbers.digits,
    pl5: item.numbers.digits,
    qxc: item.numbers.digits,
    qlc: [...(item.numbers.basic || []), item.numbers.special].filter(Number.isInteger),
    kl8: item.numbers.nums
  }
  const numbers = numberGroups[game]
  if (!Array.isArray(numbers) || numbers.length !== LOTTERY_SOURCES[game].expected) return null
  const prizes = Array.isArray(item.prizes) ? item.prizes : []
  const prizeRows = prizes.map(prize => ({
    level: String(prize.name || '').replace(/奖$/, ''),
    ...(Number.isFinite(Number(prize.amount)) ? { amount: Number(prize.amount) } : {}),
    ...(Number.isFinite(Number(prize.winners)) ? { count: Number(prize.winners) } : {}),
    ...(typeof (prize.provinces || prize.province || prize.winningProvince) === 'string'
      ? { provinces: String(prize.provinces || prize.province || prize.winningProvince).slice(0, 500) } : {})
  })).filter(prize => prize.level)
  const firstPrize = prizeRows.find(prize => game === 'pl3' ? prize.level === '直选' : prize.level === '一等奖')
  const record = {
    issue: String(item.issue || ''), drawDate: String(item.date || '').slice(0, 10), numbers: numbers.map(Number),
    ...(item.sales != null && Number.isFinite(Number(item.sales)) ? { saleAmount: Number(item.sales) } : {}),
    ...(item.pool != null && Number.isFinite(Number(item.pool)) ? { poolAmount: Number(item.pool) } : {}),
    poolApplicable: !['fc3d', 'pl3', 'pl5', 'kl8'].includes(game),
    ...(prizeRows.length ? { prizeRows } : {}),
    ...(firstPrize ? { firstPrize } : {})
  }
  const ranges = LOTTERY_SOURCES[game].ranges
  if (!/^\d{4,8}$/.test(record.issue) || !/^\d{4}-\d{2}-\d{2}$/.test(record.drawDate)
    || numbers.some((value, index) => !Number.isInteger(Number(value))
      || Number(value) < ranges[index][0] || Number(value) > ranges[index][1])) return null
  return record
}

async function fetchPublicMirror() {
  const response = await fetch(MIRROR_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`GitHub 开奖镜像 HTTP ${response.status}`)
  const payload = await response.json()
  const generatedAt = Date.parse(payload?.generated_at || '')
  if (payload?.schema !== 'duigehao.lottery.bootstrap' || payload?.version !== 2
    || !Number.isFinite(generatedAt) || Date.now() - generatedAt > 48 * 60 * 60 * 1000) {
    throw new Error('GitHub 开奖镜像格式错误或超过48小时未更新')
  }
  const records = Object.fromEntries(Object.entries(MIRROR_TYPES).map(([game, type]) => {
    const record = mirrorRecord(game, payload.latest?.[type])
    return [game, record ? {
      record,
      source: 'github-mirror:wenjinliuu/lottery-data-repo',
      sourceName: 'GitHub 公开开奖镜像（按期校验）',
      sourceType: 'third-party',
      sourceUrl: MIRROR_URL,
      verified: false,
      metadataSource: record.saleAmount !== undefined || record.firstPrize ? 'GitHub 公开开奖镜像' : null
    } : null]
  }))
  return { generatedAt: payload.generated_at, records }
}

async function fetchOfficialSsqNotice() {
  const response = await fetch(SWLC_SSQ_URL, {
    headers: { Accept: 'text/html', 'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0 (compatible; LotteryNotice/1.0)' },
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) throw new Error(`上海福彩公告 HTTP ${response.status}`)
  const html = await response.text()
  const record = parseOfficialWelfareNoticeHtml(html, 'ssq')[0] || parseOfficialSsqNoticeHtml(html)
  if (record) {
    return { game: 'ssq', record, verified: true,
      source: 'official:swlc.net.cn', sourceName: '上海市福利彩票发行中心官方开奖公告',
      sourceType: 'official', sourceUrl: SWLC_SSQ_URL }
  }
  throw new Error('上海福彩公告未解析到有效双色球记录')
}

const mirrorPromise = fetchPublicMirror().catch(error => ({
  error: errorText(error), records: {}
}))

async function collect(game) {
  if (game === 'ssq') {
    try {
      const officialNotice = await fetchOfficialSsqNotice()
      const apiResult = await fetchOfficial(game, 1).catch(() => null)
      if (!apiResult || Number(officialNotice.record.issue) > Number(apiResult.records?.[0]?.issue || 0)) {
        const [publicDetail, mirror] = await Promise.allSettled([fetchProxy(game, 1), mirrorPromise])
        const supplements = [
          publicDetail.status === 'fulfilled' ? publicDetail.value : null,
          mirror.status === 'fulfilled' ? mirror.value.records?.[game] : null
        ]
        let record = officialNotice.record
        let metadataSource = null
        for (const supplementResult of supplements) {
          const supplement = supplementResult?.record || supplementResult?.records?.[0]
          if (supplement && sameIssue(game, record.issue, supplement.issue) && sameNumbers(record.numbers, supplement.numbers)) {
            record = mergeMissingDrawMetadata(record, supplement)
            metadataSource = supplementResult.metadataSource || supplementResult.sourceName || '公开开奖详情'
          }
        }
        return { ...officialNotice, record, ...(metadataSource ? { metadataSource } : {}) }
      }
    } catch (error) {
      console.warn(`双色球官方公告回退失败：${errorText(error)}`)
    }
  }
  const [official, publicDetail, mirror] = await Promise.allSettled([
    fetchOfficial(game, 1),
    fetchProxy(game, 1),
    mirrorPromise
  ])
  const officialResult = official.status === 'fulfilled' ? official.value : null
  const publicResult = publicDetail.status === 'fulfilled' ? publicDetail.value : null
  const mirrorResult = mirror.status === 'fulfilled' ? mirror.value.records?.[game] : null
  const mirrorIssue = Number(mirrorResult?.record?.issue || 0)
  const officialIssue = Number(officialResult?.records?.[0]?.issue || 0)
  const publicIssue = Number(publicResult?.records?.[0]?.issue || 0)
  const primary = officialResult && publicResult && publicIssue > officialIssue
    && !sameIssue(game, officialIssue, publicIssue) ? publicResult : officialResult || publicResult
  const newestMirror = mirrorResult && (!primary || (mirrorIssue > Number(primary.records?.[0]?.issue || 0)
    && !sameIssue(game, primary.records?.[0]?.issue, mirrorResult.record.issue))) ? mirrorResult : null
  const chosen = primary || newestMirror
  if (!chosen) return {
    game,
    error: '没有可用的最新期开奖',
    sourceErrors: {
      official: official.status === 'rejected' ? errorText(official.reason) : '接口未返回有效记录',
      fallback: publicDetail.status === 'rejected' ? errorText(publicDetail.reason) : '接口未返回有效记录',
      mirror: mirrorResult ? '镜像无可用记录' : (mirror.status === 'rejected' ? errorText(mirror.reason) : mirrorResult?.error || mirror.value?.error || '镜像未返回有效记录')
    }
  }

  const record = { ...(chosen.record || chosen.records[0]) }
  let metadataSource = chosen === newestMirror ? chosen.metadataSource : null
  const supplements = [
    ...(primary === officialResult && publicResult ? [publicResult] : []),
    ...(mirrorResult && !newestMirror ? [mirrorResult] : [])
  ]
  for (const supplementResult of supplements) {
    const supplement = supplementResult.record || supplementResult.records?.[0]
    if (supplement && sameIssue(game, record.issue, supplement.issue)
      && sameNumbers(record.numbers, supplement.numbers)) {
      Object.assign(record, mergeMissingDrawMetadata(record, supplement))
      metadataSource = supplementResult.metadataSource || supplementResult.source
    }
  }
  return {
    game, record, verified: chosen === primary && primary === officialResult,
    source: chosen.source, sourceName: chosen.sourceName,
    sourceType: chosen.sourceType, sourceUrl: chosen.sourceUrl,
    ...(chosen === newestMirror ? { metadataSource: chosen.metadataSource } : {}),
    metadataSource
  }
}

const results = await Promise.all(games.map(collect))
if (!results.some(result => result.record)) {
  console.error(JSON.stringify({ error: '所有彩种的最新开奖采集均失败', results }, null, 2))
  process.exitCode = 1
} else {
  process.stdout.write(JSON.stringify({ collectedAt: new Date().toISOString(), results }))
}
