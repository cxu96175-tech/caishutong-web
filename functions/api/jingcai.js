const SUPPORTED_SPORTS = new Set(['football', 'basketball'])
const SOURCE_NAME = '竞彩公开赛事数据'
const SOURCE_PAGES = {
  football: 'https://www.dxvs.com/scores',
  basketball: 'https://www.dxvs.com/basketball'
}
const SP_PAGES = {
  football: 'https://www.dxvs.com/preview/football',
  basketball: 'https://www.dxvs.com/preview/basketball'
}
const CACHE_TTL_SECONDS = 90
const STALE_TTL_SECONDS = 60 * 60 * 24
const CACHE_BASE = 'https://caishutong.invalid/api/jingcai-cache-v2'
const JINGCAI_NO = /周[一二三四五六日]\d{3}/
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

const text = value => value == null ? '' : String(value).replace(/\s+/g, ' ').trim()

function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function safeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : ''
}

function decodeEntities(value) {
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    const key = entity.toLowerCase()
    if (key === 'amp') return '&'
    if (key === 'lt') return '<'
    if (key === 'gt') return '>'
    if (key === 'quot') return '"'
    if (key === 'apos') return "'"
    if (key === 'nbsp') return ' '
    const code = key.startsWith('#x') ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : ''
  })
}

function parseAttributes(tagSource) {
  const attrs = {}
  const body = tagSource.replace(/^<\/?[\w:-]+|\/?\s*>$/g, '')
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  for (const match of body.matchAll(pattern)) {
    const key = match[1].toLowerCase()
    attrs[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

function parsePublicHtml(html) {
  const source = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  const root = { tag: 'root', attrs: {}, children: [] }
  const stack = [root]
  const tokens = source.match(/<[^>]+>|[^<]+/g) || []

  for (const token of tokens) {
    if (token.startsWith('</')) {
      const tag = (token.match(/^<\/\s*([\w:-]+)/) || [])[1]?.toLowerCase()
      if (!tag) continue
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.length = index
          break
        }
      }
      continue
    }
    if (token.startsWith('<')) {
      const tag = (token.match(/^<\s*([\w:-]+)/) || [])[1]?.toLowerCase()
      if (!tag) continue
      const node = { tag, attrs: parseAttributes(token), children: [] }
      stack.at(-1).children.push(node)
      if (!VOID_TAGS.has(tag) && !token.endsWith('/>')) stack.push(node)
      continue
    }
    const value = decodeEntities(token)
    if (value) stack.at(-1).children.push({ tag: '#text', value, attrs: {}, children: [] })
  }
  return root
}

function descendants(node, predicate, output = []) {
  if (!node) return output
  if (predicate(node)) output.push(node)
  for (const child of node.children || []) descendants(child, predicate, output)
  return output
}

function hasClass(node, className) {
  return (node.attrs?.class || '').split(/\s+/).includes(className)
}

function byClass(node, className) {
  return descendants(node, candidate => hasClass(candidate, className))
}

function firstByClass(node, className) {
  return byClass(node, className)[0] || null
}

function firstWithClasses(node, ...classNames) {
  return descendants(node, candidate => classNames.every(className => hasClass(candidate, className)))[0] || null
}

function nodeText(node) {
  if (!node) return ''
  if (node.tag === '#text') return node.value
  return text((node.children || []).map(nodeText).join(' '))
}

function firstText(node, className) {
  return nodeText(firstByClass(node, className))
}

function firstTag(node, tagName) {
  return descendants(node, candidate => candidate.tag === tagName)[0] || null
}

function pageTitle(root) {
  return nodeText(firstTag(root, 'title'))
}

function scoreFromNode(node) {
  if (!node) return null
  const bold = node.tag === 'b' ? node : firstTag(node, 'b')
  const boldText = nodeText(bold)
  const scoreText = /^\d{1,3}$/.test(boldText) ? boldText : nodeText(firstTag(node, 'small') || node)
  const match = scoreText.match(/(?:^|\s)(\d{1,3})\s*[-:：]\s*(\d{1,3})(?:$|\s)/)
  if (match) return { home: match[1], away: match[2] }
  return /^\d{1,3}$/.test(boldText) ? { home: boldText, away: null } : null
}

function kickoffAtFrom(node, date) {
  if (!node) return ''
  const time = firstTag(node, 'time')
  const datetime = time?.attrs?.datetime || ''
  if (datetime) {
    const parsed = new Date(datetime)
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
  }

  const visible = nodeText(node)
  const fullDate = visible.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s*(\d{1,2}):(\d{2})/)
  const shortDate = visible.match(/(\d{1,2})[-/.](\d{1,2})\s+(\d{1,2}):(\d{2})/)
  const timeOnly = visible.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:$|\s)/)
  let parts
  if (fullDate) parts = [Number(fullDate[1]), Number(fullDate[2]), Number(fullDate[3]), Number(fullDate[4]), Number(fullDate[5])]
  else if (shortDate) parts = [Number(date.slice(0, 4)), Number(shortDate[1]), Number(shortDate[2]), Number(shortDate[3]), Number(shortDate[4])]
  else if (timeOnly) parts = [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)), Number(timeOnly[1]), Number(timeOnly[2])]
  else return ''

  const [year, month, day, hour, minute] = parts
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`
  const parsed = new Date(iso)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : ''
}

function statusFor(raw, className, score) {
  const value = `${raw || ''} ${className || ''}`.toLowerCase()
  if (/完场|已完|finished|ended|full.?time/.test(value)) return 'finished'
  if (/进行中|比赛中|直播|live|playing|running|quarter|q[1-4]/.test(value)) return 'live'
  if (/延期|推迟|postpon|delay/.test(value)) return 'delayed'
  if (/取消|中止|cancel|abandon/.test(value)) return 'cancelled'
  if (/未开|未开始|scheduled|not.?started/.test(value)) return 'scheduled'
  return score ? 'unknown' : 'unknown'
}

function matchNumber(value) {
  return value.match(JINGCAI_NO)?.[0] || ''
}

function teamText(row, side) {
  const teamNode = firstWithClasses(row, 'instant-team', side)
  const link = firstTag(teamNode, 'a')
  return text(link?.attrs?.title || nodeText(teamNode)).replace(/\[\d+\]/g, '')
}

function parseFootball(root, sport, date, updatedAt) {
  if (!pageTitle(root).includes('足球')) throw new Error('足球赛事页标题校验失败')
  const rows = descendants(root, node => node.tag === 'tr' && hasClass(node, 'instant-match-row'))
  const matches = []
  for (const row of rows) {
    const matchNo = matchNumber(firstText(row, 'instant-number'))
    if (!matchNo) continue
    const league = firstText(row, 'instant-league')
    const kickoffNode = firstByClass(row, 'instant-kickoff')
    const kickoffAt = kickoffAtFrom(kickoffNode, date)
    const statusNode = firstByClass(row, 'instant-state')
    const resultNode = firstByClass(row, 'instant-result')
    let score = scoreFromNode(resultNode)
    const className = `${row.attrs.class || ''} ${statusNode?.attrs.class || ''}`
    const status = statusFor(nodeText(statusNode), className, score)
    if (status === 'scheduled') score = null
    const id = (row.attrs.id || '').match(/instant-match-(\d+)/)?.[1] || matchNo
    const homeTeam = teamText(row, 'home')
    const awayTeam = teamText(row, 'away')
    if (!homeTeam || !awayTeam || !kickoffAt) continue
    matches.push({ sport, matchId: id, matchNo, league, homeTeam, awayTeam, kickoffAt, status, homeScore: score?.home ?? null, awayScore: score?.away ?? null, updatedAt })
  }
  if (rows.length && !matches.length) throw new Error('竞彩足球页面结构暂不兼容')
  return matches
}

function spValueFromCell(cell, matchNo, outcomes) {
  const button = firstTag(cell, 'button')
  const label = text(button?.attrs?.['aria-label'])
  if (!button || !label.includes(matchNo)) return null
  const outcome = outcomes.find(value => label.includes(value))
  const value = label.match(/(?:^|\s)(\d{1,3}(?:\.\d{1,3})?)(?:\s|$)/)?.[1]
  return outcome && value ? { outcome, value } : null
}

export function parseOfficialSp(html, sport) {
  const root = parsePublicHtml(html)
  const pageText = nodeText(root)
  if (!pageText.includes('竞彩官方 SP 数据')) throw new Error('赛程页未明确标注竞彩官方 SP 数据')
  const output = new Map()

  if (sport === 'football') {
    const rows = descendants(root, node => node.tag === 'tr' && hasClass(node, 'football-preview-start') && hasClass(node, 'football-preview-row'))
    for (const row of rows) {
      const matchNo = matchNumber(nodeText(row))
      if (!matchNo) continue
      const cells = descendants(row, node => node.tag === 'td' && hasClass(node, 'football-preview-sp'))
      const fields = cells.map(cell => spValueFromCell(cell, matchNo, ['主胜', '平', '客胜'])).filter(Boolean)
      const values = Object.fromEntries(fields.map(field => [field.outcome, field.value]))
      if (values['主胜'] && values['平'] && values['客胜']) {
        output.set(matchNo, { market: '胜平负', homeWin: values['主胜'], draw: values['平'], awayWin: values['客胜'] })
      }
    }
    if (!rows.length) throw new Error('竞彩足球 SP 表格结构暂不兼容')
    return output
  }

  const rows = descendants(root, node => node.tag === 'tr' && hasClass(node, 'basketball-mixed-row'))
  for (const row of rows) {
    const matchNo = matchNumber(nodeText(row))
    if (!matchNo) continue
    const cells = (row.children || []).filter(node => node.tag === 'td')
    const awayWin = spValueFromCell(cells[5], matchNo, ['客胜'])
    const homeWin = spValueFromCell(cells[6], matchNo, ['主胜'])
    if (awayWin && homeWin) output.set(matchNo, { market: '胜负', awayWin: awayWin.value, homeWin: homeWin.value })
  }
  if (!rows.length) throw new Error('竞彩篮球 SP 表格结构暂不兼容')
  return output
}

function basketballTeam(row, side) {
  const teamRow = firstByClass(row, `basketball-${side}`)
  const team = firstByClass(teamRow, 'basketball-team')
  const titled = descendants(team || row, node => node.attrs?.title)[0]
  return text(titled?.attrs.title || nodeText(team)).replace(/\[\d+\]/g, '')
}

function basketballScore(row, side) {
  const teamRow = firstByClass(row, `basketball-${side}`)
  const value = firstText(teamRow, 'basketball-total')
  return /^\d{1,3}$/.test(value) ? value : null
}

function parseBasketball(root, sport, date, updatedAt) {
  if (!pageTitle(root).includes('竞彩篮球')) throw new Error('篮球赛事页标题校验失败')
  const groups = descendants(root, node => node.tag === 'tbody' && hasClass(node, 'basketball-game'))
  const matches = []
  for (const group of groups) {
    const heading = firstByClass(group, 'basketball-game-heading')
    const headingText = nodeText(heading)
    const matchNo = matchNumber(headingText)
    if (!matchNo) continue
    const kickoffAt = kickoffAtFrom(heading, date)
    const teamRows = descendants(group, node => node.tag === 'tr' && (hasClass(node, 'basketball-away') || hasClass(node, 'basketball-home')))
    const statusNode = firstByClass(group, 'basketball-status')
    const className = teamRows.map(row => row.attrs.class || '').join(' ')
    const awayScore = basketballScore(group, 'away')
    const homeScore = basketballScore(group, 'home')
    let score = awayScore != null && homeScore != null ? { home: homeScore, away: awayScore } : null
    const status = statusFor(nodeText(statusNode), `${className} ${statusNode?.attrs.class || ''}`, score)
    if (status === 'scheduled') score = null

    const awayTeam = basketballTeam(group, 'away')
    const homeTeam = basketballTeam(group, 'home')
    const leagueNode = firstByClass(heading, 'basketball-league')
    const afterNumber = headingText.slice(headingText.indexOf(matchNo) + matchNo.length)
    const dateOffset = afterNumber.search(/\d{1,2}[/-]\d{1,2}/)
    const league = text(leagueNode ? nodeText(leagueNode) : (dateOffset >= 0 ? afterNumber.slice(0, dateOffset) : ''))
    const input = firstTag(heading, 'input')
    const id = input?.attrs?.value || matchNo
    if (!homeTeam || !awayTeam || !kickoffAt) continue
    matches.push({ sport, matchId: id, matchNo, league, homeTeam, awayTeam, kickoffAt, status, homeScore: score?.home ?? null, awayScore: score?.away ?? null, updatedAt })
  }
  if (groups.length && !matches.length) throw new Error('竞彩篮球页面结构暂不兼容')
  return matches
}

export function normalizeMatches(html, sport, date, updatedAt = new Date().toISOString()) {
  const root = parsePublicHtml(html)
  const matches = sport === 'football'
    ? parseFootball(root, sport, date, updatedAt)
    : parseBasketball(root, sport, date, updatedAt)
  return matches.sort((left, right) => left.kickoffAt.localeCompare(right.kickoffAt) || left.matchNo.localeCompare(right.matchNo, 'zh-CN'))
}

async function fetchPublicPage(url) {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'CaiyantongMatchInfo/1.0 (+https://888888c.xyz)' },
    signal: AbortSignal.timeout(12000)
  })
  if (!response.ok) throw new Error(`赛事来源 HTTP ${response.status}`)
  const type = response.headers.get('content-type') || ''
  if (!type.includes('text/html')) throw new Error('赛事来源未返回 HTML 页面')
  const html = await response.text()
  if (html.length > 2_000_000) throw new Error('赛事页面响应超出安全大小')
  return html
}

async function fetchScorePage(sport) {
  return fetchPublicPage(SOURCE_PAGES[sport])
}

async function fetchOfficialSpPage(sport) {
  return fetchPublicPage(SP_PAGES[sport])
}

function cacheRequest(sport, date, stale = false) {
  return new Request(`${CACHE_BASE}?sport=${sport}&date=${date}${stale ? '&stale=1' : ''}`)
}

async function readCache(cache, request) {
  if (!cache) return null
  try {
    const response = await cache.match(request)
    return response ? await response.json() : null
  } catch { return null }
}

async function writeCache(cache, request, payload, ttl) {
  if (!cache) return
  try {
    await cache.put(request, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } }))
  } catch {}
}

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url)
  const sport = incoming.searchParams.get('sport') || 'football'
  const date = safeDate(incoming.searchParams.get('date') || '') || shanghaiDate()
  if (!SUPPORTED_SPORTS.has(sport)) return Response.json({ ok: false, error: '不支持的赛事类型' }, { status: 400 })
  if (date !== shanghaiDate()) return Response.json({ ok: false, sport, date, error: '当前公开数据源仅提供当日竞彩赛事，请选择今天' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const cache = globalThis.caches?.default
  const freshKey = cacheRequest(sport, date)
  const staleKey = cacheRequest(sport, date, true)
  const cached = await readCache(cache, freshKey)
  if (cached?.matches) return Response.json(cached, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } })

  const stale = await readCache(cache, staleKey)
  try {
    const updatedAt = new Date().toISOString()
    const [scoreResult, spResult] = await Promise.allSettled([fetchScorePage(sport), fetchOfficialSpPage(sport)])
    if (scoreResult.status === 'rejected') throw scoreResult.reason
    let matches = normalizeMatches(scoreResult.value, sport, date, updatedAt)
    let spByMatch = new Map()
    let spError = ''
    if (spResult.status === 'fulfilled') {
      try { spByMatch = parseOfficialSp(spResult.value, sport) }
      catch { spError = '官方 SP 暂时无法获取，赛程和赛果仍可查看' }
    } else spError = '官方 SP 暂时无法获取，赛程和赛果仍可查看'
    if (!spError && matches.some(match => !spByMatch.has(match.matchNo))) spError = '部分比赛的官方 SP 暂缺，赛程和赛果仍可查看'
    matches = matches.map(match => ({ ...match, ...(spByMatch.has(match.matchNo) ? { officialSp: spByMatch.get(match.matchNo) } : {}) }))
    const payload = { ok: true, sport, date, matches, updatedAt, source: SOURCE_NAME, stale: false, partial: Boolean(spError), error: spError }
    await writeCache(cache, freshKey, payload, CACHE_TTL_SECONDS)
    await writeCache(cache, staleKey, payload, STALE_TTL_SECONDS)
    return Response.json(payload, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    if (stale?.matches) return Response.json({ ...stale, stale: true, error: '数据来源暂时不可用，当前显示缓存数据' }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    return Response.json({ ok: false, sport, date, error: '竞彩信息暂时无法获取，请稍后重试', detail: error instanceof Error ? error.message : String(error) }, { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  }
}
