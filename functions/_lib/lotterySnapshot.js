export function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function inDrawWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).split(':').map(Number)
  const minuteOfDay = parts[0] * 60 + parts[1]
  return minuteOfDay >= 20 * 60 + 45 && minuteOfDay <= 23 * 60 + 30
}

export function isCurrentDraw(record, date = new Date()) {
  return String(record?.drawDate || '').slice(0, 10) === shanghaiDate(date)
}

export function sameDrawIssue(game, left, right) {
  const canonical = issue => ['dlt', 'pl3', 'pl5', 'qxc'].includes(game)
    ? String(issue).slice(-5) : String(issue)
  return canonical(left) === canonical(right)
}

export async function readLatestSnapshot(db, game) {
  const row = await db.prepare('SELECT issue, record_json, source_json, checked_at, completed_on FROM lottery_latest WHERE game = ?').bind(game).first()
  if (!row) return null
  return {
    issue: row.issue,
    record: JSON.parse(row.record_json),
    source: JSON.parse(row.source_json),
    checkedAt: row.checked_at,
    completedOn: row.completed_on || ''
  }
}

export async function saveLatestSnapshot(db, game, result, date = new Date()) {
  const record = result?.records?.[0]
  if (!record || !/^\d{4,8}$/.test(String(record.issue || '')) || !Array.isArray(record.numbers) || !record.numbers.length) return false
  const previous = await db.prepare('SELECT issue, checked_at, source_json FROM lottery_latest WHERE game = ?').bind(game).first()
  // Mark the snapshot completed on the day it is verified, even when the
  // collector catches up a draw published on the previous calendar day.
  const completedOn = result.verified && isCurrentDraw(record, date) ? shanghaiDate(date) : ''
  const source = {
    source: result.source,
    sourceName: result.sourceName,
    sourceType: result.sourceType,
    sourceUrl: result.sourceUrl,
    fallback: Boolean(result.fallback),
    verified: Boolean(result.verified),
    fallbackReason: result.fallbackReason || null,
    officialError: result.officialError || null,
    metadataSource: result.metadataSource || null
  }
  const response = await db.prepare(`INSERT INTO lottery_latest (game, issue, record_json, source_json, checked_at, completed_on)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(game) DO UPDATE SET
      issue = excluded.issue,
      record_json = excluded.record_json,
      source_json = excluded.source_json,
      checked_at = excluded.checked_at,
      completed_on = CASE WHEN excluded.completed_on != '' THEN excluded.completed_on ELSE lottery_latest.completed_on END
    WHERE CAST(excluded.issue AS INTEGER) > CAST(lottery_latest.issue AS INTEGER)
       OR (excluded.issue = lottery_latest.issue AND json_extract(excluded.source_json, '$.verified') = 1
           AND json_extract(lottery_latest.source_json, '$.verified') != 1)`).bind(
    game, String(record.issue), JSON.stringify(record), JSON.stringify(source), result.checkedAt || date.toISOString(), completedOn
  ).run()
  return Boolean(response?.meta?.changes)
}

export async function enrichLatestSnapshot(db, game, incoming, metadataSource, date = new Date()) {
  const current = await readLatestSnapshot(db, game)
  if (!current || !sameDrawIssue(game, current.issue, incoming?.issue)) return false
  const left = current.record.numbers
  const right = incoming.numbers
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length
    || left.some((value, index) => Number(value) !== Number(right[index]))) return false
  const record = { ...current.record }
  let changed = false
  // Correct a legacy regional FC3D sales value only from the national
  // Welfare Lottery API, and only after issue and winning digits match above.
  const authoritativeNationalFc3d = game === 'fc3d' && metadataSource === 'official:www.cwl.gov.cn'
  for (const key of ['saleAmount', 'poolAmount']) {
    const mayCorrectRegionalFc3dSales = key === 'saleAmount' && authoritativeNationalFc3d
      && Number.isFinite(record[key]) && Number.isFinite(incoming[key]) && incoming[key] !== record[key]
    if ((record[key] == null || mayCorrectRegionalFc3dSales)
      && Number.isFinite(incoming[key]) && incoming[key] >= 0 && incoming[key] <= 1e12) {
      record[key] = incoming[key]
      changed = true
    }
  }
  if (authoritativeNationalFc3d && record.poolApplicable !== false) {
    record.poolApplicable = false
    changed = true
  }
  if (record.poolApplicable === undefined && typeof incoming.poolApplicable === 'boolean') {
    record.poolApplicable = incoming.poolApplicable
    changed = true
  }
  if (record.firstPrize?.amount == null && Number.isFinite(incoming.firstPrize?.amount)
    && incoming.firstPrize.amount >= 0 && incoming.firstPrize.amount <= 1e10) {
    record.firstPrize = { level: incoming.firstPrize.level || '一等奖', amount: incoming.firstPrize.amount }
    changed = true
  }
  if (!changed) return false
  const source = { ...current.source, metadataSource: metadataSource || 'runner-supplement', metadataCheckedAt: date.toISOString() }
  const result = await db.prepare('UPDATE lottery_latest SET record_json = ?, source_json = ? WHERE game = ? AND issue = ?')
    .bind(JSON.stringify(record), JSON.stringify(source), game, String(current.issue)).run()
  return Boolean(result?.meta?.changes)
}
