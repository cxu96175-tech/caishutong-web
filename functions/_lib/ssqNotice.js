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
