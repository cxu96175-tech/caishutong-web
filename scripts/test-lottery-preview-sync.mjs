import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { enrichLatestSnapshot, readLatestSnapshot, saveLatestSnapshot } from '../functions/_lib/lotterySnapshot.js'
import { synchronize } from '../worker-lottery-sync/index.js'

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

console.log('Preview 同步：同号补金额、号码冲突拒绝、时间窗、手动检查与无效记录检查通过')
