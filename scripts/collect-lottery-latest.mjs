import { fetchOfficial, fetchProxy, LOTTERY_SOURCES } from '../functions/_lib/lotterySources.js'

const games = Object.keys(LOTTERY_SOURCES)
const sameIssue = (game, left, right) => {
  const canonical = value => ['dlt', 'qxc', 'pl3', 'pl5'].includes(game) ? String(value).slice(-5) : String(value)
  return canonical(left) === canonical(right)
}
const sameNumbers = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((value, index) => Number(value) === Number(right[index]))

async function collect(game) {
  const [official, publicDetail] = await Promise.allSettled([
    fetchOfficial(game, 1),
    fetchProxy(game, 1)
  ])
  const officialResult = official.status === 'fulfilled' ? official.value : null
  const publicResult = publicDetail.status === 'fulfilled' ? publicDetail.value : null
  const officialIssue = Number(officialResult?.records?.[0]?.issue || 0)
  const publicIssue = Number(publicResult?.records?.[0]?.issue || 0)
  const primary = officialResult && publicResult && publicIssue > officialIssue
    && !sameIssue(game, officialIssue, publicIssue) ? publicResult : officialResult || publicResult
  if (!primary?.records?.[0]) return { game, error: '没有可用的最新期开奖' }

  const record = { ...primary.records[0] }
  let metadataSource = null
  if (primary === officialResult && publicResult) {
    const supplement = publicResult.records[0]
    if (supplement && sameIssue(game, record.issue, supplement.issue)
      && sameNumbers(record.numbers, supplement.numbers)) {
      for (const key of ['saleAmount', 'poolAmount', 'firstPrize']) {
        if (record[key] === undefined && supplement[key] !== undefined) record[key] = supplement[key]
      }
      metadataSource = publicResult.source
    }
  }
  return {
    game, record, verified: primary === officialResult,
    source: primary.source, sourceName: primary.sourceName,
    sourceType: primary.sourceType, sourceUrl: primary.sourceUrl,
    metadataSource
  }
}

const results = await Promise.all(games.map(collect))
if (!results.some(result => result.record)) {
  console.error('所有彩种的最新开奖采集均失败')
  process.exitCode = 1
} else {
  process.stdout.write(JSON.stringify({ collectedAt: new Date().toISOString(), results }))
}
