export const d1ErrorMessage = (error,fallback) => /free tier daily row read limit/i.test(String(error?.message || error))
  ? 'D1 今日读取额度已用尽，统计将在北京时间 08:00 后恢复'
  : fallback
