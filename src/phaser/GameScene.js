import Phaser from 'phaser'
import { W, H, background, button, text, fade, maskColor } from './common.js'
import { ring, flashAt, popText, grains } from './fx.js'
import { audioState, sfx } from '../sound.js'
import { data, persist } from './save.js'
import {
  freshState, cloneState, trace, isSolved, receivers, rotate, move, canMove, hintFor, starsFor, isPiece,
  generate, rushSpec, levelPuzzle, TOTAL_LEVELS, WORLDS, LEVELS_PER_WORLD, DX, DY,
} from '../game.js'

const BOARD_TOP = 150
const BOARD_H = 650
const RUSH_TIME = 120
const worldOf = (level) => Math.min(WORLDS.length - 1, Math.floor((level - 1) / LEVELS_PER_WORLD))
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const INTROS = {
  13: 'New: colour filters. They pass only their own colour. Targets need an exact colour.',
  25: 'New: splitters. A beam goes straight on and bends too.',
  37: 'New: prisms. White light splits into red, green and blue.',
  49: 'New: drag the gold-ringed mirrors to move them. Tap to flip.',
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  init(cfg = {}) {
    this.mode = cfg.mode ?? 'puzzle'
    this.level = cfg.level ?? 1
    this.worldIndex = this.mode === 'puzzle' ? worldOf(this.level) : 0
    this.rushSolved = 0
    this.rushSeed = Math.floor(Math.random() * 1e9)
    this.busy = true
    this.phase = 'intro'
    this.nodes = []
    this.panel = null
    this.history = []
    this.hintObjs = []
    this.drag = null
    this.litSet = new Set()
  }

  create() {
    const world = WORLDS[this.worldIndex]
    this.world = world
    background(this, world.bg, 0x7dd3fc)
    this.cameras.main.fadeIn(250, 4, 20, 36)

    this.add.rectangle(W / 2, 62, W, 124, 0x050b14, 0.94).setDepth(30)
    this.add.rectangle(W / 2, 124, W, 3, world.color, 0.9).setDepth(31)
    this.titleText = text(this, 24, 22, '', 30, '#fff', { fontStyle: 'bold' }).setDepth(32)
    this.subText = text(this, 24, 66, '', 18, '#7dd3fc').setDepth(32)
    this.mainText = text(this, W / 2 + 20, 56, '', 54, '#e0f2fe', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(32)
    this.rightText = text(this, W - 24, 36, '', 20, '#bae6fd', { align: 'right' }).setOrigin(1, 0.5).setDepth(32)
    this.rightText2 = text(this, W - 24, 70, '', 20, '#bae6fd', { align: 'right' }).setOrigin(1, 0.5).setDepth(32)

    const y = 826
    const opts = { w: 112, h: 46, size: 16 }
    button(this, 68, y, '💡 Hint', () => this.hint(), { ...opts, color: 0xb45309 }).setDepth(32)
    button(this, 192, y, '↶ Undo', () => this.undo(), { ...opts, color: 0x0369a1 }).setDepth(32)
    button(this, 316, y, '↺ Reset', () => this.reset(), { ...opts, color: 0x7c3aed }).setDepth(32)
    this.soundBtn = button(this, 440, y, audioState.muted ? '🔇' : '🔊', () => {
      audioState.muted = !audioState.muted
      data.muted = audioState.muted
      persist()
      this.soundBtn.setLabel(audioState.muted ? '🔇' : '🔊')
    }, { ...opts, color: 0x374151 }).setDepth(32)
    button(this, 564, y, this.mode === 'puzzle' ? 'Levels' : 'Menu', () => this.leave(), { ...opts, color: 0x374151 }).setDepth(32)

    this.toast = text(this, W / 2, 400, '', 32, '#e0f2fe', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6, align: 'center', wordWrap: { width: 560 } }).setOrigin(0.5).setDepth(50).setAlpha(0)

    this.input.on('pointerdown', (p) => this.onDown(p))
    this.input.on('pointermove', (p) => this.onMove(p))
    this.input.on('pointerup', (p) => this.onUp(p))

    if (this.mode === 'rush') {
      this.timeLeft = RUSH_TIME
      this.timer = this.time.addEvent({ delay: 100, loop: true, callback: () => this.tick() })
    }
    this.begin(false)
  }

  // ---------- level lifecycle ----------

  async begin(withWipe) {
    this.busy = true
    this.phase = 'intro'
    if (withWipe) await this.wipe(true)
    this.puzzle = this.mode === 'puzzle' ? levelPuzzle(this.level) : generate(rushSpec(this.rushSolved, this.rushSeed))
    this.state = freshState(this.puzzle)
    this.history = []
    this.moves = 0
    this.panel?.destroy()
    this.panel = null
    this.clearHint()
    this.litSet = new Set()
    this.buildBoard()
    this.refresh(false)
    this.beamTween?.stop()
    this.beamLayer.setAlpha(0)
    this.nodes.forEach((nd) => nd?.cont.setAlpha(0))
    this.refreshHud()
    if (withWipe) await this.wipe(false)
    if (this.mode === 'puzzle') await this.intro()
    await this.popIn()
    this.phase = 'play'
    this.busy = false
  }

  buildBoard() {
    this.tiles?.destroy()
    this.beamLayer?.destroy()
    this.nodes.forEach((n) => n?.cont.destroy())
    this.nodes = []
    const n = this.state.n
    const cs = Math.min(Math.floor(600 / n), 84)
    this.cs = cs
    this.left = (W - n * cs) / 2
    this.top = BOARD_TOP + (BOARD_H - n * cs) / 2
    this.tiles = this.add.container(0, 0).setDepth(1)
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.35).fillRoundedRect(this.left - 10, this.top - 10, n * cs + 20, n * cs + 20, 18)
    g.lineStyle(3, this.world.color, 0.7).strokeRoundedRect(this.left - 10, this.top - 10, n * cs + 20, n * cs + 20, 18)
    for (let i = 0; i < n * n; i++) {
      const c = this.cellXY(i)
      g.fillStyle(0xffffff, 0.05).fillRoundedRect(c.x - cs / 2 + 2, c.y - cs / 2 + 2, cs - 4, cs - 4, 8)
    }
    this.tiles.add(g)
    this.beamLayer = this.add.graphics().setDepth(3).setBlendMode('ADD')
    this.tiles.setScale(0)
    this.tiles.setPosition(W / 2, this.top + (n * cs) / 2)
    this.tiles.each((o) => o.setPosition(-W / 2, -(this.top + (n * cs) / 2)))
    this.renderPieces()
  }

  cellXY(i) {
    const n = this.state.n
    return { x: this.left + (i % n) * this.cs + this.cs / 2, y: this.top + Math.floor(i / n) * this.cs + this.cs / 2 }
  }

  cellAt(x, y) {
    const n = this.state.n
    const cx = Math.floor((x - this.left) / this.cs)
    const cy = Math.floor((y - this.top) / this.cs)
    return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cy * n + cx
  }

  renderPieces() {
    this.nodes.forEach((nd) => nd?.cont.destroy())
    this.nodes = this.state.cells.map((c, i) => (c ? this.makePiece(c, i) : null))
  }

  makePiece(c, i) {
    const { x, y } = this.cellXY(i)
    const cs = this.cs
    const h = cs / 2 - 6
    const cont = this.add.container(x, y).setDepth(5)
    const node = { cont, c, i }
    const g = this.add.graphics()
    cont.add(g)
    if (c.t === 'wall') {
      g.fillStyle(0x334155, 1).fillRoundedRect(-h, -h, 2 * h, 2 * h, 8)
      g.lineStyle(3, 0x64748b, 1).strokeRoundedRect(-h, -h, 2 * h, 2 * h, 8)
      g.lineStyle(2, 0x1e293b, 1).lineBetween(-h, 0, h, 0).lineBetween(0, -h, 0, 0).lineBetween(-h / 2, 0, -h / 2, h).lineBetween(h / 2, 0, h / 2, h)
    } else if (c.t === 'emit') {
      const col = maskColor(c.mask)
      g.fillStyle(0x0f172a, 1).fillRoundedRect(-h, -h, 2 * h, 2 * h, 10)
      g.lineStyle(3, col, 1).strokeRoundedRect(-h, -h, 2 * h, 2 * h, 10)
      const nose = this.add.rectangle(DX[c.dir] * h * 0.85, DY[c.dir] * h * 0.85, DX[c.dir] ? h * 0.5 : h * 0.7, DY[c.dir] ? h * 0.5 : h * 0.7, col)
      cont.add(nose)
      cont.add(this.add.circle(0, 0, h * 0.42, col).setBlendMode('ADD'))
      const core = this.add.circle(0, 0, h * 0.2, 0xffffff)
      cont.add(core)
      this.tweens.add({ targets: core, scale: 1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    } else if (c.t === 'recv') {
      node.col = maskColor(c.mask)
      node.glow = this.add.circle(0, 0, h * 0.95, node.col, 0).setBlendMode('ADD')
      node.ring = this.add.graphics()
      node.ring.lineStyle(5, node.col, 1).strokeCircle(0, 0, h * 0.78)
      node.ring.lineStyle(3, node.col, 0.5).strokeCircle(0, 0, h * 0.5)
      node.core = this.add.circle(0, 0, h * 0.34, node.col, 0.15)
      cont.add([node.glow, node.ring, node.core])
    } else if (c.t === 'mirror' || c.t === 'split') {
      const split = c.t === 'split'
      const bar = this.add.container(0, 0)
      const len = h * 2.15
      bar.add(this.add.rectangle(0, 0, len, split ? 12 : 9, split ? 0x93c5fd : 0xe2e8f0, split ? 0.65 : 1).setStrokeStyle(2, 0xffffff, 0.9))
      if (split) bar.add(this.add.rectangle(0, 0, len * 0.8, 3, 0xffffff, 0.95))
      else bar.add(this.add.rectangle(0, -2, len * 0.85, 2, 0xffffff, 0.9))
      bar.setAngle(c.o ? 45 : -45)
      cont.add([this.add.circle(0, 0, 6, 0x475569).setStrokeStyle(2, 0xcbd5e1), bar])
      node.bar = bar
      if (c.mov) {
        g.lineStyle(3, 0xfbbf24, 0.95).strokeRoundedRect(-cs / 2 + 4, -cs / 2 + 4, cs - 8, cs - 8, 10)
        g.fillStyle(0xfbbf24, 0.12).fillRoundedRect(-cs / 2 + 4, -cs / 2 + 4, cs - 8, cs - 8, 10)
      }
    } else if (c.t === 'filter') {
      const col = maskColor(c.mask)
      g.fillStyle(col, 0.35).fillRoundedRect(-h, -h, 2 * h, 2 * h, 6)
      g.lineStyle(4, col, 1).strokeRoundedRect(-h, -h, 2 * h, 2 * h, 6)
      g.lineStyle(2, 0xffffff, 0.5).lineBetween(-h * 0.6, h * 0.5, h * 0.3, -h * 0.6)
    } else if (c.t === 'prism') {
      g.fillStyle(0xffffff, 0.22).fillTriangle(0, -h, h, h * 0.8, -h, h * 0.8)
      g.lineStyle(3, 0xffffff, 0.95).strokeTriangle(0, -h, h, h * 0.8, -h, h * 0.8)
      g.lineStyle(3, maskColor(1), 0.9).lineBetween(-h * 0.5, h * 0.45, 0, -h * 0.4)
      g.lineStyle(3, maskColor(2), 0.9).lineBetween(0, h * 0.5, 0, -h * 0.4)
      g.lineStyle(3, maskColor(4), 0.9).lineBetween(h * 0.5, h * 0.45, 0, -h * 0.4)
    }
    return node
  }

  // ---------- beams ----------

  refresh(animate) {
    const t = trace(this.state)
    this.drawBeams(t)
    const rs = receivers(this.state)
    let newly = 0
    const now = new Set()
    rs.forEach((i) => {
      const nd = this.nodes[i]
      const ok = (t.lit[i] || 0) === this.state.cells[i].mask
      if (ok) now.add(i)
      nd.glow.setAlpha(ok ? 0.7 : 0)
      nd.core.setFillStyle(nd.col, ok ? 0.95 : 0.15)
      if (nd.pulse) nd.pulse.stop()
      nd.pulse = ok ? this.tweens.add({ targets: nd.glow, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }) : null
      if (ok && !this.litSet.has(i) && animate) {
        newly++
        const c = this.cellXY(i)
        ring(this, c.x, c.y, nd.col, this.cs * 0.9, 500, 4)
        flashAt(this, c.x, c.y, this.cs * 1.8, nd.col)
        grains(this, c.x, c.y, nd.col, 10, 220)
      }
    })
    this.litSet = now
    if (newly) sfx.light(now.size)
    this.t = t
    this.lastLit = now.size
    return t
  }

  drawBeams(t) {
    const g = this.beamLayer
    g.clear()
    const half = this.cs / 2
    const n = this.state.n
    const edge = (seg) => {
      const a = this.cellXY(seg.a)
      if (seg.b === -1) {
        const reach = this.cs * n
        return { x: clamp(a.x + DX[seg.d] * reach, this.left - 10, this.left + n * this.cs + 10), y: clamp(a.y + DY[seg.d] * reach, this.top - 10, this.top + n * this.cs + 10) }
      }
      const b = this.cellXY(seg.b)
      if (this.state.cells[seg.b]?.t === 'wall') return { x: b.x - DX[seg.d] * (half - 3), y: b.y - DY[seg.d] * (half - 3) }
      return b
    }
    for (const [w, a, k] of [[this.cs * 0.42, 0.14, 1], [this.cs * 0.2, 0.3, 1], [5, 1, 0.55]]) {
      for (const seg of t.segs) {
        const p = this.cellXY(seg.a)
        const q = edge(seg)
        const base = maskColor(seg.m)
        const mix = (v) => Math.round(v + (255 - v) * 0.55)
        const c = k === 1 ? base : (mix((base >> 16) & 255) << 16) | (mix((base >> 8) & 255) << 8) | mix(base & 255)
        g.lineStyle(w, c, a).lineBetween(p.x, p.y, q.x, q.y)
      }
    }
    if (this.beamTween) this.beamTween.stop()
    g.setAlpha(0.6)
    this.beamTween = this.tweens.add({ targets: g, alpha: 1, duration: 180, onComplete: () => {
      this.beamTween = this.tweens.add({ targets: g, alpha: 0.82, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    } })
  }

  // ---------- helpers ----------

  async popIn() {
    sfx.whoosh()
    this.nodes.forEach((nd) => nd && this.tweens.add({ targets: nd.cont, alpha: 1, duration: 300, delay: 150 }))
    await this.tween({ targets: this.tiles, scale: 1, duration: 320, ease: 'Back.Out' })
    this.drawBeams(this.t)
  }

  async intro() {
    const label = `Level ${this.level}`
    const sub = INTROS[this.level] ?? this.world.blurb
    sfx.whoosh()
    const cy = BOARD_TOP + BOARD_H / 2
    const band = this.add.rectangle(W / 2, cy, W, 190, 0x000000, 0.78).setDepth(40).setScale(1, 0)
    const l1 = this.add.rectangle(W / 2, cy - 95, W, 4, this.world.color).setDepth(41).setScale(0, 1)
    const l2 = this.add.rectangle(W / 2, cy + 95, W, 4, this.world.color).setDepth(41).setScale(0, 1)
    const t1 = text(this, -300, cy - 30, label, 64, '#fff', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(42)
    const t2 = text(this, W + 400, cy + 40, sub, 21, '#bae6fd', { align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5).setDepth(42)
    await Promise.all([
      this.tween({ targets: band, scaleY: 1, duration: 220, ease: 'Back.Out' }),
      this.tween({ targets: [l1, l2], scaleX: 1, duration: 300 }),
      this.tween({ targets: t1, x: W / 2, duration: 420, ease: 'Back.Out' }),
      this.tween({ targets: t2, x: W / 2, duration: 520, ease: 'Cubic.Out' }),
    ])
    await this.delay(INTROS[this.level] ? 1600 : 800)
    await Promise.all([
      this.tween({ targets: t1, x: W + 400, duration: 300, ease: 'Cubic.In' }),
      this.tween({ targets: t2, x: -400, duration: 300, ease: 'Cubic.In' }),
      this.tween({ targets: band, scaleY: 0, duration: 260, delay: 120 }),
      this.tween({ targets: [l1, l2], scaleX: 0, duration: 260, delay: 120 }),
    ])
    ;[band, l1, l2, t1, t2].forEach((o) => o.destroy())
  }

  // A sweep of laser light wipes the screen between levels.
  async wipe(closing) {
    sfx.whoosh()
    if (closing) {
      const wave = this.add.container(-W - 80, 0).setDepth(60)
      wave.add(this.add.rectangle(0, 0, W + 80, H, 0x0369a1).setOrigin(0, 0))
      ;[0x22d3ee, 0xff4d4d, 0x4dff7a, 0x4d9bff].forEach((c, i) => wave.add(this.add.rectangle(W + 80 - i * 14, 0, 10, H, c).setOrigin(0, 0)))
      this.wave = wave
      await this.tween({ targets: wave, x: 0, duration: 480, ease: 'Cubic.InOut' })
    } else {
      await this.tween({ targets: this.wave, x: W + 120, duration: 520, ease: 'Cubic.InOut' })
      this.wave.destroy()
      this.wave = null
    }
  }

  tween(config) {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: resolve }))
  }

  delay(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve))
  }

  say(msg, color = '#e0f2fe') {
    this.tweens.killTweensOf(this.toast)
    this.toast.setText(msg).setColor(color).setAlpha(1).setScale(0.6).setY(BOARD_TOP + 330)
    this.tweens.add({ targets: this.toast, scale: 1, duration: 150 })
    this.tweens.add({ targets: this.toast, y: BOARD_TOP + 280, alpha: 0, delay: 1100, duration: 600 })
  }

  refreshHud() {
    if (this.mode === 'puzzle') {
      this.titleText.setText(`Level ${this.level}`)
      this.subText.setText(this.world.name)
      this.mainText.setText(`${this.moves}`)
      this.rightText.setText(`Par ${this.puzzle?.par ?? 0}`).setY(52)
      this.rightText2.setText('')
    } else {
      this.titleText.setText('Rush')
      this.subText.setText(`Best ${data.bestRush}`)
      this.mainText.setText(`${Math.ceil(this.timeLeft)}s`)
      this.rightText.setText(`Solved ${this.rushSolved}`).setY(36)
      this.rightText2.setText(`${this.moves} moves`)
    }
  }

  // ---------- input ----------

  onDown(p) {
    if (this.busy || this.phase !== 'play') return
    const i = this.cellAt(p.worldX, p.worldY)
    if (i < 0) return
    const c = this.state.cells[i]
    if (!isPiece(c)) return
    this.clearHint()
    this.drag = { i, sx: p.worldX, sy: p.worldY, moved: false, over: -1, marks: null }
  }

  onMove(p) {
    const d = this.drag
    if (!d) return
    const c = this.state.cells[d.i]
    if (!c.mov) return
    if (!d.moved && Phaser.Math.Distance.Between(p.worldX, p.worldY, d.sx, d.sy) > 12) {
      d.moved = true
      this.nodes[d.i].cont.setDepth(20)
      d.marks = this.add.graphics().setDepth(4)
      this.state.cells.forEach((cc, k) => {
        if (cc === null) {
          const q = this.cellXY(k)
          d.marks.lineStyle(2, 0xfbbf24, 0.6).strokeRoundedRect(q.x - this.cs / 2 + 5, q.y - this.cs / 2 + 5, this.cs - 10, this.cs - 10, 8)
        }
      })
      sfx.pick()
    }
    if (d.moved) this.nodes[d.i].cont.setPosition(p.worldX, p.worldY)
  }

  onUp(p) {
    const d = this.drag
    this.drag = null
    if (!d) return
    d.marks?.destroy()
    if (!d.moved) {
      this.flip(d.i)
      return
    }
    const to = this.cellAt(p.worldX, p.worldY)
    const node = this.nodes[d.i]
    if (to >= 0 && to !== d.i && canMove(this.state, d.i, to)) {
      this.history.push(cloneState(this.state))
      move(this.state, d.i, to)
      this.moves++
      sfx.drop()
      const q = this.cellXY(to)
      this.tween({ targets: node.cont, x: q.x, y: q.y, duration: 120 }).then(() => {
        this.renderPieces()
        this.afterChange()
      })
      this.refresh(false)
      this.refreshHud()
    } else {
      sfx.locked()
      const q = this.cellXY(d.i)
      this.tween({ targets: node.cont, x: q.x, y: q.y, duration: 160, ease: 'Back.Out' }).then(() => node.cont.setDepth(5))
    }
  }

  flip(i) {
    this.history.push(cloneState(this.state))
    rotate(this.state, i)
    this.moves++
    sfx.click()
    const nd = this.nodes[i]
    this.tweens.add({ targets: nd.bar, angle: nd.bar.angle + 90, duration: 150, ease: 'Back.Out' })
    const q = this.cellXY(i)
    flashAt(this, q.x, q.y, this.cs * 1.1, 0xbae6fd)
    this.refresh(true)
    this.refreshHud()
    this.afterChange()
  }

  afterChange() {
    if (this.phase === 'play' && isSolved(this.state)) this.win()
  }

  undo() {
    if (this.busy || this.phase !== 'play' || !this.history.length) return
    this.clearHint()
    this.state = this.history.pop()
    this.moves = Math.max(0, this.moves - 1)
    sfx.drop()
    this.renderPieces()
    this.litSet = new Set(receivers(this.state).filter((i) => (trace(this.state).lit[i] || 0) === this.state.cells[i].mask))
    this.refresh(false)
    this.refreshHud()
  }

  reset() {
    if (this.busy || this.phase !== 'play') return
    this.clearHint()
    this.state = freshState(this.puzzle)
    this.history = []
    this.moves = 0
    this.litSet = new Set()
    sfx.whoosh()
    this.renderPieces()
    this.refresh(false)
    this.refreshHud()
  }

  hint() {
    if (this.busy || this.phase !== 'play') return
    this.clearHint()
    const h = hintFor(this.state, this.puzzle.solution)
    if (!h) return
    sfx.hint()
    const mark = (i, col) => {
      const q = this.cellXY(i)
      const r = this.add.rectangle(q.x, q.y, this.cs - 4, this.cs - 4).setStrokeStyle(4, col).setDepth(8)
      this.tweens.add({ targets: r, alpha: 0.25, duration: 380, yoyo: true, repeat: -1 })
      this.hintObjs.push(r)
    }
    if (h.kind === 'rotate') mark(h.at, 0xfde047)
    else {
      mark(h.from, 0xfde047)
      mark(h.to, 0x86efac)
    }
    this.hintTimer = this.time.delayedCall(4000, () => this.clearHint())
  }

  clearHint() {
    this.hintTimer?.remove()
    this.hintTimer = null
    this.hintObjs.forEach((o) => {
      this.tweens.killTweensOf(o)
      o.destroy()
    })
    this.hintObjs = []
  }

  tick() {
    if (this.phase !== 'play') return
    this.timeLeft = Math.max(0, this.timeLeft - 0.1)
    this.refreshHud()
    if (this.timeLeft <= 0) this.finishRush()
  }

  // ---------- endings ----------

  async win() {
    this.busy = true
    this.phase = 'won'
    this.clearHint()
    sfx.win()
    const rs = receivers(this.state)
    rs.forEach((i, k) => {
      this.time.delayedCall(k * 120, () => {
        const q = this.cellXY(i)
        const col = maskColor(this.state.cells[i].mask)
        ring(this, q.x, q.y, 0xffffff, this.cs * 1.6, 650, 5)
        flashAt(this, q.x, q.y, this.cs * 3, col)
        grains(this, q.x, q.y, col, 18, 380)
      })
    })
    this.tweens.add({ targets: this.beamLayer, alpha: 1, duration: 150 })
    this.beamTween?.stop()
    await this.delay(rs.length * 120 + 700)

    if (this.mode === 'rush') {
      this.rushSolved++
      const bonus = 10 + Math.min(6, this.puzzle.spec.n - 5)
      this.timeLeft = Math.min(RUSH_TIME + 30, this.timeLeft + bonus)
      popText(this, W / 2, 400, `+${bonus}s`, '#86efac', 46)
      sfx.coin()
      await this.delay(450)
      if (this.phase !== 'won') return
      this.begin(false)
      return
    }
    this.say('LIT UP!', '#e0f2fe')
    await this.delay(600)
    const stars = starsFor(this.moves, this.puzzle.par)
    data.stars[this.level] = Math.max(data.stars[this.level] || 0, stars)
    data.unlocked = Math.min(TOTAL_LEVELS, Math.max(data.unlocked, this.level + 1))
    persist()
    this.showPanel({ won: true, title: `Level ${this.level} Complete!`, stars, lines: [`${this.moves} moves · par ${this.puzzle.par}`] })
  }

  finishRush() {
    if (this.phase === 'over') return
    this.phase = 'over'
    this.busy = true
    this.clearHint()
    sfx.lose()
    const record = this.rushSolved > data.bestRush
    if (record) {
      data.bestRush = this.rushSolved
      persist()
    }
    this.showPanel({ won: false, title: "Time's up!", lines: [`Puzzles solved: ${this.rushSolved}`, record ? '🏆 New best!' : `Best ${data.bestRush}`] })
  }

  leave() {
    fade(this, this.mode === 'puzzle' ? 'levels' : 'menu', { world: this.worldIndex })
  }

  showPanel({ won, title, stars, lines = [] }) {
    const p = this.add.container(0, 0).setDepth(70)
    this.panel = p
    p.add(this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.82).setInteractive())
    const card = this.add.graphics()
    card.fillStyle(0x0b1b2e, 1).fillRoundedRect(60, 170, W - 120, 500, 24)
    card.lineStyle(3, won ? 0x38bdf8 : 0xfb7185, 0.9).strokeRoundedRect(60, 170, W - 120, 500, 24)
    p.add(card)
    p.add(text(this, W / 2, 225, title, 36, won ? '#e0f2fe' : '#fda4af', { fontStyle: 'bold' }).setOrigin(0.5))
    if (stars) {
      for (let i = 0; i < 3; i++) {
        const s = text(this, W / 2 + (i - 1) * 90, 330, '★', 84, i < stars ? '#fde047' : '#1e3a52').setOrigin(0.5).setScale(0)
        p.add(s)
        this.tweens.add({ targets: s, scale: 1, duration: 400, delay: 300 + i * 260, ease: 'Back.Out', onStart: () => i < stars && sfx.coin() })
      }
    }
    p.add(text(this, W / 2, stars ? 405 : 320, lines.join('\n'), 26, '#7dd3fc', { align: 'center', lineSpacing: 10 }).setOrigin(0.5, 0))
    const add = (label, y, fn, color) => p.add(button(this, W / 2, y, label, fn, { w: 280, h: 52, color }))
    if (this.mode === 'puzzle') {
      const more = won && this.level < TOTAL_LEVELS
      if (more) add('Next level ▶', 500, () => this.next(), 0x0369a1)
      add('Replay', more ? 560 : 500, () => this.begin(true), 0x075985)
      add('Levels', more ? 620 : 560, () => this.leave(), 0x374151)
    } else {
      add('Play again', 500, () => fade(this, 'game', { mode: 'rush' }), 0x0369a1)
      add('Menu', 560, () => this.leave(), 0x374151)
    }
    p.setAlpha(0)
    this.tweens.add({ targets: p, alpha: 1, duration: 300 })
  }

  next() {
    const level = this.level + 1
    if (worldOf(level) !== this.worldIndex) fade(this, 'game', { mode: 'puzzle', level })
    else {
      this.level = level
      this.begin(true)
    }
  }
}
