import test from 'node:test'
import assert from 'node:assert/strict'
import {
  trace, isSolved, freshState, applySolution, levelPuzzle, levelSpec, rushSpec, generate, hintFor,
  rotate, move, canMove, starsFor, TOTAL_LEVELS, R, G, B, WHITE,
} from './game.js'

const board = (n, put) => {
  const cells = Array(n * n).fill(null)
  put(cells)
  return { n, cells }
}

test('mirror turns a beam into a receiver', () => {
  const s = board(4, (c) => {
    c[4] = { t: 'emit', dir: 1, mask: R }
    c[1 * 4 + 2] = { t: 'mirror', o: 0, id: 0 }
    c[2] = { t: 'recv', mask: R }
  })
  assert.equal(isSolved(s), true)
  rotate(s, 6)
  assert.equal(isSolved(s), false)
})

test('filters keep only their colour and prisms split white', () => {
  const f = board(4, (c) => {
    c[0] = { t: 'emit', dir: 1, mask: R | G }
    c[1] = { t: 'filter', mask: G }
    c[3] = { t: 'recv', mask: G }
  })
  assert.equal(isSolved(f), true)
  const p = board(5, (c) => {
    c[10] = { t: 'emit', dir: 1, mask: WHITE }
    c[2 * 5 + 1] = { t: 'prism' }
    c[1 * 5 + 1 + 0] = null
    c[1] = { t: 'recv', mask: 0 }
  })
  const t = trace(p)
  const dirs = t.segs.filter((s) => s.a === 11).map((s) => [s.d, s.m]).sort()
  assert.deepEqual(dirs, [[0, R], [1, G], [2, B]])
})

test('splitters pass and reflect', () => {
  const s = board(4, (c) => {
    c[4] = { t: 'emit', dir: 1, mask: B }
    c[5] = { t: 'split', o: 0, id: 0 }
    c[1] = { t: 'recv', mask: B }
    c[7] = { t: 'recv', mask: B }
  })
  assert.equal(isSolved(s), true)
})

test('beam loops terminate', () => {
  const s = board(4, (c) => {
    c[4] = { t: 'emit', dir: 1, mask: R }
    c[5] = { t: 'split', o: 0, id: 0 }
    c[1] = { t: 'split', o: 1, id: 1 }
    c[2] = { t: 'split', o: 0, id: 2 }
    c[6] = { t: 'split', o: 1, id: 3 }
  })
  assert.ok(trace(s).segs.length < 200)
})

test('all levels generate unsolved and the solution solves them', () => {
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    const p = levelPuzzle(n)
    const s = freshState(p)
    assert.equal(isSolved(s), false, `level ${n} starts solved`)
    assert.ok(p.par >= 1)
    const spec = levelSpec(n)
    const kinds = (t) => s.cells.filter((c) => c?.t === t).length
    assert.equal(kinds('mirror') + kinds('split'), spec.mirrors + spec.splits)
    assert.ok(kinds('recv') >= 2 && kinds('recv') <= spec.recvs)
    assert.equal(s.cells.filter((c) => c?.mov).length, spec.movable)
    applySolution(s, p.solution)
    assert.equal(isSolved(s), true, `level ${n} solution fails`)
  }
})

test('hints lead to a solve and rush specs generate', () => {
  const p = levelPuzzle(55)
  const s = freshState(p)
  for (let i = 0; i < 40 && !isSolved(s); i++) {
    const h = hintFor(s, p.solution)
    assert.ok(h)
    if (h.kind === 'rotate') rotate(s, h.at)
    else {
      assert.ok(canMove(s, h.from, h.to))
      move(s, h.from, h.to)
    }
  }
  assert.equal(isSolved(s), true)
  for (let k = 0; k < 14; k++) assert.ok(generate(rushSpec(k, 99)))
})

test('stars', () => {
  assert.equal(starsFor(5, 5), 3)
  assert.equal(starsFor(30, 5), 1)
})
