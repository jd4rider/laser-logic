let ctx = null
export const audioState = { muted: false }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { type = 'sine', dur = 0.18, gain = 0.12, delay = 0 } = {}) {
  if (audioState.muted || !Number.isFinite(freq)) return
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise({ dur = 0.4, gain = 0.2, freq = 600, delay = 0 } = {}) {
  if (audioState.muted) return
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(freq * 4, t)
  filter.frequency.exponentialRampToValueAtTime(freq, t + dur)
  const amp = a.createGain()
  amp.gain.value = gain
  src.connect(filter).connect(amp).connect(a.destination)
  src.start(t)
}

export const sfx = {
  whoosh: () => noise({ dur: 0.5, gain: 0.07, freq: 1200 }),
  coin: () => [12, 19].forEach((s, i) => tone(660 * 2 ** (s / 12), { dur: 0.15, gain: 0.07, delay: i * 0.08 })),
  click: () => tone(640, { type: 'triangle', dur: 0.07, gain: 0.07 }),
  zap: (n = 0) => tone(880 * 2 ** (n / 12), { type: 'sawtooth', dur: 0.12, gain: 0.03 }),
  pick: () => tone(520, { type: 'triangle', dur: 0.08, gain: 0.07 }),
  drop: () => tone(330, { type: 'triangle', dur: 0.08, gain: 0.06 }),
  light: (n = 0) => [0, 7, 12].forEach((s, i) => tone(523 * 2 ** ((s + n * 2) / 12), { dur: 0.2, gain: 0.05, delay: i * 0.05 })),
  locked: () => tone(120, { type: 'square', dur: 0.1, gain: 0.04 }),
  tick: () => tone(880, { type: 'square', dur: 0.04, gain: 0.03 }),
  hint: () => tone(700, { type: 'triangle', dur: 0.12, gain: 0.06 }),
  win: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(523.25 * 2 ** (s / 12), { dur: 0.4, delay: i * 0.1 })),
  lose: () => [7, 3, 0, -5].forEach((s, i) => tone(392 * 2 ** (s / 12), { type: 'triangle', dur: 0.4, delay: i * 0.16 })),
}
