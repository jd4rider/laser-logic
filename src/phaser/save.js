const KEY = 'laser-logic-save-v1'

const defaults = () => ({ unlocked: 1, stars: {}, bestRush: 0, muted: false })

function load() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return defaults()
  }
}

export const data = load()

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage unavailable (private mode) — progress just won't persist
  }
}
