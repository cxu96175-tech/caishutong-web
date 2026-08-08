import React from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function Candlestick({ x, y, width, height, payload }) {
  const { open, close, high, low } = payload
  const scaleY = value => high === low ? y + height / 2 : y + ((high - value) / (high - low)) * height
  const center = x + width / 2
  const openY = scaleY(open), closeY = scaleY(close)
  const rising = close >= open
  const color = rising ? '#ff4d5e' : '#28a66f'
  return <g><line x1={center} x2={center} y1={y} y2={y + height} stroke={color} strokeWidth="1.3"/><rect x={x + width * .2} y={Math.min(openY,closeY)} width={width * .6} height={Math.max(2,Math.abs(closeY-openY))} rx="1.5" fill={rising ? color : '#fff'} stroke={color} strokeWidth="1.3"/></g>
}

function KlineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return <div className="kline-tooltip"><b>第 {row.issue} 期</b><span>开奖号：{row.numbers}</span><span>开 {row.open}　高 {row.high}</span><span>低 {row.low}　收 {row.close}</span></div>
}

export default function KlineChart({ data, movingAverages, colors }) {
  return <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top:16, right:18, bottom:8, left:0 }}><CartesianGrid stroke="#eceef2" strokeDasharray="3 3"/><XAxis dataKey="issue" tick={{ fontSize:10, fill:'#8c9098' }} minTickGap={16}/><YAxis tick={{ fontSize:10, fill:'#8c9098' }} width={42} domain={['auto','auto']}/><Tooltip content={<KlineTooltip/>}/><Bar dataKey="range" shape={<Candlestick/>} isAnimationActive={false}/>{movingAverages.ma5 && <Line dataKey="ma5" type="monotone" stroke={colors.ma5} dot={false} strokeWidth={1.6} connectNulls/>}{movingAverages.ma10 && <Line dataKey="ma10" type="monotone" stroke={colors.ma10} dot={false} strokeWidth={1.6} connectNulls/>}{movingAverages.ma20 && <Line dataKey="ma20" type="monotone" stroke={colors.ma20} dot={false} strokeWidth={1.6} connectNulls/>}</ComposedChart></ResponsiveContainer>
}
