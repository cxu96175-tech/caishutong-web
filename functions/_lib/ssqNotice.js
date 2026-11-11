const cleanCell = value => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export function parseOfficialSsqNoticeHtml(html) {
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  for (const [, row] of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cleanCell(cell))
    const issue = cells[0]?.match(/(20\d{5})/)?.[1]
    const drawDate = cells[1]?.match(/(20\d{2}-\d{2}-\d{2})/)?.[1]
    const packed = cells[2]?.replace(/\D/g, '')
    const blue = cells[3]?.match(/\d{1,2}/)?.[0]
    if (!issue || !drawDate || packed?.length !== 12 || !blue) continue
    const numbers = Array.from({ length: 6 }, (_, index) => Number(packed.slice(index * 2, index * 2 + 2))).concat(Number(blue))
    if (numbers.slice(0, 6).some(number => number < 1 || number > 33)
      || new Set(numbers.slice(0, 6)).size !== 6 || numbers[6] < 1 || numbers[6] > 16) continue
    return { issue, drawDate, numbers }
  }
  return null
}

export function parseOfficialFc3dNoticeHtml(html) {
  const records = []
  for (const [, row] of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cell)
    const issue = cleanCell(cells[0] || '').match(/(20\d{5})/)?.[1]
    const drawDate = cleanCell(cells[1] || '').match(/(20\d{2}-\d{2}-\d{2})/)?.[1]
    const numbers = [...(cells[2] || '').matchAll(/<i\b[^>]*>([\s\S]*?)<\/i>/gi)].map(([, value]) => Number(cleanCell(value)))
    if (issue && drawDate && numbers.length === 3 && numbers.every(number => Number.isInteger(number) && number >= 0 && number <= 9)) {
      records.push({ issue, drawDate, numbers })
    }
  }
  return records.sort((left, right) => Number(right.issue) - Number(left.issue))
}

const welfareTableConfig = Object.freeze({
  ssq: { count: 7, ranges: [...Array.from({ length: 6 }, () => [1, 33]), [1, 16]], saleIndex: 4, firstPrizeCountIndex: 5, firstPrizeAmountIndex: 6, poolIndex: 7 },
  qlc: { count: 8, ranges: [...Array.from({ length: 8 }, () => [1, 30])], saleIndex: 4, firstPrizeCountIndex: 5, firstPrizeAmountIndex: 6, poolIndex: 11 },
  kl8: { count: 20, ranges: Array.from({ length: 20 }, () => [1, 80]), saleIndex: 3 }
})

const parseMoney = value => {
  const number = Number(String(value || '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(number) ? number : undefined
}

export function parseOfficialWelfareNoticeHtml(html, game) {
  const config = welfareTableConfig[game]
  if (!config) return []
  const records = []
  for (const [, row] of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cell)
    const issue = cleanCell(cells[0] || '').match(/(20\d{5})/)?.[1]
    const drawDate = cleanCell(cells[1] || '').match(/(20\d{2}-\d{2}-\d{2})/)?.[1]
    if (!issue || !drawDate) continue
    const ballCells = cells.slice(2, game === 'qlc' ? 4 : game === 'ssq' ? 4 : 3)
    const numbers = ballCells.flatMap(cell => [...cell.matchAll(/<i\b[^>]*>([\s\S]*?)<\/i>/gi)].map(([, value]) => Number(cleanCell(value))))
    if (numbers.length !== config.count || numbers.some((number, index) => !Number.isInteger(number)
      || number < config.ranges[index][0] || number > config.ranges[index][1])) continue
    if (game !== 'fc3d' && new Set(numbers).size !== numbers.length) continue
    const saleAmount = parseMoney(cleanCell(cells[config.saleIndex] || ''))
    const poolAmount = config.poolIndex === undefined ? undefined : parseMoney(cleanCell(cells[config.poolIndex] || ''))
    const firstPrizeCount = config.firstPrizeCountIndex === undefined ? undefined : parseMoney(cleanCell(cells[config.firstPrizeCountIndex] || ''))
    const firstPrizeAmount = config.firstPrizeAmountIndex === undefined ? undefined : parseMoney(cleanCell(cells[config.firstPrizeAmountIndex] || ''))
    records.push({
      issue, drawDate, numbers,
      ...(saleAmount !== undefined ? { saleAmount } : {}),
      poolApplicable: config.poolIndex !== undefined,
      ...(poolAmount !== undefined ? { poolAmount } : {}),
      ...(firstPrizeCount !== undefined || firstPrizeAmount !== undefined ? {
        firstPrize: { level: '一等奖', ...(firstPrizeCount !== undefined ? { count: firstPrizeCount } : {}), ...(firstPrizeAmount !== undefined ? { amount: firstPrizeAmount } : {}) }
      } : {})
    })
  }
  return records.sort((left, right) => Number(right.issue) - Number(left.issue))
}
