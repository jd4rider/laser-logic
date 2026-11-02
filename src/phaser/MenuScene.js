import Phaser from 'phaser'
import { W, H, background, button, text, fade, maskColor } from './common.js'
import { data } from './save.js'
import { TOTAL_LEVELS, WORLDS } from '../game.js'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create() {
    background(this, ['#0c2a4a', '#030a16'], 0x7dd3fc)
    this.cameras.main.fadeIn(300, 4, 20, 36)

    // Decorative beams bouncing across the top of the screen.
    const g = this.add.graphics().setBlendMode('ADD')
    const beams = [
      { y: 120, c: 1 }, { y: 150, c: 2 }, { y: 180, c: 4 },
    ]
    const pts = (y, k) => [[40, y], [160 + k * 30, y], [160 + k * 30, 70], [300 + k * 20, 70], [300 + k * 20, y], [W - 40, y]]
    beams.forEach((b, k) => {
      const p = pts(b.y, k)
      g.lineStyle(14, maskColor(b.c), 0.18).strokePoints(p.map(([x, y]) => ({ x, y })))
      g.lineStyle(4, maskColor(b.c), 0.95).strokePoints(p.map(([x, y]) => ({ x, y })))
    })
    this.tweens.add({ targets: g, alpha: 0.55, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    ;[[160, 70], [300, 70]].forEach(([x, y], i) => {
      const m = this.add.rectangle(x + 30 * i + 0, y, 54, 8, 0xe2e8f0).setAngle(i ? -45 : 45)
      this.tweens.add({ targets: m, angle: m.angle + 12, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    })

    const title = text(this, W / 2, 285, 'Laser', 80, '#ffffff', { fontStyle: 'bold', stroke: '#06283d', strokeThickness: 8 }).setOrigin(0.5)
    text(this, W / 2, 360, 'L O G I C', 44, '#7dd3fc', { fontStyle: 'bold', stroke: '#06283d', strokeThickness: 6 }).setOrigin(0.5)
    this.tweens.add({ targets: title, scale: 1.04, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    text(this, W / 2, 410, 'Bend the beams. Light every target.', 21, '#bae6fd').setOrigin(0.5)

    const stars = Object.values(data.stars).reduce((a, b) => a + b, 0)
    const done = Object.keys(data.stars).length
    button(this, W / 2, 490, '🔦  Journey', () => fade(this, 'levels', { world: Math.floor((Math.min(data.unlocked, TOTAL_LEVELS) - 1) / 12) }), { w: 400, h: 62, size: 28, color: 0x0369a1 })
    text(this, W / 2, 535, `${done}/${TOTAL_LEVELS} levels · ${stars}★`, 16, '#7dd3fc').setOrigin(0.5)
    button(this, W / 2, 605, '⏱  Rush', () => fade(this, 'game', { mode: 'rush' }), { w: 400, h: 62, size: 28, color: 0xdb2777 })
    text(this, W / 2, 650, data.bestRush ? `Best ${data.bestRush} puzzles in 2 minutes` : '2 minutes — solve as many as you can', 16, '#f9a8d4').setOrigin(0.5)

    WORLDS.forEach((w, i) => this.add.circle(W / 2 + (i - 2) * 34, 715, 10, w.color))
    text(this, W / 2, 755, 'Tap a mirror to flip it', 17, '#bae6fd').setOrigin(0.5)
    text(this, H - H + W / 2, H - 55, '🎨 filters  ·  ◧ splitters  ·  🔺 prisms  ·  ✋ movable mirrors', 14, '#94a3b8').setOrigin(0.5)
  }
}
