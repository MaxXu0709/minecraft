import puppeteer from '/tmp/ppt/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import {pathToFileURL} from 'node:url'
import {readFileSync} from 'node:fs'

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
  assert(typeof mc.makeOrb!=='function' && typeof mc.shootBolt!=='function' && mc.orbs===undefined && mc.bolts===undefined, 'orb and bolt API removed')
  assert(mc.wGolems.length>0, 'white iron golems still spawn '+mc.wGolems.length)
  const help = document.body.innerHTML
  assert(!help.includes('white orbs') && !help.includes('Orbs:'), 'help and HUD do not mention orbs')
  assert(help.includes('white iron golems'), 'white iron golem help remains')
  const bg = mc.bgInfo()
  out.bg = bg
  assert(bg.sky===0x9ccfff && bg.water===0x1d3f9a && bg.cave===0x0e0f14, 'sky and fog colors unchanged '+JSON.stringify(bg))
  assert(bg.hemiSky===0xffffff && bg.hemiGround===0x777788 && Math.abs(bg.hemiInt-0.85)<1e-6, 'hemisphere light unchanged')
  assert(bg.dirColor===0xffffff && Math.abs(bg.dirInt-0.55)<1e-6, 'directional light unchanged')
  mc.setGameTime(500)
  for (let i=0;i<40;i++) await new Promise(r => requestAnimationFrame(r))
  assert(mc.wGolems.length>0, 'white golems remain after time passes')
  assert(!document.body.innerHTML.includes('Orbs:'), 'HUD stays free of orb count')

  const home = {x:mc.P.pos.x, y:mc.P.pos.y, z:mc.P.pos.z}
  mc.syncVerityHud()
  const v0 = mc.verity()
  assert(v0 && Math.hypot(v0.x-home.x, v0.z-home.z)<3, 'Verity spawns beside the player')
  assert(v0.line==="Hi, I'm Verity" && document.getElementById('verityBubble').textContent==="Hi, I'm Verity", 'exact greeting')
  assert(document.getElementById('verityName').textContent==='Verity', 'visible name')
  assert(v0.hp===5 && !v0.carried, 'starts healthy and on the ground')
  mc.P.pos.set(v0.x, v0.y-1.0, v0.z+1.2)
  mc.updVerity(0.05)
  assert(mc.nearVerity() && !mc.nearestKind(), 'beside Verity without reaching a computer')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='craft', 'E near Verity still opens crafting, not chat')
  mc.startPlay()
  assert(mc.openVerityChat()===true && mc.chatOpen(), 'T-equivalent opens chat when nearby')
  const input = document.getElementById('verityInput')
  assert(document.activeElement===input, 'chat focuses the text field')
  input.value = 'How does gravity work?'
  const reply = mc.sendVerityChat()
  assert(/10/.test(reply), 'gravity question gets a local reply: '+reply)
  const panel = document.getElementById('verityChat').textContent
  assert(/not a live AI/i.test(panel) && /Verity:/.test(document.getElementById('verityLog').textContent), 'chat is labeled offline and shows the reply')
  const replyZh = mc.verityReply('重力是什么')
  assert(/10/.test(replyZh), 'Chinese gravity reply')
  const a = mc.verityReply('who are you'), b = mc.verityReply('who are you')
  assert(a!==b, 'repeated questions vary')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW', bubbles:true}))
  assert(!mc.keys().KeyW, 'movement keys are ignored while chat is focused')
  mc.closeVerityChat()
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW', bubbles:true}))
  assert(mc.keys().KeyW, 'movement keys work after chat closes')
  mc.keys().KeyW = false
  mc.P.pos.set(v0.x, v0.y-1.0, v0.z+1.8)
  mc.P.yaw = Math.atan2(-(v0.x-mc.P.pos.x), -(v0.z-mc.P.pos.z))
  mc.P.pitch = -0.25
  mc.updVerity(0.05)
  assert(mc.rayHitsVerity(), 'raycast reaches Verity')
  const hp1 = mc.hitVerity(1)
  assert(hp1===4 && mc.verity().line==="Ouch, why you hit me?" && document.getElementById('verityBubble').textContent==="Ouch, why you hit me?", 'exact hit line and HP')
  assert(mc.toggleCarry(false)==='carry' && mc.verity().carried, 'raycast pickup')
  mc.P.pos.x += 12
  mc.updVerity(0.2)
  assert(Math.hypot(mc.verity().x-mc.P.pos.x, mc.verity().z-mc.P.pos.z)<2, 'carried Verity stays with the player')
  const carriedY = mc.verity().y
  assert(mc.toggleCarry(false)==='drop' && !mc.verity().carried, 'put Verity down')
  const dropped = {x:mc.verity().x, z:mc.verity().z}
  mc.P.pos.z += 10
  mc.updVerity(0.3)
  assert(Math.abs(mc.verity().x-dropped.x)<0.2 && Math.abs(mc.verity().z-dropped.z)<0.2, 'dropped Verity stays put')
  mc.P.pos.set(40.5, 30, 40.5)
  mc.hitVerity(20)
  const v2 = mc.verity()
  assert(v2.hp===5 && v2.line==="Hi, I'm Verity" && Math.hypot(v2.x-mc.P.pos.x, v2.z-mc.P.pos.z)<3, 'death respawns Verity beside the player')
  mc.enableTouch()
  mc.P.pos.set(v2.x, v2.y-1, v2.z)
  mc.updVerity(0.05)
  const talk = document.getElementById('btnTalk')
  const carryBtn = document.getElementById('btnCarry')
  assert(talk && getComputedStyle(talk).display!=='none', 'touch talk button visible')
  talk.click()
  assert(mc.chatOpen(), 'touch talk opens chat')
  mc.closeVerityChat()
  carryBtn.click()
  assert(mc.verity().carried, 'touch carry picks Verity up')
  carryBtn.click()
  assert(!mc.verity().carried, 'touch drop puts Verity down')
  document.body.classList.remove('touch')
  mc.P.pos.set(home.x, home.y, home.z)
  mc.updVerity(0.05)

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

  const B = mc.buildPos()
  assert(B && B.kind==='build' && B.visible!==false, 'build computer placed')
  const sep = Math.hypot(B.x-L.x, B.z-L.z)
  assert(sep>mc.LAP_REACH && sep<6 && B.x>L.x && B.z<spawn.z && L.z<spawn.z, 'computers side by side north of spawn, sep '+sep.toFixed(2))
  mc.P.pos.set((L.x+B.x)/2, L.y, (L.z+B.z)/2)
  mc.updateLapUI()
  assert(mc.nearestKind()==='material', 'exact tie prefers material computer, got '+mc.nearestKind())
  mc.P.pos.set(B.x, B.y, B.z)
  mc.updateLapUI()
  assert(mc.nearestKind()==='build' && !mc.nearLaptop(), 'standing on build computer selects it')
  assert(document.getElementById('lapHint').textContent.includes('建造电脑'), 'hint names the build computer')
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))
  assert(mc.state()==='buildpc', 'E opens construction dialog')
  const bdlg = document.getElementById('buildDlg')
  assert(bdlg && !bdlg.classList.contains('hidden') && bdlg.textContent.includes('建造电脑') && bdlg.textContent.includes('不是材质电脑'), 'dialog identified as construction')
  const sum0 = mc.worldChecksum()
  assert(mc.chooseBuild(false)==='no', 'no returns no')
  assert(mc.state()==='play', 'no closes dialog')
  assert(mc.worldChecksum()===sum0, 'no leaves the whole world unchanged')
  mc.P.pos.set(B.x, B.y, B.z)
  mc.enableTouch()
  mc.updateLapUI()
  const useB = document.getElementById('btnUse')
  assert(useB && useB.textContent.includes('建造') && getComputedStyle(useB).display!=='none', 'touch button names build computer')
  useB.click()
  assert(mc.state()==='buildpc', 'touch opens construction dialog')
  document.getElementById('buildCancel').click()
  assert(mc.state()==='play' && mc.worldChecksum()===sum0, 'cancel leaves world unchanged')

  mc.P.pos.set(spawn.x, spawn.y, spawn.z)
  const startedB = mc.chooseBuild(true)
  assert(startedB===true && mc.buildActive(), 'yes starts construction')
  assert(mc.chooseLaptop(true)===false && mc.xformActive()===false, 'material laptop refused while building')
  assert(mc.chooseBuild(true)===false, 'second construction refused while running')
  assert(mc.finishBuild()===true && !mc.buildActive(), 'construction finishes')
  const rep1 = mc.buildReport()
  out.build1 = rep1
  assert(rep1.count>=30, 'many buildings '+rep1.count)
  for (const t of ['house','tower','hall','chapel']) assert(rep1.by[t]>=4, t+' count '+rep1.by[t])
  const sites = rep1.sites
  assert(sites.some(s=>s.x<mc.SX*0.25) && sites.some(s=>s.x>mc.SX*0.75) && sites.some(s=>s.z<mc.SZ*0.25) && sites.some(s=>s.z>mc.SZ*0.75), 'buildings span distant regions')
  let crowded=0
  for (let i=0;i<sites.length;i++) for (let j=i+1;j<sites.length;j++){
    if (Math.abs(sites[i].x-sites[j].x)<=8 && Math.abs(sites[i].z-sites[j].z)<=8) crowded++
  }
  assert(crowded===0, 'building centers are spaced, crowded '+crowded)
  let spawnHit=0, changed=0
  for (const s of sites){
    if (Math.hypot(s.x-spawn.x, s.z-spawn.z)<16) spawnHit++
    const floor = mc.get(s.x, s.y, s.z)
    if (floor!==mc.AIR && floor!==mc.BEDROCK) changed++
  }
  assert(spawnHit===0, 'spawn neighborhood kept clear')
  assert(changed===sites.length, 'each site has a solid floor block')
  assert(mc.worldChecksum()!==sum0, 'yes changed the world')

  const n1 = rep1.count
  assert(mc.chooseBuild(true)===true, 'repeat construction starts')
  assert(mc.finishBuild()===true, 'repeat construction finishes')
  const rep2 = mc.buildReport()
  out.build2 = {count:rep2.count, by:rep2.by}
  assert(rep2.count>n1 && rep2.count<=rep2.cap, 'repeat adds buildings without passing the cap '+rep2.count)
  let overlap=0
  const s2 = rep2.sites
  for (let i=0;i<s2.length;i++) for (let j=i+1;j<s2.length;j++){
    if (Math.abs(s2[i].x-s2[j].x)<=8 && Math.abs(s2[i].z-s2[j].z)<=8) overlap++
  }
  assert(overlap===0, 'repeat does not stack sites, overlap '+overlap)
  const beforeCap = mc.worldChecksum()
  let guard=0
  while (mc.buildReport().count<mc.buildReport().cap && guard++<4){
    const r = mc.chooseBuild(true)
    if (r!==true) break
    mc.finishBuild()
  }
  const atCap = mc.buildReport().count>=mc.buildReport().cap
  const sumCap = mc.worldChecksum()
  const capped = mc.chooseBuild(true)
  if (atCap){
    assert(capped==='cap', 'full computer refuses another wave')
    assert(mc.worldChecksum()===sumCap, 'refused wave does not change blocks')
  } else {
    assert(capped==='cap' || capped===true || capped==='no', 'extra wave result '+capped)
    out.capNote = 'cap not reached '+mc.buildReport().count
  }
  out.buildFinal = mc.buildReport().count

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
  mc.wipeWorld()
  assert(mc.worldWrecked() && mc.buildPos() && mc.buildPos().visible===false, 'wipe hides the build computer')
  assert(mc.verity() && mc.verity().hp===5 && Math.hypot(mc.verity().x-mc.P.pos.x, mc.verity().z-mc.P.pos.z)<3, 'Verity returns beside the player after the world wipe')
  assert(mc.nearestKind()===null, 'neither computer is usable after a world wipe')
  mc.newWorld()
  const genT = performance.now()
  while (!mc.genReady()) {
    if (performance.now()-genT>45000) break
    await new Promise(r => requestAnimationFrame(r))
  }
  assert(mc.genReady(), 'new world finished')
  const L2 = mc.laptopPos(), B2 = mc.buildPos()
  assert(L2 && B2 && B2.visible!==false && Math.hypot(L2.x-B2.x, L2.z-B2.z)>mc.LAP_REACH, 'new world respawns both computers')
  assert(mc.buildReport().count===0, 'construction list resets with the world')
  assert(mc.verity() && mc.verity().line==="Hi, I'm Verity" && Math.hypot(mc.verity().x-mc.P.pos.x, mc.verity().z-mc.P.pos.z)<3, 'new world greets with Verity beside the player')
  assert(mc.SX===512 && mc.SY===40 && mc.SZ===1024, 'map size unchanged')
  out.spawn = spawn
  out.laptop = L
  out.villages = mc.villages().length
  out.shafts = mc.stats.shafts
  out.caves = mc.stats.caveCells
  return out
})

await page.evaluate(async () => {
  const mc = window.__mc
  mc.setNoLock(); mc.startPlay()
  const bury = e => { if (e && e.pos) e.pos.y = -40 }
  mc.npcs.forEach(bury); mc.zombies.forEach(bury); mc.wGolems.forEach(bury); mc.creepers.forEach(bury)
  document.body.classList.remove('touch')
  const L = mc.laptopPos(), B = mc.buildPos()
  mc.P.pos.set((L.x+B.x)/2, L.y+0.05, L.z+3.6)
  mc.P.vel.set(0,0,0)
  mc.P.yaw = Math.atan2(-((L.x+B.x)/2 - mc.P.pos.x), -(L.z - mc.P.pos.z))
  mc.P.pitch = -0.2
  mc.updateLapUI()
  for (let i=0;i<8;i++) await new Promise(r => requestAnimationFrame(r))
})
await page.screenshot({path: shots+'/two-computers.png'})
await page.evaluate(() => {
  const mc = window.__mc
  const B = mc.buildPos()
  mc.P.pos.set(B.x, B.y, B.z)
  mc.updateLapUI()
  mc.openBuild()
})
await page.screenshot({path: shots+'/build-dialog.png'})
await page.evaluate(async () => {
  const mc = window.__mc
  mc.closeVerityChat()
  mc.startPlay()
  mc.setNoLock()
  const v = mc.verity()
  mc.P.pos.set(v.x, v.y-1.0, v.z+2.4)
  mc.P.yaw = Math.atan2(-(v.x-mc.P.pos.x), -(v.z-mc.P.pos.z))
  mc.P.pitch = 0.05
  mc.syncVerityHud()
  for (let i=0;i<6;i++) await new Promise(r => requestAnimationFrame(r))
})
await page.screenshot({path: shots+'/verity-greeting.png'})
await page.evaluate(() => {
  const mc = window.__mc
  const v = mc.verity()
  mc.P.pos.set(v.x, v.y-1.0, v.z+0.4)
  mc.openVerityChat()
})
await page.screenshot({path: shots+'/verity-chat.png'})

const src = readFileSync('/workspace/index.html', 'utf8')
const srcFails = []
for (const bad of ['makeOrb', 'spawnOrb', 'updOrbs', 'updBolts', 'white orbs', 'shootBolt']) {
  if (src.includes(bad)) srcFails.push('source still has '+bad)
}
if (!src.includes('HemisphereLight(0xffffff,0x777788,.85)') || !src.includes('0x9ccfff') || !src.includes('white iron golems')) srcFails.push('background or white golem text missing')
console.log(JSON.stringify({result, logs: logs.slice(0,20), old: OLD, srcFails}, null, 2))
if (srcFails.length) process.exit(1)
await browser.close()
if (result.fails.length) process.exit(1)
