import { ensureVerificationSchema,json,normalizeEmail,requestKey,validEmail,verificationHash } from '../../../_lib/emailAuth.js'

export async function onRequestPost({ request,env }) {
  if (!env.DB || !env.RESEND_API_KEY || !env.SESSION_SECRET || !env.EMAIL_FROM) return json({ error:'邮件服务尚未配置' },503)
  try {
    let body
    try { body = await request.json() } catch { return json({ error:'请求格式不正确' },400) }
    const email = normalizeEmail(body?.email)
    if (!validEmail(email)) return json({ error:'请输入正确的邮箱地址' },400)
    await ensureVerificationSchema(env.DB)
    const key = await requestKey(request,email,env.SESSION_SECRET)
    const latest = await env.DB.prepare("SELECT created_at FROM email_verification_codes WHERE email=? ORDER BY id DESC LIMIT 1").bind(email).first()
    if (latest && Date.now() - Date.parse(`${latest.created_at}Z`) < 60000) return json({ error:'发送过于频繁，请稍后再试' },429)
    const recent = await env.DB.prepare("SELECT COUNT(*) count FROM email_verification_codes WHERE request_key=? AND created_at >= datetime('now','-15 minutes')").bind(key).first()
    if (Number(recent?.count || 0) >= 5) return json({ error:'请求次数过多，请15分钟后再试' },429)
    const bytes = new Uint32Array(1)
    crypto.getRandomValues(bytes)
    const code = String(100000 + bytes[0] % 900000)
    const expiresAt = Date.now() + 10 * 60 * 1000
    const codeHash = await verificationHash(email,code,env.SESSION_SECRET)
    let response
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(),8000)
    try {
      response = await fetch('https://api.resend.com/emails',{ method:'POST',headers:{ Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json' },body:JSON.stringify({ from:env.EMAIL_FROM,to:[email],subject:'彩研通邮箱验证码',html:`<div style="font-family:Arial,'PingFang SC',sans-serif;color:#25262b"><h2>彩研通邮箱验证</h2><p>你的验证码是：</p><p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#3155ff">${code}</p><p>验证码10分钟内有效，请勿转发给他人。</p><p style="color:#8c919a;font-size:12px">如果不是你本人操作，请忽略此邮件。</p></div>` }),signal:controller.signal })
    } catch (error) {
      console.error('Resend request failed',error instanceof Error ? error.message : String(error))
      return json({ error:'邮件服务暂时不可用，请稍后重试' },502)
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('Resend send failed',response.status,detail.slice(0,300))
      const providerError = response.status === 401
        ? '邮件服务凭证无效，请联系管理员'
        : response.status === 403 || response.status === 422
          ? (response.status === 403 ? '邮件服务权限不足或发件域名未验证，请联系管理员' : '发件邮箱地址或域名未通过验证，请联系管理员')
          : response.status === 429
            ? '邮件额度或发送频率已达到限制，请稍后再试'
            : '验证码发送失败，请稍后重试'
      return json({ error:providerError },502)
    }
    try {
      await env.DB.prepare('INSERT INTO email_verification_codes (email,code_hash,request_key,expires_at) VALUES (?,?,?,?)').bind(email,codeHash,key,expiresAt).run()
      await env.DB.prepare("DELETE FROM email_verification_codes WHERE created_at < datetime('now','-1 day')").run()
    } catch (error) {
      console.error('Verification code persistence failed',error instanceof Error ? error.message : String(error))
      return json({ error:'验证码服务暂时不可用，请稍后重试' },503)
    }
    return json({ ok:true,expiresIn:600 })
  } catch (error) {
    console.error('Email verification send failed',error instanceof Error ? error.message : String(error))
    return json({ error:'验证码服务暂时不可用，请稍后重试' },500)
  }
}
