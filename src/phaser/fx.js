export function ring(scene, x, y, color, radius, duration = 450, width = 6) {
  const c = scene.add.circle(x, y, 10).setStrokeStyle(width, color).setDepth(17)
  scene.tweens.add({
    targets: c,
    scale: radius / 10,
    alpha: 0,
    duration,
    ease: 'Cubic.Out',
    onComplete: () => c.destroy(),
  })
}

export function flashAt(scene, x, y, size, color = 0xffffff) {
  const g = scene.add.image(x, y, 'glow').setTint(color).setBlendMode('ADD').setDepth(16).setScale(0.3)
  scene.tweens.add({ targets: g, scale: size / 128, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => g.destroy() })
}

export function popText(scene, x, y, str, color = '#fff', size = 26) {
  const t = scene.add
    .text(x, y, str, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 5 })
    .setOrigin(0.5)
    .setDepth(25)
    .setScale(0.5)
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' })
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 350, duration: 550, onComplete: () => t.destroy() })
}

export function grains(scene, x, y, color, count = 10, speed = 240, up = false) {
  const e = scene.add
    .particles(x, y, 'spark', {
      speed: { min: speed * 0.3, max: speed },
      angle: up ? { min: 240, max: 300 } : { min: 0, max: 360 },
      gravityY: 700,
      scale: { start: 0.45, end: 0.1 },
      lifespan: { min: 400, max: 800 },
      tint: color,
      emitting: false,
    })
    .setDepth(18)
  e.explode(count)
  scene.time.delayedCall(900, () => e.destroy())
}
