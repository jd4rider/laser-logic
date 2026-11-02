// Pure Laser Logic rules: no Phaser here so everything can be unit tested.
//
// The board is an n x n grid stored flat (index = row * n + col). A beam carries a colour mask
// (R=1, G=2, B=4, so white=7). Directions: 0 up, 1 right, 2 down, 3 left.
// Cells: null | wall | emit {dir,mask} | recv {mask} | mirror {o,id} | split {o,id}
//        | filter {mask} | prism.  o is 0 for "/" and 1 for "\". Movable pieces have mov:true.
export const R = 1
export const G = 2
export const B = 4
export const WHITE = 7
export const DX = [0, 1, 0, -1]
export const DY = [-1, 0, 1, 0]
const MIRROR = [[1, 0, 3, 2], [3, 2, 1, 0]]

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const reflect = (o, d) => MIRROR[o][d]
export const isPiece = (c) => !!c && (c.t === 'mirror' || c.t === 'split')

export function cloneState(s) {
  return { n: s.n, cells: s.cells.map((c) => (c ? { ...c } : null)) }
}

// Follows every beam. Returns the drawn segments, the colour that reached each receiver and the
// set of cells a beam touched.
export function trace({ n, cells }) {
  const segs = []
  const lit = {}
  const hit = new Set()
  const seen = new Set()
  const queue = []
  cells.forEach((c, i) => c?.t === 'emit' && queue.push({ i, d: c.dir, m: c.mask }))
  while (queue.length) {
    const { i, d, m } = queue.pop()
    const key = (i * 4 + d) * 8 + m
    if (seen.has(key)) continue
    seen.add(key)
    const x = (i % n) + DX[d]
    const y = Math.floor(i / n) + DY[d]
    if (x < 0 || y < 0 || x >= n || y >= n) {
      segs.push({ a: i, b: -1, d, m })
      continue
    }
    const j = y * n + x
    segs.push({ a: i, b: j, d, m })
    hit.add(j)
    const c = cells[j]
    if (!c) queue.push({ i: j, d, m })
    else if (c.t === 'recv') lit[j] = (lit[j] || 0) | m
    else if (c.t === 'mirror') queue.push({ i: j, d: reflect(c.o, d), m })
    else if (c.t === 'split') queue.push({ i: j, d, m }, { i: j, d: reflect(c.o, d), m })
    else if (c.t === 'filter') {
      if (m & c.mask) queue.push({ i: j, d, m: m & c.mask })
    } else if (c.t === 'prism') {
      if (m & R) queue.push({ i: j, d: (d + 3) % 4, m: R })
      if (m & G) queue.push({ i: j, d, m: G })
      if (m & B) queue.push({ i: j, d: (d + 1) % 4, m: B })
    }
  }
  return { segs, lit, hit }
}

export function receivers(s) {
  const out = []
  s.cells.forEach((c, i) => c?.t === 'recv' && out.push(i))
  return out
}

export function isSolved(s, t = trace(s)) {
  const rs = receivers(s)
  return rs.length > 0 && rs.every((i) => (t.lit[i] || 0) === s.cells[i].mask)
}

export const rotate = (s, i) => {
  s.cells[i].o ^= 1
}

export function canMove(s, from, to) {
  return s.cells[from]?.mov === true && s.cells[to] === null
}

export function move(s, from, to) {
  s.cells[to] = s.cells[from]
  s.cells[from] = null
}

export const findPiece = (s, id) => s.cells.findIndex((c) => isPiece(c) && c.id === id)

// The first thing that differs from the stored solution, as a hint.
export function hintFor(s, solution) {
  const ids = Object.keys(solution)
  for (const id of ids) {
    const at = findPiece(s, +id)
    if (at !== solution[id].i) {
      // Only hint a move into a cell that is currently free; otherwise hint the blocker's move later.
      if (s.cells[solution[id].i] === null) return { kind: 'move', from: at, to: solution[id].i }
    }
  }
  for (const id of ids) {
    const at = findPiece(s, +id)
    if (at === solution[id].i && s.cells[at].o !== solution[id].o) return { kind: 'rotate', at }
  }
  for (const id of ids) {
    const at = findPiece(s, +id)
    if (at !== solution[id].i) {
      const spot = s.cells.findIndex((c) => c === null)
      return { kind: 'move', from: at, to: spot }
    }
  }
  return null
}

export function applySolution(s, solution) {
  const ids = Object.keys(solution)
  const pieces = ids.map((id) => s.cells[findPiece(s, +id)])
  ids.forEach((id) => {
    s.cells[findPiece(s, +id)] = null
  })
  ids.forEach((id, k) => {
    pieces[k].o = solution[id].o
    s.cells[solution[id].i] = pieces[k]
  })
}

// ---------- generation ----------
// Build a working layout first, then scramble the mirrors, so every puzzle is solvable and the
// stored solution is the layout we started from.

export function generate(spec) {
  for (let attempt = 0; attempt < 800; attempt++) {
    const rnd = mulberry32(spec.seed * 131 + attempt * 7919)
    const p = build(spec, rnd, attempt)
    if (p) return p
  }
  throw new Error(`no layout for seed ${spec.seed}`)
}

function build(spec, rnd, attempt) {
  const n = spec.n
  const cells = Array(n * n).fill(null)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const free = () => cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
  const border = []
  for (let i = 1; i < n - 1; i++) {
    border.push({ i, dir: 2 }, { i: (n - 1) * n + i, dir: 0 }, { i: i * n, dir: 1 }, { i: i * n + n - 1, dir: 3 })
  }
  for (let e = 0; e < spec.emitters; e++) {
    const b = pick(border.filter((x) => !cells[x.i]))
    cells[b.i] = { t: 'emit', dir: b.dir, mask: e === 0 && spec.whiteFirst ? WHITE : pick(spec.colors) }
  }
  for (let w = 0; w < spec.walls; w++) {
    const spots = free().filter((i) => i % n > 0 && Math.floor(i / n) > 0 && i % n < n - 1 && Math.floor(i / n) < n - 1)
    if (spots.length) cells[pick(spots)] = { t: 'wall' }
  }

  let id = 0
  const queue = []
  for (let k = 0; k < spec.mirrors; k++) queue.push('mirror')
  for (let k = 0; k < spec.splits; k++) queue.push('split')
  for (let k = 0; k < spec.filters; k++) queue.push('filter')
  for (let k = 0; k < spec.prisms; k++) queue.push('prism')
  queue.sort(() => rnd() - 0.5)
  // Place pieces on lit cells so every one of them ends up doing something.
  for (const t of queue) {
    let spots = [...trace({ n, cells }).hit].filter((i) => !cells[i])
    if (!spots.length) spots = free()
    const i = pick(spots)
    if (t === 'filter') cells[i] = { t, mask: pick([R, G, B, R | G, R | B, G | B]) }
    else if (t === 'prism') cells[i] = { t }
    else cells[i] = { t, o: rnd() < 0.5 ? 0 : 1, id: id++ }
  }

  // Receivers go where beams would otherwise leave the board or hit a wall.
  const t0 = trace({ n, cells })
  const ends = []
  for (const s of t0.segs) {
    if (!cells[s.a] && !ends.includes(s.a) && (s.b === -1 || cells[s.b]?.t === 'wall')) ends.push(s.a)
  }
  if (ends.length < Math.min(spec.recvs, 2)) return null
  ends.sort(() => rnd() - 0.5)
  for (const i of ends.slice(0, spec.recvs)) cells[i] = { t: 'recv', mask: 0 }
  const t1 = trace({ n, cells })
  const rs = receivers({ cells })
  if (rs.some((i) => !t1.lit[i])) return null
  rs.forEach((i) => (cells[i].mask = t1.lit[i]))
  const strict = attempt < 500
  if (strict && cells.some((c, i) => c && ['mirror', 'split', 'filter', 'prism'].includes(c.t) && !t1.hit.has(i))) return null

  const solution = {}
  cells.forEach((c, i) => isPiece(c) && (solution[c.id] = { i, o: c.o }))
  const ids = Object.keys(solution)
  const movable = [...ids].sort(() => rnd() - 0.5).slice(0, spec.movable)
  const start = { n, cells: cells.map((c) => (c ? { ...c } : null)) }
  movable.forEach((m) => (start.cells[solution[m].i].mov = true))
  for (let tries = 0; tries < 40; tries++) {
    const s = cloneState(start)
    for (const key of ids) {
      const at = findPiece(s, +key)
      if (rnd() < 0.7) s.cells[at].o ^= 1
      if (s.cells[at].mov && rnd() < 0.85) {
        const empties = s.cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
        move(s, at, pick(empties))
      }
    }
    if (isSolved(s)) continue
    let par = 0
    for (const key of ids) {
      const at = findPiece(s, +key)
      if (at !== solution[key].i) par++
      if (s.cells[at].o !== solution[key].o) par++
    }
    if (par < Math.min(2, ids.length)) continue
    return { n, cells: s.cells, solution, par, spec }
  }
  return null
}

export const freshState = (p) => ({ n: p.n, cells: p.cells.map((c) => (c ? { ...c } : null)) })

export function starsFor(moves, par) {
  if (moves <= par + 1) return 3
  if (moves <= Math.ceil(par * 1.6) + 3) return 2
  return 1
}

// ---------- levels ----------

export const LEVELS_PER_WORLD = 12
export const TOTAL_LEVELS = 60
export const WORLDS = [
  { name: 'Mirror Lab', color: 0x0ea5e9, bg: ['#0c2a4a', '#030a16'], blurb: 'Tap mirrors to flip them and light every target.' },
  { name: 'Colour Filters', color: 0x10b981, bg: ['#0b3b2e', '#02120d'], blurb: 'Filters only let their own colour through. Targets want an exact colour.' },
  { name: 'Splitter Works', color: 0xf59e0b, bg: ['#4a2c0a', '#140a02'], blurb: 'Splitters send a beam two ways at once.' },
  { name: 'Prism Hall', color: 0xd946ef, bg: ['#3b0f4a', '#0f0314'], blurb: 'Prisms break white light into red, green and blue.' },
  { name: 'Grand Optics', color: 0xf43f5e, bg: ['#4a0f1f', '#14030a'], blurb: 'Some mirrors can be picked up and moved. Everything is in play.' },
]

const SINGLE = [R, G, B, WHITE]
const MIXED = [R, G, B, R | G, G | B, R | B, WHITE]

export function levelSpec(n) {
  const w = Math.floor((n - 1) / LEVELS_PER_WORLD)
  const k = (n - 1) % LEVELS_PER_WORLD
  return {
    n: Math.min(8, 5 + Math.floor(k / 4) + (w >= 2 ? 1 : 0)),
    mirrors: 2 + Math.floor(k / 2) + (w >= 3 ? 1 : 0),
    splits: w >= 2 ? 1 + Math.floor(k / 4) + (w >= 4 ? 1 : 0) : 0,
    filters: w >= 1 ? 1 + Math.floor(k / 5) : 0,
    prisms: w >= 3 ? 1 + (k >= 6 ? 1 : 0) : 0,
    movable: w >= 4 ? 1 + Math.floor(k / 4) : 0,
    emitters: 1 + Math.floor(k / 4) + (w <= 1 ? 1 : 0),
    recvs: 2 + Math.floor(k / 4),
    walls: w >= 1 ? 1 + Math.floor(k / 4) : Math.floor(k / 4),
    colors: w === 0 ? SINGLE : MIXED,
    whiteFirst: w >= 3,
    seed: n * 7 + 3,
  }
}

const cache = new Map()
export function levelPuzzle(n) {
  if (!cache.has(n)) cache.set(n, generate(levelSpec(n)))
  return cache.get(n)
}

export function tagsOf(spec) {
  return [spec.filters ? '🎨' : '', spec.splits ? '◧' : '', spec.prisms ? '🔺' : '', spec.movable ? '✋' : ''].join('')
}

export function rushSpec(solved, seed) {
  const k = Math.min(solved, 14)
  const spec = levelSpec(1 + (k % 5) * 12 + Math.min(11, Math.floor(k / 2)))
  return { ...spec, seed: seed + solved * 31 }
}
