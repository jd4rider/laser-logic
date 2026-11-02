import Phaser from 'phaser'
import { W, background, button, text, fade } from './common.js'
import { data } from './save.js'
import { WORLDS, LEVELS_PER_WORLD, TOTAL_LEVELS, levelSpec, tagsOf } from '../game.js'

export default class LevelsScene extends Phaser.Scene {
  constructor() {
    super('levels')
  }

  init(d) {
    this.world = Phaser.Math.Clamp(d?.world ?? 0, 0, WORLDS.length - 1)
  }

  create() {
    const w = WORLDS[this.world]
    background(this, w.bg)
    this.cameras.main.fadeIn(250, 4, 20, 36)
    text(this, W / 2, 70, w.name, 44, '#fff', { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 112, w.blurb, 17, '#fde68a', { align: 'center', wordWrap: { width: 560 } }).setOrigin(0.5)
    text(this, W / 2, 140, `World ${this.world + 1} of ${WORLDS.length}`, 15, '#ffffffaa').setOrigin(0.5)
    const stars = Object.values(data.stars).reduce((a, b) => a + b, 0)
    text(this, W - 24, 30, `${stars} ★`, 24, '#fde047', { fontStyle: 'bold' }).setOrigin(1, 0.5)
    button(this, 80, 36, '◀ Menu', () => fade(this, 'menu'), { w: 120, h: 42, size: 17, color: 0x374151 })

    const cols = 3
    const size = 132
    const gap = 22
    const left = (W - (cols * size + (cols - 1) * gap)) / 2
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const n = this.world * LEVELS_PER_WORLD + i + 1
      const open = n <= data.unlocked
      const x = left + (i % cols) * (size + gap) + size / 2
      const y = 175 + Math.floor(i / cols) * (size + gap) + size / 2
      const box = this.add.container(x, y)
      const g = this.add.graphics()
      g.fillStyle(open ? w.color : 0x1f2f44, open ? 0.95 : 0.8).fillRoundedRect(-size / 2, -size / 2, size, size, 20)
      g.lineStyle(3, 0xffffff, open ? 0.6 : 0.15).strokeRoundedRect(-size / 2, -size / 2, size, size, 20)
      box.add(g)
      box.add(text(this, 0, -22, String(n), 44, open ? '#fff' : '#53657d', { fontStyle: 'bold' }).setOrigin(0.5))
      if (open) {
        const spec = levelSpec(n)
        box.add(text(this, 0, 14, tagsOf(spec) || `${spec.n}×${spec.n}`, tagsOf(spec) ? 18 : 15, '#ffffffcc').setOrigin(0.5))
        const got = data.stars[n] || 0
        for (let s = 0; s < 3; s++) box.add(text(this, (s - 1) * 28, 44, '★', 26, s < got ? '#fde047' : '#00000055').setOrigin(0.5))
        box.setSize(size, size).setInteractive({ useHandCursor: true })
        box.on('pointerdown', () => {
          this.tweens.add({ targets: box, scale: 0.94, duration: 70, yoyo: true })
          fade(this, 'game', { mode: 'puzzle', level: n })
        })
        if (n === data.unlocked && n <= TOTAL_LEVELS) this.tweens.add({ targets: box, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      } else {
        box.add(text(this, 0, 30, '🔒', 28).setOrigin(0.5))
      }
    }

    const go = (d) => this.scene.restart({ world: this.world + d })
    if (this.world > 0) button(this, 90, 810, '◀ Prev', () => go(-1), { w: 140, h: 48, size: 18, color: 0x075985 })
    if (this.world < WORLDS.length - 1) button(this, W - 90, 810, 'Next ▶', () => go(1), { w: 140, h: 48, size: 18, color: 0x075985 })
    if (this.world < WORLDS.length - 1 && data.unlocked <= (this.world + 1) * LEVELS_PER_WORLD) {
      text(this, W / 2, 810, 'Finish this world to unlock the next', 15, '#7dd3fc').setOrigin(0.5)
    }
  }
}
