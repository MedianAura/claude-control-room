import type { Register, EngineInterface } from 'claude-code'

// Jauge de contexte (0.4.0). Seul un module de mod voit le % que la statusline affiche ($.session.usage()) ;
// les hooks classiques ne l'ont pas. On le pousse au serveur par la CLI du plugin (son client HTTP et son secret).
//
// Déclencheurs : turn.complete (fin de tour) + une minuterie de repli, car cc-plugin-sec-default saute
// session.append et prompt.compose des autres mods ; une minuterie, rien ne l'intercepte.
// Paliers de 5 points : on ne lance node que quand le palier change (40 et 70 en sont), sinon rien.
const STEP = 5
const EVERY_MS = 60_000

let lastBucket = -1
let timerStarted = false

async function report($: EngineInterface) {
  try {
    const { context } = await $.session.usage()
    if (context.percent === undefined) return // session neuve ou juste compactée : pas encore de mesure
    const bucket = Math.floor(context.percent / STEP)
    if (bucket === lastBucket) return
    lastBucket = bucket
    const session_id = await $.session.id()
    await $.process.run(['node', `${$.plugin.root}/bin/control-room.js`, 'hook', 'context'], {
      stdin: JSON.stringify({ session_id, context_pct: context.percent }),
      timeoutMs: 10_000,
    })
  } catch {
    lastBucket = -1 // serveur absent ou erreur : on réessaiera au prochain déclencheur
  }
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!timerStarted) {
      timerStarted = true
      $.clock.every(EVERY_MS, () => report($))
    }
    await report($)
    return r
  })
}
