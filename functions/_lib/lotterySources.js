const PROXY_ENDPOINT = 'https://lottery-official-data.cxu96175.workers.dev/lottery'
const KJH_ENDPOINT = 'https://www.00038.cn/kjh'
const KJH_BASE = 'https://www.00038.cn'
const KJH_PATHS = Object.freeze({ fc3d: '3d', ssq: 'ssq', dlt: 'dlt', pl3: 'p3', pl5: 'p5', qxc: 'qxc', qlc: 'qlc', kl8: 'kl8' })
const KJH_NAMES = Object.freeze({
  fc3d: '福彩3D', ssq: '双色球', dlt: '大乐透', pl3: '排列3', pl5: '排列5',
  qxc: '7星彩', qlc: '七乐彩', kl8: '快乐8'
})
const HUINIAO_TYPES = Object.freeze({ fc3d: 'fcsd', ssq: 'ssq', dlt: 'dlt', pl3: 'pls', pl5: 'plw' })
const WELFARE_ENDPOINT = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
const SPORTS_HISTORY_ENDPOINT = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
const SPORTS_DIGITAL_ENDPOINT = 'https://webapi.sporttery.cn/gateway/lottery/getDigitalDrawInfoV1.qry'
const NUMBER_FIELDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

export const LOTTERY_SOURCES = Object.freeze({
  fc3d: { name: '福彩3D', upstreamGame: 'fcsd', expected: 3, ranges: [[0, 9], [0, 9], [0, 9]], poolApplicable: false, provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: '3d' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  ssq: { name: '双色球', upstreamGame: 'ssq', expected: 7, ranges: [[1, 33], [1, 33], [1, 33], [1, 33], [1, 33], [1, 33], [1, 16]], provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: 'ssq' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  qlc: { name: '七乐彩', upstreamGame: 'qlc', expected: 8, ranges: [[1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30]], provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: 'qlc' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  kl8: { name: '快乐8', upstreamGame: 'klb', expected: 20, ranges: Array.from({ length: 20 }, () => [1, 80]), poolApplicable: false, provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: 'kl8' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  dlt: { name: '大乐透', upstreamGame: 'dlt', expected: 7, ranges: [[1, 35], [1, 35], [1, 35], [1, 35], [1, 35], [1, 12], [1, 12]], provider: 'sports', official: { endpoint: SPORTS_HISTORY_ENDPOINT, query: { gameNo: '85', provinceId: '0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' } },
  pl3: { name: '排列3', upstreamGame: 'pls', expected: 3, ranges: [[0, 9], [0, 9], [0, 9]], poolApplicable: false, provider: 'sports', official: { endpoint: SPORTS_HISTORY_ENDPOINT, query: { gameNo: '35', provinceId: '0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' } },
  pl5: { name: '排列5', upstreamGame: 'plw', expected: 5, ranges: [[0, 9], [0, 9], [0, 9], [0, 9], [0, 9]], poolApplicable: false, provider: 'sports', official: { endpoint: SPORTS_HISTORY_ENDPOINT, query: { gameNo: '37', provinceId: '0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' } },
  qxc: { name: '7星彩', upstreamGame: 'qxc', expected: 7, ranges: [[0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 14]], provider: 'sports', official: { endpoint: SPORTS_DIGITAL_ENDPOINT, query: { param: '04,0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' } }
})

const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const isObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value))

function firstValue(row, keys) {
  if (!isObject(row)) return ''
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && ((Array.isArray(value) && value.length) || text(value))) return value
  }
  return ''
}

function numericValue(value) {
  const normalized = text(value).replace(/[\s,，￥¥]/g, '')
  if (!normalized || normalized === '--' || normalized === '-') return undefined
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const number = Number(match[0])
  return Number.isFinite(number) ? number : undefined
}

function prizeLevel(value) {
  const normalized = text(value)
  if (!normalized) return ''
  const numeric = Number(normalized)
  const chineseLevels = ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖', '十等奖']
  if (Number.isInteger(numeric) && numeric >= 1 && numeric < chineseLevels.length) return chineseLevels[numeric]
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 20) return `第${numeric}级`
  return normalized.replace(/^第?\s*(一等奖|二等奖|三等奖|四等奖|五等奖|六等奖|七等奖|八等奖|九等奖|十等奖)\s*$/, '$1')
}

function prizeRowsFrom(row) {
  const list = firstValue(row, ['prizeRows', 'prizegrades', 'prizeGradeList', 'prizeLevelList', 'prizelevels'])
  if (!Array.isArray(list)) return []
  return list.map(entry => {
    const level = prizeLevel(firstValue(entry, ['level', 'prizeLevel', 'prizeLevelName', 'name', 'type']))
    const amount = numericValue(firstValue(entry, ['amount', 'singlePrizeAmount', 'typemoney', 'prizeAmount', 'prizeMoney', 'money']))
    const count = numericValue(firstValue(entry, ['count', 'totalPrizeCount', 'typenum', 'prizeCount', 'number']))
    return { ...(level ? { level } : {}), ...(amount !== undefined ? { amount } : {}), ...(count !== undefined ? { count } : {}) }
  }).filter(entry => entry.level || entry.amount !== undefined || entry.count !== undefined)
}

function metadataFromRow(row, game) {
  const config = LOTTERY_SOURCES[game]
  const saleAmount = numericValue(firstValue(row, ['saleAmount', 'sales', 'lotterySaleAmount', 'lotterySales', 'sale']))
  const poolRaw = firstValue(row, ['poolAmount', 'poolmoney', 'lotteryPoolAmount', 'pool', 'jackpot'])
  const poolAmount = numericValue(poolRaw)
  const prizeRows = prizeRowsFrom(row)
  const firstPrize = prizeRows.find(entry => entry.level === '一等奖' || entry.level === '第1级')
  return {
    ...(saleAmount !== undefined ? { saleAmount } : {}),
    ...(poolAmount !== undefined ? { poolAmount } : {}),
    ...(config?.poolApplicable !== undefined ? { poolApplicable: config.poolApplicable } : poolRaw ? { poolApplicable: true } : {}),
    ...(prizeRows.length ? { prizeRows } : {}),
    ...(firstPrize ? { firstPrize } : {})
  }
}

function issueValue(row) {
  return firstValue(row, ['issue', 'code', 'drawNo', 'lotteryDrawNum', 'drawIssue', 'period', 'issueno', 'issueNum', '期号'])
}

function normalizeIssue(value) {
  const match = text(value).match(/(?:第\s*)?(\d{2,})\s*(?:期)?/)
  return match?.[1] || ''
}

function canonicalIssue(value, game) {
  const issue = normalizeIssue(value)
  // 体彩公告及部分归档源用 26102，公开页面可能写成 2026102；
  // 统一为体彩接口使用的 5 位期号，避免历史合并产生重复行。
  return (game === 'dlt' || game === 'qxc') && /^20\d{5}$/.test(issue) ? issue.slice(2) : issue
}

function drawDate(row) {
  const value = firstValue(row, ['drawDate', 'draw_date', 'date', 'openDate', 'openTime', 'lotteryDrawTime', 'lotteryDrawDate', 'opendate'])
  return value ? text(value).replace('T', ' ').slice(0, 19) : undefined
}

function numbersFromValue(value, expected) {
  if (Array.isArray(value)) return value.flatMap(item => numbersFromValue(item, expected))
  const tokens = text(value).match(/\d+/g) || []
  if (tokens.length === 1 && expected > 1 && tokens[0].length === expected) return [...tokens[0]].map(Number)
  return tokens.map(Number)
}

function recordNumbers(row, game) {
  const source = LOTTERY_SOURCES[game]
  const result = firstValue(row, ['lotteryDrawResult', 'drawResult', 'result', 'openCode', 'number', 'numbers', '开奖号码'])
  if (game === 'ssq' || game === 'qlc' || game === 'kl8') {
    const red = numbersFromValue(firstValue(row, ['red', 'redBall', 'redBalls', 'redNum', 'redNumber', 'red_num', 'front', 'frontArea', 'frontAreaNum']), source.expected)
    const blue = numbersFromValue(firstValue(row, ['blue', 'blueBall', 'blueBalls', 'blueNum', 'blueNumber', 'blue_num', 'special', 'specialBall', 'specialNum', 'back', 'backArea', 'backAreaNum']), source.expected)
    if (red.length + blue.length === source.expected) return [...red, ...blue]
  }
  if (game === 'dlt') {
    const front = numbersFromValue(firstValue(row, ['front', 'frontArea', 'red', 'redBall', 'redBalls', 'frontAreaNum', 'frontWinningNum']), source.expected)
    const back = numbersFromValue(firstValue(row, ['back', 'backArea', 'blue', 'blueBall', 'blueBalls', 'backAreaNum', 'backWinningNum']), source.expected)
    if (front.length === 5 && back.length === 2) return [...front, ...back]
  }
  return numbersFromValue(result, source.expected)
}

function looksLikeDraw(row) {
  if (!isObject(row)) return false
  return Boolean(issueValue(row) && firstValue(row, ['lotteryDrawResult', 'drawResult', 'result', 'openCode', 'number', 'numbers', '开奖号码', 'red', 'redBall', 'redBalls', 'front', 'frontArea', 'frontWinningNum']))
}

function collectRows(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return []
  if (isObject(value) && looksLikeDraw(value)) return [value]
  if (Array.isArray(value)) {
    if (value.every(looksLikeDraw)) return value
    return value.flatMap(item => collectRows(item, depth + 1))
  }
  if (!isObject(value)) return []
  for (const key of ['list', 'records', 'rows', 'result', 'data', 'value', 'items', 'drawList', 'drawListVO']) {
    const rows = collectRows(value[key], depth + 1)
    if (rows.length) return rows
  }
  return Object.values(value).flatMap(item => collectRows(item, depth + 1))
}

function validateRecord(record, game) {
  const source = LOTTERY_SOURCES[game]
  if (!source || !record.issue || !Array.isArray(record.numbers) || record.numbers.length !== source.expected) return false
  if (record.numbers.some((value, index) => !Number.isInteger(value) || value < source.ranges[index][0] || value > source.ranges[index][1])) return false
  if (['ssq', 'qlc', 'kl8', 'dlt'].includes(game)) {
    const split = game === 'dlt' ? [record.numbers.slice(0, 5), record.numbers.slice(5)] : game === 'ssq' ? [record.numbers.slice(0, 6)] : [record.numbers]
    if (split.some(values => new Set(values).size !== values.length)) return false
  }
  return true
}

function parseOfficialRows(payload, game) {
  const rows = collectRows(payload)
  const records = []
  for (const row of rows) {
    const issue = canonicalIssue(issueValue(row), game)
    const numbers = recordNumbers(row, game)
    const record = { issue, numbers, ...metadataFromRow(row, game), ...(drawDate(row) ? { drawDate: drawDate(row) } : {}) }
    if (validateRecord(record, game)) records.push(record)
  }
  return records
}

function sortUnique(records) {
  const unique = new Map()
  for (const record of records) if (!unique.has(record.issue)) unique.set(record.issue, record)
  return [...unique.values()].sort((left, right) => Number(right.issue) - Number(left.issue))
}

function normalizeExternalRecord(record, game) {
  const source = LOTTERY_SOURCES[game]
  if (!record || typeof record !== 'object') return null
  const issue = canonicalIssue(record.issue ?? record.drawIssue ?? record.lotteryDrawNum, game)
  const packed = record.numbers ?? record.result ?? record.openCode ?? record.lotteryDrawResult
  const fieldValues = packed ? packed : Object.keys(record)
    .filter(key => /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)$/.test(key))
    .sort((left, right) => NUMBER_FIELDS.indexOf(left) - NUMBER_FIELDS.indexOf(right))
    .map(key => record[key])
  const numbers = numbersFromValue(fieldValues, source.expected)
  return issue && numbers.length ? { issue, numbers, ...metadataFromRow(record, game), ...(record.drawDate ? { drawDate: String(record.drawDate).slice(0, 19) } : {}) } : null
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function moneyTextValue(value) {
  const normalized = stripHtml(value).replace(/[\s,，￥¥]/g, '')
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(亿元|万元|元)?/)
  if (!match) return undefined
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return undefined
  if (match[2] === '亿元') return amount * 1e8
  if (match[2] === '万元') return amount * 1e4
  return amount
}

function parseKjhDetail(html, game) {
  const plain = stripHtml(html)
  const saleMatch = plain.match(/本期销量\s*[:：]\s*([0-9]+(?:\s*\.\s*[0-9]+)?\s*(?:亿元|万元|元)?)/)
  const poolMatch = plain.match(/(?:奖池累计|奖池金额|奖池滚存|奖池)\s*[:：]\s*([0-9]+(?:\s*\.\s*[0-9]+)?\s*(?:亿元|万元|元)?)/)
  const rows = (String(html || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || []).map(row => (row.match(/<td\b[\s\S]*?<\/td>/gi) || []).map(stripHtml)).filter(cells => cells.length >= 3)
  const prizeRows = rows.filter(cells => /一等奖|二等奖|三等奖|四等奖|五等奖|六等奖|七等奖|八等奖|直选|组选/.test(cells[0] || '')).map(cells => {
    const level = String(cells[0] || '').replace(/\s+/g, '')
    const amount = moneyTextValue(cells[1])
    const count = numericValue(cells[2])
    return { ...(level ? { level } : {}), ...(amount !== undefined ? { amount } : {}), ...(count !== undefined ? { count } : {}) }
  }).filter(entry => entry.level || entry.amount !== undefined || entry.count !== undefined)
  const firstPrize = prizeRows.find(entry => entry.level === '一等奖')
  return {
    ...(saleMatch ? { saleAmount: moneyTextValue(saleMatch[1]) } : {}),
    ...(poolMatch ? { poolAmount: moneyTextValue(poolMatch[1]), poolApplicable: true } : {}),
    ...(prizeRows.length ? { prizeRows } : {}),
    ...(firstPrize ? { firstPrize } : {})
  }
}

function parseKjhLatest(html, game) {
  const name = KJH_NAMES[game]
  const rows = String(html || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || []
  const row = rows.find(item => new RegExp(`>${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`).test(item))
  if (!row) throw new Error(`00038未找到${name}开奖行`)
  const cells = row.match(/<td\b[\s\S]*?<\/td>/gi) || []
  const periodIndex = cells.findIndex(cell => /class=["']period["']/.test(cell))
  const issue = stripHtml(periodIndex >= 0 ? cells[periodIndex] : '').match(/(\d{2,8})\s*期/)?.[1] || ''
  const dateText = stripHtml(periodIndex >= 0 ? cells[periodIndex + 1] : '').match(/(\d{2})-(\d{2})/)
  const year = new Date().getFullYear()
  const numbers = [...row.matchAll(/<em\s+class=["'](?:Redball|Blueball|Yellowball)["'][^>]*>\s*(\d{1,2})\s*<\/em>/gi)].map(match => Number(match[1]))
  const detailPath = [...String(html || '').matchAll(new RegExp(`href=["']([^"']*\\/kjh\\/${KJH_PATHS[game]}\\/([0-9]+)\\.htm)["']`, 'gi'))]
    .find(match => canonicalIssue(match[2], game) === canonicalIssue(issue, game))?.[1]
    || `/kjh/${KJH_PATHS[game]}/${['dlt', 'qxc'].includes(game) && /^\d{5}$/.test(issue) ? `20${issue}` : issue}.htm`
  const record = { issue: canonicalIssue(issue, game), numbers, ...(detailPath ? { detailPath } : {}), ...(dateText ? { drawDate: `${year}-${dateText[1]}-${dateText[2]}` } : {}) }
  if (!validateRecord(record, game)) throw new Error(`00038未识别${name}有效奖号`)
  return record
}

async function fetchKjhLatest(game) {
  const response = await fetchText(KJH_ENDPOINT, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; LotteryNotice/1.0)' }
  }, 7000)
  const record = parseKjhLatest(response, game)
  if (!record.detailPath) return { ...record, ...metadataFromRow(record, game) }
  try {
    const detail = await fetchText(`${KJH_BASE}${record.detailPath}`, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; LotteryNotice/1.0)' }
    }, 7000)
    const metadata = parseKjhDetail(detail, game)
    return { ...record, ...metadataFromRow({ ...record, ...metadata }, game), ...metadata }
  } catch {
    return { ...record, ...metadataFromRow(record, game) }
  }
}

async function fetchHuiniao(game, limit) {
  const type = HUINIAO_TYPES[game]
  if (!type) return []
  const url = new URL('https://api.huiniao.top/interface/home/lotteryHistory')
  url.searchParams.set('type', type)
  url.searchParams.set('page', '1')
  url.searchParams.set('limit', String(Math.max(1, limit)))
  const payload = await fetchJson(url, { headers: { Accept: 'application/json', 'User-Agent': 'LotteryNotice/1.0' } }, 7000)
  if (Number(payload?.code) !== 1) return []
  const list = Array.isArray(payload?.data?.data?.list) ? payload.data.data.list : []
  const last = payload?.data?.last ? [payload.data.last] : []
  return sortUnique([...list, ...last].map(item => normalizeExternalRecord(item, game)).filter(record => record && validateRecord(record, game)))
}

function buildOfficialUrl(game, pageSize) {
  const config = LOTTERY_SOURCES[game]
  const source = config?.official
  if (!source) throw new Error(`未配置官方源：${game}`)
  const url = new URL(source.endpoint)
  for (const [key, value] of Object.entries(source.query)) url.searchParams.set(key, value)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('pageSize', String(Math.min(120, Math.max(1, pageSize))))
  if (config.provider === 'welfare') url.searchParams.set('systemType', 'PC')
  return url
}

async function fetchJson(url, options = {}, timeout = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const raw = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    try { return JSON.parse(raw) } catch { throw new Error('返回非 JSON') }
  } finally { clearTimeout(timer) }
}

async function fetchText(url, options = {}, timeout = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally { clearTimeout(timer) }
}

export async function fetchOfficial(game, limit) {
  const url = buildOfficialUrl(game, limit)
  const payload = await fetchJson(url, { headers: { Accept: 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9', 'Cache-Control': 'no-cache', Referer: LOTTERY_SOURCES[game].official.site, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36' } })
  const records = sortUnique(parseOfficialRows(payload, game)).slice(0, limit)
  if (!records.length) throw new Error('官方接口没有返回有效开奖记录')
  return { records, source: `official:${new URL(url).hostname}`, sourceName: `${LOTTERY_SOURCES[game].official.authority}官方接口`, sourceUrl: String(url), sourceType: 'official', fallback: false, verified: true }
}

export async function fetchProxy(game, limit) {
  const source = LOTTERY_SOURCES[game]
  const errors = []
  try {
    const latest = await fetchKjhLatest(game)
    const history = await fetchHuiniao(game, limit).catch(error => { errors.push(error instanceof Error ? error.message : String(error)); return [] })
    const records = sortUnique([latest, ...history]).slice(0, limit)
    return { records, source: `third-party:${new URL(KJH_ENDPOINT).hostname}`, sourceName: '彩宝网公开开奖页（回退源）', sourceUrl: KJH_ENDPOINT, sourceType: 'third-party', fallback: true, verified: false, fallbackReason: errors.join('；') }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
  const url = new URL(PROXY_ENDPOINT)
  url.searchParams.set('game', source.upstreamGame)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('v', '18')
  url.searchParams.set('fresh', String(Math.floor(Date.now() / 60000)))
  const payload = await fetchJson(url, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } })
  const records = sortUnique(Array.isArray(payload.records) ? payload.records.map(record => normalizeExternalRecord(record, game)).filter(record => record && validateRecord(record, game)) : [])
  if (!records.length) throw new Error(`${errors.join('；')}；代理接口没有返回有效开奖记录`)
  return { records: records.slice(0, limit), source: `proxy:${new URL(url).hostname}`, sourceName: '彩研通实时代理源', sourceUrl: String(url), sourceType: 'proxy', fallback: true, verified: false, fallbackReason: errors.join('；') }
}

export async function fetchRealtimeRecords(game, limit = 120) {
  if (!LOTTERY_SOURCES[game]) throw new Error(`不支持的彩种：${game}`)
  let officialError = ''
  try {
    return { ...(await fetchOfficial(game, limit)), checkedAt: new Date().toISOString(), stale: false }
  } catch (error) {
    officialError = error instanceof Error ? error.message : String(error)
  }
  try {
    return { ...(await fetchProxy(game, limit)), checkedAt: new Date().toISOString(), stale: false, officialError }
  } catch (error) {
    const proxyError = error instanceof Error ? error.message : String(error)
    throw new Error(`${game} 官方源和代理源均不可用：${officialError || '官方源失败'}；${proxyError}`)
  }
}

export function sourceSummary(source) {
  return { type: source?.sourceType || 'unknown', name: source?.sourceName || '未知数据源', url: source?.sourceUrl || '', fallback: Boolean(source?.fallback), verified: Boolean(source?.verified), stale: Boolean(source?.stale), checkedAt: source?.checkedAt || null, officialError: source?.officialError || null, fallbackReason: source?.fallbackReason || null }
}
