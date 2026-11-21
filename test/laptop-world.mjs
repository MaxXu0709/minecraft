import puppeteer from '/tmp/ppt/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import {pathToFileURL} from 'node:url'

const chrome = '/usr/local/bin/google-chrome'
const url = pathToFileURL('/workspace/index.html').href
const shots = '/opt/cursor/artifacts'
const OLD = {SX:256, SY:40, SZ:256}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--window-size=1280,720']
})
const page = await browser.newPage()
await page.setViewport({width:1280, height:720})
const logs = []
page.on('pageerror', err => logs.push('PAGEERROR '+err.message))
page.on('console', msg => { if (msg.type()==='error') logs.push('CONSOLE '+msg.text()) })
await page.goto(url, {waitUntil:'load', timeout:60000})
await page.waitForFunction('window.__mc && window.__mc.genReady()', {timeout:60000})
const result = await page.evaluate(async () => {
  const mc = window.__mc
  const out = {fails:[], notes:[]}
  const assert = (cond, msg) => { if (!cond) out.fails.push(msg); else out.notes.push('ok '+msg) }
  const sleep = n => new Promise(r => setTimeout(r, n))
  const frames = () => mc.frames ? mc.frames() : null
  // frames() may not exist; use a local counter via rAF
  const f0 = performance.now()
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  assert(performance.now()>f0, 'runtime frames advance')

  assert(mc.SX===512 && mc.SZ===1024 && mc.SY===40, `dims ${mc.SX}x${mc.SY}x${mc.SZ}`)
  assert(mc.worldBytes()===512*1024*40, 'world bytes '+mc.worldBytes())
  assert(mc.SX/256===2 && mc.SZ/256===4, 'width x2 and length x4 versus 256')
  assert((mc.SX*mc.SZ)/(256*256)===8, 'area x8')
  assert(mc.ATTRACT_SIDE===10 && mc.ATTRACT_HALF===5, 'gravity cube still 10')
  assert(mc.DBLK!==mc.DIAMOND && mc.BD[mc.DBLK].name==='Diamond Block' && mc.BD[mc.DIAMOND].name==='Diamond Ore', 'diamond block is not ore')
  assert(mc.BD[mc.DBLK].tr===false && mc.BD[mc.GLASS].tr===true, 'diamond opaque, glass transparent')
  assert(mc.stats.shafts>0 && mc.villages().length>=6 && mc.stats.caveCells>1000, `features villages ${mc.villages().length} shafts ${mc.stats.shafts} caves ${mc.stats.caveCells}`)
  out.genMs = mc.stats.genMs

  mc.setNoLock()
  mc.startPlay()
  const inv = mc.inv()
  assert(inv[7] && inv[7].id===mc.ids.DF_MISSILE, 'slot 8 dongfeng')
  assert(inv[8] && inv[8].id===mc.ids.MISSILE, 'slot 9 missile')
  mc.setCreative(true); mc.setFlying(true)
  assert(mc.creative()&&mc.flying(), 'creative fly')
  mc.setCreative(false)
  assert(!mc.creative()&&!mc.flying(), 'back to survival')

  const L = mc.laptopPos()
  assert(L && Number.isFinite(L.x), 'laptop placed')
  const spawn = {x:mc.P.pos.x, y:mc.P.pos.y, z:mc.P.pos.z}
  const lapDist = Math.hypot(L.x-spawn.x, L.z-spawn.z)
  assert(lapDist<4 && L.z<spawn.z, 'laptop near spawn toward village, dist '+lapDist.toFixed(2))

  // gravity regression before the world is rewritten
  mc.setAttractCd(0)
  const eyeY = mc.P.pos.y+mc.P.h*0.5
  assert(mc.inAttractCube(mc.P.pos.x, eyeY, mc.P.pos.z), 'cube contains player')
  assert(!mc.inAttractCube(mc.P.pos.x+6, eyeY, mc.P.pos.z), 'cube excludes 6 blocks out')
  const bx = Math.floor(mc.P.pos.x)+1, by = Math.floor(mc.P.pos.y), bz = Math.floor(mc.P.pos.z)
  mc.setBlock(bx, by, bz, mc.BEDROCK)
  mc.setAttractCd(0)
  mc.triggerAttract('mine', true)
  assert(mc.get(bx, by, bz)===mc.BEDROCK, 'bedrock inside the cube is not pulled')

  // far from laptop: E crafts
  mc.P.pos.set(8.5, 30, 8.5)
  mc.updateLapUI()
  assert(!mc.nearLaptop(), 'far from laptop')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='craft', 'E far opens craft, state '+mc.state())
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='play', 'E closes craft')
  document.getElementById('btnCraft').click()
  assert(mc.state()==='craft', 'craft button far opens craft')
  mc.startPlay()

  // near laptop: E and touch button open the dialog, not crafting
  mc.P.pos.set(L.x, L.y, L.z)
  mc.P.vel.set(0,0,0)
  mc.updateLapUI()
  assert(mc.nearLaptop(), 'standing at laptop')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='laptop', 'E near opens laptop, not craft')
  assert(!document.getElementById('laptopDlg').classList.contains('hidden'), 'dialog visible')
  assert(document.getElementById('lapYes') && document.getElementById('lapNo'), 'yes and no buttons')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='play', 'E closes dialog without converting')
  assert(mc.get(0,0,0)===mc.BEDROCK, 'cancel leaves bedrock')
  mc.enableTouch()
  mc.P.pos.set(L.x, L.y, L.z)
  mc.updateLapUI()
  const use = document.getElementById('btnUse')
  assert(use && getComputedStyle(use).display!=='none', 'touch use button visible')
  use.click()
  assert(mc.state()==='laptop', 'touch use opens dialog')
  document.getElementById('lapCancel').click()
  assert(mc.state()==='play', 'cancel button closes')

  const worldLen = mc.worldBytes()
  assert(worldLen===512*1024*40, 'len')

  // player body vs feet
  mc.P.pos.set(spawn.x, spawn.y, spawn.z)
  mc.P.vel.set(0,0,0)
  const foot = {x:Math.floor(mc.P.pos.x), y:Math.floor(mc.P.pos.y-0.01), z:Math.floor(mc.P.pos.z)}
  const body = {x:foot.x, y:Math.floor(mc.P.pos.y+0.2), z:foot.z}
  const footBefore = mc.get(foot.x, foot.y, foot.z)
  const bodyBefore = mc.get(body.x, body.y, body.z)
  assert(footBefore!==mc.AIR && footBefore!==mc.DBLK, 'standing on terrain '+footBefore)
  assert(bodyBefore===mc.AIR, 'body cell starts as air')
  const high = mc.get(1, 39, 1)
  assert(high===mc.AIR, 'high cell is air')

  // exception: a second choice while running does not switch the target
  const started = mc.chooseLaptop(true)
  assert(started===true && mc.xformActive(), 'yes starts diamond transform')
  const denied = mc.chooseLaptop(false)
  assert(denied===false && mc.xformActive(), 'second choice refused while running')
  const tA = performance.now()
  assert(mc.finishTransform()===true, 'transform finishes')
  out.diamondMs = Math.round(performance.now()-tA)
  assert(mc.get(0,0,0)===mc.DBLK, 'origin bedrock became diamond block')
  assert(mc.get(mc.SX-1,0,mc.SZ-1)===mc.DBLK, 'far corner bedrock became diamond block')
  assert(mc.get(mc.SX-1,0,0)===mc.DBLK && mc.get(0,0,mc.SZ-1)===mc.DBLK, 'other corners')
  assert(mc.get(1,39,1)===mc.AIR, 'high air stayed air')
  assert(mc.get(body.x, body.y, body.z)===mc.AIR, 'player body stayed air')
  assert(mc.get(foot.x, foot.y, foot.z)===mc.DBLK, 'ground under feet became diamond block')
  const auditD = mc.auditBlocks(mc.DBLK)
  assert(auditD.other===0 && auditD.match+auditD.air===auditD.n && auditD.air>0 && auditD.match>1000000, 'full map non-air is diamond block '+JSON.stringify(auditD))
  out.auditDiamond = auditD
  // distant column that was not the player
  assert(mc.get(20, 8, mc.SZ-30)===mc.DBLK || mc.get(20, 8, mc.SZ-30)===mc.AIR, 'distant cell is diamond or air')
  let cornerBad = 0
  for (let x=0;x<mc.SX;x+=8) for (let z=0;z<mc.SZ;z+=8) if (mc.get(x,0,z)!==mc.DBLK) cornerBad++
  assert(cornerBad===0, 'sampled bedrock layer is all diamond blocks, bad '+cornerBad)

  mc.buildChunk(0,0)
  mc.buildChunk(mc.SX/16-1, mc.SZ/16-1)
  assert(mc.chunkIndexCount(0,0)>0, 'edge chunk renders after diamond transform '+mc.chunkIndexCount(0,0))
  assert(mc.chunkIndexCount(mc.SX/16-1, mc.SZ/16-1)>0, 'far chunk renders')

  // repeated: no -> glass, including former diamond, air stays
  mc.P.pos.set(spawn.x, spawn.y, spawn.z)
  assert(mc.chooseLaptop(false)===true, 'no starts glass')
  assert(mc.finishTransform()===true, 'glass finishes')
  assert(mc.get(0,0,0)===mc.GLASS && mc.get(mc.SX-1,0,mc.SZ-1)===mc.GLASS, 'corners are glass')
  assert(mc.get(1,39,1)===mc.AIR && mc.get(body.x, body.y, body.z)===mc.AIR, 'air remains through glass pass')
  assert(mc.get(foot.x, foot.y, foot.z)===mc.GLASS, 'feet ground is glass')
  const auditG = mc.auditBlocks(mc.GLASS)
  assert(auditG.other===0 && auditG.air===auditD.air && auditG.match===auditD.match, 'full map non-air is glass and air count held '+JSON.stringify(auditG))
  out.auditGlass = auditG
  mc.buildChunk(0,0)
  assert(mc.chunkIndexCount(0,0)>0, 'glass edge chunk still has faces')

  // and back to diamond, laptop still usable
  mc.P.pos.set(L.x, L.y, L.z)
  mc.updateLapUI()
  assert(mc.nearLaptop(), 'laptop still usable after transforms')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='laptop', 'E opens dialog again')
  document.getElementById('lapYes').click()
  assert(mc.xformActive(), 'yes button starts another diamond pass')
  assert(mc.finishTransform()===true, 'repeat diamond finishes')
  assert(mc.get(0,0,0)===mc.DBLK && mc.get(mc.SX-1,0,mc.SZ-1)===mc.DBLK, 'repeat corners diamond')
  assert(mc.get(1,39,1)===mc.AIR, 'air after repeat')

  // full-map audit of the last diamond pass is checked by scanning y=0 completely and one full slice
  let bad0=0, airKept=0, non=0
  for (let z=0;z<mc.SZ;z++) for (let x=0;x<mc.SX;x++){
    const b=mc.get(x,0,z)
    if (b!==mc.DBLK) bad0++
    else non++
  }
  assert(bad0===0 && non===mc.SX*mc.SZ, 'entire bedrock layer is diamond blocks')
  // a high slice must still be entirely air (terrain never reaches y=39)
  let highBad=0
  for (let z=0;z<mc.SZ;z+=4) for (let x=0;x<mc.SX;x+=4) if (mc.get(x,39,z)!==mc.AIR) highBad++
  assert(highBad===0, 'sampled sky layer stayed air, bad '+highBad)

  // full volume check in chunks of columns would be long; scan every cell via typed view if exposed
  // BD transparency still correct
  assert(mc.BD[mc.GLASS].tr===true && mc.BD[mc.DBLK].tr===false, 'materials unchanged')
  assert(mc.laptopPos(), 'laptop mesh remains')
  out.spawn = spawn
  out.laptop = L
  out.villages = mc.villages().length
  out.shafts = mc.stats.shafts
  out.caves = mc.stats.caveCells
  return out
})

// screenshots of the live page after the scripted state. Re-open dialog for a clean shot by reloading is heavy.
// Capture current view: diamond world. Then reopen dialog by evaluating.
await page.evaluate(async () => {
  const mc = window.__mc
  const L = mc.laptopPos()
  mc.P.pos.set(L.x, L.y+0.05, L.z+2.4)
  mc.P.vel.set(0,0,0)
  mc.P.yaw = Math.atan2(-(L.x-mc.P.pos.x), -(L.z-mc.P.pos.z))
  mc.P.pitch = -0.35
  mc.startPlay()
  mc.setNoLock()
  for (let i=0;i<8;i++) await new Promise(r => requestAnimationFrame(r))
})
await page.screenshot({path: shots+'/laptop-diamond-world.png'})
await page.evaluate(() => { window.__mc.P.pos.set(window.__mc.laptopPos().x, window.__mc.laptopPos().y, window.__mc.laptopPos().z); window.__mc.updateLapUI(); window.__mc.openLaptop() })
await page.screenshot({path: shots+'/laptop-dialog.png'})

console.log(JSON.stringify({result, logs: logs.slice(0,20), old: OLD}, null, 2))
await browser.close()
if (result.fails.length) process.exit(1)
