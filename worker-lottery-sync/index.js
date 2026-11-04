import { fetchRealtimeRecords, LOTTERY_SOURCES } from '../functions/_lib/lotterySources.js'
import { enrichLatestSnapshot, inDrawWindow, readLatestSnapshot, sameDrawIssue, saveLatestSnapshot, shanghaiDate } from '../functions/_lib/lotterySnapshot.js'

const GAMES = ['fc3d', 'ssq', 'dlt', 'pl3', 'pl5', 'qxc', 'qlc', 'kl8']
const EXPECTED_AUDIENCE = 'caiyan-lottery-sync-preview'
const EXPECTED_REPOSITORY = 'cxu96175-tech/caishutong-web'
const EXPECTED_REF = 'refs/heads/main'
const EXPECTED_WORKFLOW = `${EXPECTED_REPOSITORY}/.github/workflows/lottery-preview-sync.yml@${EXPECTED_REF}`
const EXPECTED_SUBJECTS = [
  `repo:${EXPECTED_REPOSITORY}:ref:${EXPECTED_REF}`,
  'repo:cxu96175-tech@310116318/caishutong-web@1324034095:ref:refs/heads/main'
]
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com'

export function isExpectedGithubSubject(subject) {
  return EXPECTED_SUBJECTS.includes(subject)
}

let cachedJwks
let cachedJwksUntil = 0

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)))
}

async function getGithubJwks(forceRefresh = false) {
  if (!forceRefresh && cachedJwks && Date.now() < cachedJwksUntil) return cachedJwks
  const response = await fetch(`${OIDC_ISSUER}/.well-known/jwks`)
  if (!response.ok) throw new Error(`GitHub OIDC key request failed: ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data.keys)) throw new Error('GitHub OIDC key set is invalid')
  cachedJwks = data.keys
  cachedJwksUntil = Date.now() + 60 * 60 * 1000
  return cachedJwks
}

async function verifyGithubOidc(request) {
  const authorization = request.headers.get('Authorization') || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return false

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [encodedHeader, encodedClaims, encodedSignature] = parts
    const header = decodeJsonPart(encodedHeader)
    const claims = decodeJsonPart(encodedClaims)
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false

    let jwk = (await getGithubJwks()).find(key => key.kid === header.kid)
    if (!jwk) jwk = (await getGithubJwks(true)).find(key => key.kid === header.kid)
    if (!jwk) return false

    const publicKey = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const signatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`)
    )
    if (!signatureValid) return false

    const now = Math.floor(Date.now() / 1000)
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    const valid = claims.iss === OIDC_ISSUER
      && audiences.includes(EXPECTED_AUDIENCE)
      && claims.repository === EXPECTED_REPOSITORY
      && claims.ref === EXPECTED_REF
      && isExpectedGithubSubject(claims.sub)
      && claims.workflow_ref === EXPECTED_WORKFLOW
      && ['schedule', 'workflow_dispatch'].includes(claims.event_name)
      && Number.isFinite(claims.exp)
      && Number.isFinite(claims.nbf)
      && now <= claims.exp + 60
      && now + 60 >= claims.nbf
    return valid ? claims.event_name : false
  } catch (error) {
    console.warn('GitHub OIDC verification unavailable', error instanceof Error ? error.message : String(error))
    throw error
  }
}

function validateSubmittedResult(item) {
  const config = LOTTERY_SOURCES[item?.game]
  const record = item?.record
  if (!config || !record || !/^\d{4,8}$/.test(String(record.issue || ''))
    || !/^\d{4}-\d{2}-\d{2}/.test(String(record.drawDate || ''))
    || !Array.isArray(record.numbers) || record.numbers.length !== config.expected) return null
  if (record.numbers.some((value, index) => !Number.isInteger(value)
    || value < config.ranges[index][0] || value > config.ranges[index][1])) return null
  const safe = { issue: String(record.issue), drawDate: String(record.drawDate).slice(0, 10), numbers: record.numbers }
  for (const key of ['saleAmount', 'poolAmount']) {
    if (Number.isFinite(record[key]) && record[key] >= 0 && record[key] <= 1e12) safe[key] = record[key]
  }
  if (Number.isFinite(record.firstPrize?.amount) && record.firstPrize.amount >= 0 && record.firstPrize.amount <= 1e10) {
    safe.firstPrize = { level: '一等奖', amount: record.firstPrize.amount }
  }
  return {
    records: [safe], verified: item.verified === true,
    source: String(item.source || 'runner').slice(0, 120),
    sourceName: String(item.sourceName || 'GitHub runner').slice(0, 120),
    sourceType: item.verified === true ? 'official' : 'third-party',
    sourceUrl: String(item.sourceUrl || '').slice(0, 300),
    metadataSource: String(item.metadataSource || '').slice(0, 120)
  }
}

export async function synchronize(env, checkedAt = new Date(), submitted = null, manuallyTriggered = false) {
  if (!manuallyTriggered && !inDrawWindow(checkedAt)) return { ok: true, skipped: 'outside-draw-window' }
  if (!env?.DB) throw new Error('Preview D1 binding is unavailable')

  const today = shanghaiDate(checkedAt)
  const supplied = new Map(Array.isArray(submitted?.results)
    ? submitted.results.filter(item => GAMES.includes(item?.game)).map(item => [item.game, validateSubmittedResult(item)]) : [])
  const results = await Promise.allSettled(GAMES.map(async game => {
    const previous = await readLatestSnapshot(env.DB, game)
    const upstream = submitted ? supplied.get(game) : await fetchRealtimeRecords(game, 1)
    if (!upstream) return { game, state: submitted ? 'missing-or-invalid-submission' : 'empty' }
    const latest = upstream.records?.[0]
    if (previous && latest && sameDrawIssue(game, previous.issue, latest.issue)) {
      const enriched = await enrichLatestSnapshot(env.DB, game, latest, upstream.metadataSource || upstream.source, checkedAt)
      if (previous.completedOn === today) return { game, state: enriched ? 'metadata-enriched' : 'already-updated' }
    }
    if (previous?.completedOn === today) return { game, state: 'already-updated' }

    if (!latest) return { game, state: 'empty' }

    const currentDatedDraw = String(latest.drawDate || '').slice(0, 10) === today
    await saveLatestSnapshot(env.DB, game, upstream, checkedAt)

    const confirmed = Boolean(upstream.verified && currentDatedDraw)
    return { game, state: confirmed ? 'updated-and-stopped' : 'waiting-for-confirmation', issue: latest.issue }
  }))

  return {
    ok: true,
    checkedAt: checkedAt.toISOString(),
    results: results.map(result => result.status === 'fulfilled'
      ? result.value
      : { state: 'error', error: result.reason instanceof Error ? result.reason.message : String(result.reason) })
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ ok: true, service: 'lottery-sync', scheduler: 'github-actions-preview' })
    }
    if (url.pathname === '/sync') {
      if (request.method !== 'POST') return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
      let authorized
      try {
        authorized = await verifyGithubOidc(request)
      } catch {
        return Response.json({ error: 'Authentication service unavailable' }, { status: 503 })
      }
      if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      try {
        const raw = await request.text()
        if (raw.length > 32768) return Response.json({ error: 'Payload too large' }, { status: 413 })
        const submitted = raw ? JSON.parse(raw) : null
        return Response.json(await synchronize(env, new Date(), submitted, authorized === 'workflow_dispatch'))
      } catch (error) {
        console.error('lottery-sync run failed', error instanceof Error ? error.message : String(error))
        return Response.json({ error: 'Lottery synchronization failed' }, { status: 500 })
      }
    }
    return Response.json({ error: 'Not Found' }, { status: 404 })
  },

}
