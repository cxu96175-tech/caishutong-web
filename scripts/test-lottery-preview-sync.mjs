import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { enrichLatestSnapshot, readLatestSnapshot, saveLatestSnapshot } from '../functions/_lib/lotterySnapshot.js'
import { LOTTERY_SOURCES, mergeMissingDrawMetadata, parseKjhDetail, parseOfficialSportsHistoryHtml, parseShanghaiFc3dHistoryHtml, fetchOfficial } from '../functions/_lib/lotterySources.js'
import { parseOfficialSsqNoticeHtml, parseOfficialWelfareNoticeHtml } from '../functions/_lib/ssqNotice.js'
import { onRequestGet as getLottery } from '../functions/api/lottery.js'
import lotterySyncWorker, { isExpectedGithubSubject, synchronize } from '../worker-lottery-sync/index.js'

assert.equal(isExpectedGithubSubject('repo:cxu96175-tech/caishutong-web:ref:refs/heads/main'), true)
assert.equal(isExpectedGithubSubject('repo:cxu96175-tech@310116318/caishutong-web@1324034095:ref:refs/heads/main'), true)
assert.equal(isExpectedGithubSubject('repo:another-account/caishutong-web:ref:refs/heads/main'), false)
assert.equal(isExpectedGithubSubject('repo:cxu96175-tech@310116318/other-repo@1324034095:ref:refs/heads/main'), false)
assert.deepEqual(parseOfficialSsqNoticeHtml('<table><tr><td>2026127</td><td>2026-11-05(四)</td><td><span>13</span>14 19 25 29 32</td><td>12</td></tr></table>'), {
  issue: '2026127', drawDate: '2026-11-05', numbers: [13, 14, 19, 25, 29, 32, 12]
})
assert.equal(parseOfficialSsqNoticeHtml('<tr><td>2026127</td><td>2026-11-05</td><td>131419252932</td><td>99</td></tr>'), null)
assert.deepEqual(parseOfficialWelfareNoticeHtml('<table><tr><td>2026297</td><td>2026-11-07(六)</td><td><span><i>1</i><i>2</i><i>3</i></span></td><td>1,937,630.00</td><td>887</td></tr></table>', 'fc3d'), [],
  '3D must not accept a regional HTML sales field; use the nationwide CWL API')
assert.deepEqual(parseShanghaiFc3dHistoryHtml('<table><tr><td>2026298</td><td>2026-11-08(日)</td><td><span><i>0</i><i>8</i><i>5</i></span></td><td>1,923,580.00</td><td>400</td></tr></table>'), [
  { issue: '2026298', drawDate: '2026-11-08', numbers: [0, 8, 5] }
], 'regional official 3D fallback confirms only issue, date and nationwide draw digits, never Shanghai sales')
assert.deepEqual(parseShanghaiFc3dHistoryHtml('<tr><td>2026298</td><td>2026-11-08</td><td>123</td></tr>'), [],
  'reject malformed regional rows instead of guessing draw digits')
assert.deepEqual(parseOfficialWelfareNoticeHtml('<tr><td>2026297</td><td>2026-11-07(六)</td><td><span><i>02</i><i>05</i><i>11</i><i>13</i><i>17</i><i>23</i><i>25</i><i>36</i><i>41</i><i>42</i><i>43</i><i>45</i><i>48</i><i>49</i><i>50</i><i>58</i><i>66</i><i>72</i><i>76</i><i>79</i></span></td><td>110,153,248.00</td></tr>', 'kl8')[0], {
  issue: '2026297', drawDate: '2026-11-07', numbers: [2, 5, 11, 13, 17, 23, 25, 36, 41, 42, 43, 45, 48, 49, 50, 58, 66, 72, 76, 79], saleAmount: 110153248, poolApplicable: false
})
assert.deepEqual(parseOfficialWelfareNoticeHtml('<tr><td>2026128</td><td>2026-11-06(五)</td><td><span><i>04</i><i>09</i><i>10</i><i>23</i><i>26</i><i>29</i><i>30</i></span></td><td><span><i>21</i></span></td><td>3,469,812.00</td><td>1</td><td>787,859.00</td><td>5</td><td>22,510.00</td><td>157</td><td>1,433.00</td><td>0.00</td></tr>', 'qlc')[0], {
  issue: '2026128', drawDate: '2026-11-06', numbers: [4, 9, 10, 23, 26, 29, 30, 21], saleAmount: 3469812,
  poolApplicable: true, poolAmount: 0, firstPrize: { level: '一等奖', count: 1, amount: 787859 }
})
assert.deepEqual(parseKjhDetail('<div>一等奖中奖情况：天津1注，河北1注，共2注。</div><table><tr><td>一等奖</td><td>10000000元</td><td>2</td></tr></table>', 'ssq'), {
  firstPrize: { level: '一等奖', amount: 10000000, count: 2, provinces: '天津1注，河北1注' },
  prizeRows: [{ level: '一等奖', amount: 10000000, count: 2, provinces: '天津1注，河北1注' }]
})
assert.deepEqual(mergeMissingDrawMetadata({ firstPrize: { level: '一等奖', amount: 5 } }, {
  firstPrize: { count: 3, provinces: '上海3注' }
}).firstPrize, { level: '一等奖', amount: 5, count: 3, provinces: '上海3注' })

const officialSportsFixtures = {
  dlt: '<table><tr><th>日期</th><th>期号</th><th>开奖号码</th></tr><tr><td>2026-11-07</td><td>26127</td><td>05 06 17 18 27 03 12</td><td><a>详细</a></td></tr></table>',
  pl3: '<table><tr><td>2026-11-07</td><td>26297</td><td>7 7 7</td><td>详细</td></tr></table>',
  pl5: '<table><tr><td>2026-11-07</td><td>26297</td><td>7 7 7 8 7</td><td>详细</td></tr></table>',
  qxc: '<table><tr><td>2026-11-06</td><td>26127</td><td>5 1 3 7 4 8 8</td></tr></table>'
}
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.dlt, 'dlt')[0], {
  issue: '26127', drawDate: '2026-11-07', numbers: [5, 6, 17, 18, 27, 3, 12]
})
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.pl3, 'pl3')[0].numbers, [7, 7, 7])
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.pl5, 'pl5')[0].numbers, [7, 7, 7, 8, 7])
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.qxc, 'qxc')[0].numbers, [5, 1, 3, 7, 4, 8, 8])
assert.equal(parseOfficialSportsHistoryHtml('<tr><td>2026-11-07</td><td>26297</td><td>36 06 17</td></tr>', 'pl3').length, 0)

const originalOfficialFetch = globalThis.fetch
try {
  const requested = []
  globalThis.fetch = async url => {
    requested.push(String(url))
    return new Response(JSON.stringify({ state: 0, '结果': [{
      '名称': '3D', '代码': '2026297', 'date': '2026-11-07(六)', 'red': '1,2,3', 'sales': '96507570'
    }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const nationalFc3d = await fetchOfficial('fc3d', 1)
  assert.equal(nationalFc3d.records[0].issue, '2026297')
  assert.equal(nationalFc3d.records[0].saleAmount, 96507570, '福彩3D销量 must use national sales, not Shanghai regional sales')
  assert.equal(requested.length, 1, '福彩3D should use the national welfare API directly')

  for (const game of ['dlt', 'pl3', 'pl5', 'qxc']) {
    const requested = []
    globalThis.fetch = async url => {
      requested.push(String(url))
      if (String(url).includes('sporttery.cn')) throw new Error('primary source unavailable')
      return new Response(officialSportsFixtures[game], { status: 200, headers: { 'content-type': 'text/html' } })
    }
    const upstream = await fetchOfficial(game, 1)
    assert.equal(upstream.verified, true, `${game} regional fallback remains an official source`)
    assert.equal(upstream.sourceType, 'official')
    assert.equal(upstream.fallback, true)
    assert.equal(upstream.records[0].issue, game === 'dlt' || game === 'qxc' ? '26127' : '26297')
    assert.equal(requested.length, 2, `${game} first tries the national API, then official regional HTML`)
  }
} finally {
  globalThis.fetch = originalOfficialFetch
}

const date = new Date('2026-10-30T13:00:00.000Z')
const sqlite = new DatabaseSync(':memory:')
sqlite.exec(readFileSync(new URL('../migrations/0005_lottery_latest.sql', import.meta.url), 'utf8'))
const db = {
  prepare(sql) {
    return {
      bind(...values) {
        const statement = sqlite.prepare(sql)
        return {
          first: async () => statement.get(...values) || null,
          run: async () => ({ meta: { changes: statement.run(...values).changes } })
        }
      }
    }
  }
}

const record = { issue: '2026288', drawDate: '2026-10-30', numbers: [6, 1, 2] }
const base = { records: [record], source: 'official:test', verified: true, sourceType: 'official' }
const officialMetadata = { saleAmount: 1200, poolApplicable: false }
const supplementedMetadata = mergeMissingDrawMetadata(officialMetadata, {
  saleAmount: 9999, poolAmount: 44, poolApplicable: true,
  firstPrize: { level: '直选', amount: 1040 }, prizeRows: [{ level: '直选', amount: 1040, count: 2 }]
})
assert.deepEqual(supplementedMetadata, {
  saleAmount: 1200, poolApplicable: false, poolAmount: 44,
  firstPrize: { level: '直选', amount: 1040 }, prizeRows: [{ level: '直选', amount: 1040, count: 2 }]
})

// Normal homepage reads must use D1 only; the explicit refresh must call the
// upstream and return the newly persisted latest issue.
const originalFetch = globalThis.fetch
let upstreamCalls = 0
const refreshSqlite = new DatabaseSync(':memory:')
refreshSqlite.exec(readFileSync(new URL('../migrations/0005_lottery_latest.sql', import.meta.url), 'utf8'))
const refreshDb = {
  prepare(sql) {
    return {
      bind(...values) {
        const statement = refreshSqlite.prepare(sql)
        return {
          first: async () => statement.get(...values) || null,
          run: async () => ({ meta: { changes: statement.run(...values).changes } })
        }
      }
    }
  }
}
globalThis.fetch = async () => {
  upstreamCalls += 1
  return Response.json({ issue: '2026301', drawDate: '2026-11-07', result: '1 2 3' })
}
try {
  const beforeManualRefresh = { issue: '2026300', drawDate: '2026-11-04', numbers: [2, 6, 1] }
  await saveLatestSnapshot(refreshDb, 'fc3d', { ...base, records: [beforeManualRefresh] }, new Date('2026-11-04T13:00:00.000Z'))
  const readOnlyResponse = await getLottery({ request: new Request('https://test.invalid/api/lottery?game=fc3d&limit=1'), env: { DB: refreshDb } })
  assert.equal(readOnlyResponse.status, 200)
  assert.equal((await readOnlyResponse.json()).latestIssue, '2026300')
  assert.equal(upstreamCalls, 0, 'normal home load must not scrape upstream')

  const refreshResponse = await getLottery({ request: new Request('https://test.invalid/api/lottery?game=fc3d&limit=1&fresh=2026110722'), env: { DB: refreshDb } })
  const refreshed = await refreshResponse.json()
  assert.equal(refreshResponse.status, 200)
  assert.equal(refreshed.latestIssue, '2026301')
  assert.equal(refreshed.refreshStatus, 'updated')
  assert.equal(upstreamCalls, 1, 'explicit refresh reads the national welfare API directly')
  assert.equal((await readLatestSnapshot(refreshDb, 'fc3d')).issue, '2026301')

  // A verified current issue can contain legacy regional sales in D1. Manual
  // refresh must enrich that exact issue from the national welfare endpoint.
  const oldRegionalRecord = {
    issue: '2026297', drawDate: '2026-11-07', numbers: [1, 2, 3],
    saleAmount: 1937630, poolAmount: 0
  }
  const legacyRefreshSqlite = new DatabaseSync(':memory:')
  legacyRefreshSqlite.exec(readFileSync(new URL('../migrations/0005_lottery_latest.sql', import.meta.url), 'utf8'))
  const legacyRefreshDb = {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = legacyRefreshSqlite.prepare(sql)
          return {
            first: async () => statement.get(...values) || null,
            run: async () => ({ meta: { changes: statement.run(...values).changes } })
          }
        }
      }
    }
  }
  await saveLatestSnapshot(legacyRefreshDb, 'fc3d', {
    ...base,
    records: [oldRegionalRecord],
    source: 'official:www.swlc.net.cn', sourceName: '上海市福利彩票发行中心官方开奖公告',
    sourceUrl: 'https://www.swlc.net.cn/lottery/3d.html', verified: true
  }, new Date('2026-11-07T14:00:00.000Z'))
  globalThis.fetch = async () => Response.json({ state: 0, result: [{
    code: '2026297', date: '2026-11-07(六)', red: '1,2,3', sales: '96507570',
    poolmoney: '', prizegrades: [{ type: 1, typenum: '', typemoney: '' }]
  }] })
  const sameIssueRefreshResponse = await getLottery({
    request: new Request('https://test.invalid/api/lottery?game=fc3d&limit=1&fresh=2026110822'),
    env: { DB: legacyRefreshDb }
  })
  const sameIssueRefresh = await sameIssueRefreshResponse.json()
  assert.equal(sameIssueRefresh.latestIssue, '2026297')
  assert.equal(sameIssueRefresh.refreshStatus, 'updated', 'same-issue metadata correction counts as a refresh update')
  assert.equal(sameIssueRefresh.records[0].saleAmount, 96507570)
  assert.equal(sameIssueRefresh.records[0].poolApplicable, false)
  assert.equal(sameIssueRefresh.records[0].firstPrize?.count, undefined, 'missing official winner count remains unavailable')
  assert.equal((await readLatestSnapshot(legacyRefreshDb, 'fc3d')).record.saleAmount, 96507570)
  legacyRefreshSqlite.close()

  // If all live sources fail, an explicit refresh must report failure and
  // preserve the known-good snapshot instead of presenting it as a success.
  const beforeFailedRefresh = await readLatestSnapshot(refreshDb, 'fc3d')
  globalThis.fetch = async () => new Response('upstream unavailable', { status: 503 })
  const failedRefreshResponse = await getLottery({ request: new Request('https://test.invalid/api/lottery?game=fc3d&limit=1&fresh=2026110802'), env: { DB: refreshDb } })
  const failedRefresh = await failedRefreshResponse.json()
  assert.equal(failedRefreshResponse.status, 200, 'refresh keeps page data available from snapshot')
  assert.equal(failedRefresh.refreshStatus, 'failed')
  assert.match(failedRefresh.refreshError, /均不可用/)
  assert.equal(failedRefresh.latestIssue, beforeFailedRefresh.issue)
  assert.deepEqual(await readLatestSnapshot(refreshDb, 'fc3d'), beforeFailedRefresh, 'failed refresh cannot change the snapshot')
} finally {
  globalThis.fetch = originalFetch
}
assert.equal(await saveLatestSnapshot(db, 'fc3d', base, date), true)
assert.equal(await enrichLatestSnapshot(db, 'fc3d', { ...record, numbers: [6, 1, 3], saleAmount: 100 }, 'wrong', date), false)
assert.equal((await readLatestSnapshot(db, 'fc3d')).record.saleAmount, undefined)

// Correct the legacy regional 3D sales value only when the national official
// source confirms the exact issue and winning digits; third-party values and
// mismatched draws must never rewrite stored metadata.
const correctionSqlite = new DatabaseSync(':memory:')
correctionSqlite.exec(readFileSync(new URL('../migrations/0005_lottery_latest.sql', import.meta.url), 'utf8'))
const correctionDb = {
  prepare(sql) {
    return {
      bind(...values) {
        const statement = correctionSqlite.prepare(sql)
        return {
          first: async () => statement.get(...values) || null,
          run: async () => ({ meta: { changes: statement.run(...values).changes } })
        }
      }
    }
  }
}
const legacyFc3d = { issue: '2026297', drawDate: '2026-11-07', numbers: [1, 2, 3], saleAmount: 1937630, poolApplicable: false }
await saveLatestSnapshot(correctionDb, 'fc3d', {
  records: [legacyFc3d], source: 'official:swlc.net.cn', verified: true
}, new Date('2026-11-07T14:00:00.000Z'))
assert.equal(await enrichLatestSnapshot(correctionDb, 'fc3d', { ...legacyFc3d, saleAmount: 96507570 }, 'official:swlc.net.cn'), false,
  'regional official values cannot replace existing 3D sales')
assert.equal((await readLatestSnapshot(correctionDb, 'fc3d')).record.saleAmount, 1937630)
assert.equal(await enrichLatestSnapshot(correctionDb, 'fc3d', { ...legacyFc3d, saleAmount: 96507570 }, 'official:www.cwl.gov.cn'), true)
assert.equal((await readLatestSnapshot(correctionDb, 'fc3d')).record.saleAmount, 96507570)
assert.equal((await readLatestSnapshot(correctionDb, 'fc3d')).record.poolApplicable, false)
assert.equal(await enrichLatestSnapshot(correctionDb, 'fc3d', { ...legacyFc3d, numbers: [1, 2, 4], saleAmount: 10 }, 'official:www.cwl.gov.cn'), false,
  'a number mismatch must not permit metadata correction')

const submitted = { results: [{ game: 'fc3d', record: { ...record, saleAmount: 98279284 }, source: 'official:test', verified: true }] }
const synced = await synchronize({ DB: db }, date, submitted)
assert.equal(synced.results.find(item => item.game === 'fc3d').state, 'metadata-enriched')
assert.equal((await readLatestSnapshot(db, 'fc3d')).record.saleAmount, 98279284)
assert.equal((await readLatestSnapshot(db, 'fc3d')).source.metadataSource, 'official:test')
assert.equal((await synchronize({ DB: db }, new Date('2026-10-30T04:00:00.000Z'), submitted)).skipped, 'outside-draw-window')
assert.equal((await synchronize({ DB: db }, new Date('2026-10-30T04:00:00.000Z'), submitted, true)).results.find(item => item.game === 'fc3d').state, 'already-updated')

const bad = { results: [{ game: 'ssq', record: { issue: '2026124', drawDate: '2026-10-30', numbers: [1] }, verified: true }] }
assert.equal((await synchronize({ DB: db }, date, bad)).results.find(item => item.game === 'ssq').state, 'missing-or-invalid-submission')
assert.equal(await readLatestSnapshot(db, 'ssq'), null)

const delayedScheduleSubmission = { results: [{
  game: 'ssq',
  record: { issue: '2026124', drawDate: '2026-10-30', numbers: [1, 2, 3, 4, 5, 6, 7] },
  source: 'github-mirror:test', verified: false
}] }
const delayedSchedule = await synchronize(
  { DB: db }, new Date('2026-10-31T04:00:00.000Z'), delayedScheduleSubmission, false, true
)
assert.equal(delayedSchedule.results.find(item => item.game === 'ssq').state, 'waiting-for-confirmation')
assert.equal(await readLatestSnapshot(db, 'ssq'), null, 'unverified fallback must not become the current snapshot')
const repeatedOldIssueOnDrawDay = await synchronize(
  { DB: db }, new Date('2026-11-05T14:05:00.000Z'), delayedScheduleSubmission, false, true
)
assert.equal(repeatedOldIssueOnDrawDay.results.find(item => item.game === 'ssq').state, 'waiting-for-confirmation')
const repeatedOldIssueOnNonDrawDay = await synchronize(
  { DB: db }, new Date('2026-11-06T14:05:00.000Z'), delayedScheduleSubmission, false, true
)
assert.equal(repeatedOldIssueOnNonDrawDay.results.find(item => item.game === 'ssq').state, 'waiting-for-confirmation')
const alreadyCompletedEarlierToday = { results: [{
  game: 'ssq',
  record: { issue: '2026126', drawDate: '2026-11-05', numbers: [9, 10, 13, 22, 29, 32, 12] },
  source: 'official:test', verified: true
}] }
await saveLatestSnapshot(db, 'ssq', alreadyCompletedEarlierToday, new Date('2026-11-05T13:00:00.000Z'))
const arrivedAfterEarlySnapshot = { results: [{
  game: 'ssq',
  record: { issue: '2026127', drawDate: '2026-11-05', numbers: [13, 14, 19, 25, 29, 32, 12] },
  source: 'official:test', verified: true
}] }
const advancedAfterSameDayCompletion = await synchronize(
  { DB: db }, new Date('2026-11-05T14:05:00.000Z'), arrivedAfterEarlySnapshot, false, true
)
assert.equal(advancedAfterSameDayCompletion.results.find(item => item.game === 'ssq').state, 'updated-and-stopped')
assert.equal((await readLatestSnapshot(db, 'ssq')).issue, '2026127')
const delayedButVerifiedSnapshot = { ...base, records: [{ ...record, issue: '2026128', drawDate: '2026-11-05' }] }
await saveLatestSnapshot(db, 'ssq', delayedButVerifiedSnapshot, new Date('2026-11-06T05:00:00.000Z'))
assert.notEqual((await readLatestSnapshot(db, 'ssq')).completedOn, '2026-11-06')
const currentDateVerifiedSnapshot = { ...base, records: [{ ...record, issue: '2026129', drawDate: '2026-11-06' }] }
await saveLatestSnapshot(db, 'ssq', currentDateVerifiedSnapshot, new Date('2026-11-06T14:00:00.000Z'))
assert.equal((await readLatestSnapshot(db, 'ssq')).completedOn, '2026-11-06')

// Heal erroneous same-day completion markers across every lottery, not only 3D.
const allGamesSqlite = new DatabaseSync(':memory:')
allGamesSqlite.exec(readFileSync(new URL('../migrations/0005_lottery_latest.sql', import.meta.url), 'utf8'))
const allGamesDb = {
  prepare(sql) {
    return {
      bind(...values) {
        const statement = allGamesSqlite.prepare(sql)
        return {
          first: async () => statement.get(...values) || null,
          run: async () => ({ meta: { changes: statement.run(...values).changes } })
        }
      }
    }
  }
}
const gameIssues = {
  fc3d: '2026295', ssq: '2026126', dlt: '26126', pl3: '26295',
  pl5: '26295', qxc: '2026126', qlc: '2026126', kl8: '2026295'
}
const allStaleResults = Object.entries(gameIssues).map(([game, issue]) => ({
  game,
  record: {
    issue, drawDate: '2026-11-05',
    numbers: LOTTERY_SOURCES[game].ranges.map(([minimum]) => minimum)
  },
  source: 'official:test', verified: true
}))
for (const item of allStaleResults) {
  await saveLatestSnapshot(allGamesDb, item.game, { ...item, records: [item.record] }, new Date('2026-11-05T14:00:00.000Z'))
}
allGamesSqlite.prepare('UPDATE lottery_latest SET completed_on = ?').run('2026-11-06')
const allGamesStaleRetry = await synchronize(
  { DB: allGamesDb }, new Date('2026-11-06T14:05:00.000Z'), { results: allStaleResults }, false, true
)
assert.equal(allGamesStaleRetry.results.length, 8)
for (const game of Object.keys(gameIssues)) {
  const result = allGamesStaleRetry.results.find(item => item.game === game)
  assert.notEqual(result.state, 'already-updated', `${game} stale marker must not suppress retries`)
  assert.equal((await readLatestSnapshot(allGamesDb, game)).completedOn, '', `${game} stale marker is cleared`)
}

// The production Cron checks every five minutes within the draw window, but
// must stop all source requests once every current-day verified snapshot is complete.
allGamesSqlite.prepare('UPDATE lottery_latest SET completed_on = ?').run('2026-11-05')
const originalScheduledFetch = globalThis.fetch
let scheduledFetchCalls = 0
globalThis.fetch = async () => { scheduledFetchCalls += 1; throw new Error('completed draws must not fetch sources') }
try {
  const scheduledResult = await lotterySyncWorker.scheduled(
    { scheduledTime: Date.parse('2026-11-05T14:05:00.000Z') },
    { DB: allGamesDb },
    { waitUntil() {} }
  )
  assert.equal(scheduledResult.ok, true)
  assert.equal(scheduledResult.results.length, 8)
  assert.equal(scheduledFetchCalls, 0)
  const outsideWindow = await lotterySyncWorker.scheduled(
    { scheduledTime: Date.parse('2026-11-05T12:00:00.000Z') },
    { DB: allGamesDb },
    { waitUntil() {} }
  )
  assert.deepEqual(outsideWindow, { ok: true, skipped: 'outside-draw-window' })
  assert.equal(scheduledFetchCalls, 0)
} finally {
  globalThis.fetch = originalScheduledFetch
}

const pl3Record = { issue: '26293', drawDate: '2026-11-03', numbers: [8, 1, 1] }
assert.equal(await saveLatestSnapshot(db, 'pl3', { ...base, records: [pl3Record] }, date), true)
assert.equal(await enrichLatestSnapshot(db, 'pl3', {
  ...pl3Record, saleAmount: 42130000, poolApplicable: false,
  firstPrize: { level: '直选', amount: 1040 }
}, 'third-party:test', date), true)
const enrichedPl3 = await readLatestSnapshot(db, 'pl3')
assert.equal(enrichedPl3.record.saleAmount, 42130000)
assert.equal(enrichedPl3.record.poolApplicable, false)
assert.deepEqual(enrichedPl3.record.firstPrize, { level: '直选', amount: 1040 })

const ssqRecord = { issue: '2026130', drawDate: '2026-11-08', numbers: [13, 14, 19, 25, 29, 32, 12] }
assert.equal(await saveLatestSnapshot(db, 'ssq', { ...base, records: [ssqRecord] }, date), true)
assert.equal(await enrichLatestSnapshot(db, 'ssq', { ...ssqRecord,
  firstPrize: { level: '一等奖', count: 3, provinces: '天津1注、河北2注' }
}, 'test-supplement', date), true)
assert.deepEqual((await readLatestSnapshot(db, 'ssq')).record.firstPrize, {
  level: '一等奖', count: 3, provinces: '天津1注、河北2注'
})
const dltWinnerSync = await synchronize({ DB: db }, date, { results: [{
  game: 'dlt', record: { issue: '26130', drawDate: '2026-11-06', numbers: [1, 7, 12, 23, 35, 2, 11],
    firstPrize: { count: 2, provinces: '江苏1注、浙江1注' } }, source: 'test', verified: false
}] }, true)
assert.equal(dltWinnerSync.results.find(item => item.game === 'dlt').state, 'waiting-for-confirmation')
assert.equal(await readLatestSnapshot(db, 'dlt'), null, 'unverified result metadata must not seed a latest snapshot')

console.log('开奖同步：8 个彩种旧完成标记均清理并继续追新；官方期号、延迟标记、无效记录、时间窗和元数据回归通过')
