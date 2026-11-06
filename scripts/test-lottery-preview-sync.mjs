import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { enrichLatestSnapshot, readLatestSnapshot, saveLatestSnapshot } from '../functions/_lib/lotterySnapshot.js'
import { mergeMissingDrawMetadata } from '../functions/_lib/lotterySources.js'
import { parseOfficialSsqNoticeHtml } from '../functions/_lib/ssqNotice.js'
import { isExpectedGithubSubject, synchronize } from '../worker-lottery-sync/index.js'

assert.equal(isExpectedGithubSubject('repo:cxu96175-tech/caishutong-web:ref:refs/heads/main'), true)
assert.equal(isExpectedGithubSubject('repo:cxu96175-tech@310116318/caishutong-web@1324034095:ref:refs/heads/main'), true)
assert.equal(isExpectedGithubSubject('repo:another-account/caishutong-web:ref:refs/heads/main'), false)
assert.equal(isExpectedGithubSubject('repo:cxu96175-tech@310116318/other-repo@1324034095:ref:refs/heads/main'), false)
assert.deepEqual(parseOfficialSsqNoticeHtml('<table><tr><td>2026127</td><td>2026-11-05(四)</td><td><span>13</span>14 19 25 29 32</td><td>12</td></tr></table>'), {
  issue: '2026127', drawDate: '2026-11-05', numbers: [13, 14, 19, 25, 29, 32, 12]
})
assert.equal(parseOfficialSsqNoticeHtml('<tr><td>2026127</td><td>2026-11-05</td><td>131419252932</td><td>99</td></tr>'), null)

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
assert.equal(await saveLatestSnapshot(db, 'fc3d', base, date), true)
assert.equal(await enrichLatestSnapshot(db, 'fc3d', { ...record, numbers: [6, 1, 3], saleAmount: 100 }, 'wrong', date), false)
assert.equal((await readLatestSnapshot(db, 'fc3d')).record.saleAmount, undefined)

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
assert.equal((await readLatestSnapshot(db, 'ssq')).issue, '2026124')
const repeatedOldIssueOnDrawDay = await synchronize(
  { DB: db }, new Date('2026-11-05T14:05:00.000Z'), delayedScheduleSubmission, false, true
)
assert.equal(repeatedOldIssueOnDrawDay.results.find(item => item.game === 'ssq').state, 'upstream-not-advanced')
const repeatedOldIssueOnNonDrawDay = await synchronize(
  { DB: db }, new Date('2026-11-06T14:05:00.000Z'), delayedScheduleSubmission, false, true
)
assert.equal(repeatedOldIssueOnNonDrawDay.results.find(item => item.game === 'ssq').state, 'no-new-draw')
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
assert.equal((await readLatestSnapshot(db, 'ssq')).completedOn, '2026-11-06')

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

console.log('开奖同步：官方期号前进、延迟到达完成标记、无效记录拒绝、时间窗、元数据合并与排列3字段通过')
