import Phaser from 'phaser';
import './style.css';
import arenaUrl from '../assets/processed/arena_empty.png?url';
import shipUrl from '../assets/processed/pirate_ship.png?url';
import islandUrl from '../assets/processed/fort_island.png?url';
import cannonUrl from '../assets/processed/cannon_barrel.png?url';
import { AudioEngine } from './audio';
import { difficultyConfig, effectsConfig, TUNING, WORLD, type Difficulty, type EffectId } from './config';
import { Run, type GameEvent, type Pickup } from './model';
import { COAST, nearestShore, safeWater, type Vec } from './physics';

type Screen='menu'|'difficulty'|'info'|'play'|'pause'|'results';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const audio=new AudioEngine();
let screen:Screen='menu',run:Run|undefined,scene:Sea,debug=false;
let accumulator=0,uiAt=0,deathDelay=0;
const keys=new Set<string>();
let touch:Vec={x:0,y:0},mouse:Vec|undefined;
let lastAngle:Partial<Record<Difficulty,number>>={};
function best(mode:Difficulty) { try{return Number(localStorage.getItem(`escape.best.${mode}`))||0;}catch{return 0;} }
function saveBest() { if(run)try{localStorage.setItem(`escape.best.${run.mode}`,String(Math.max(run.score,best(run.mode))))}catch{/* No storage in some private browsers. */} }
const button=(id:string,text:string,cls='')=>`<button id="${id}" class="action ${cls}">${text}</button>`;
function bind(id:string,fn:()=>void) { $(id)?.addEventListener('click',()=>{audio.unlock();fn();}); }
function audioButtons(withDebug=false) { return `<div class="split">${button('music',`Music ${audio.musicMuted?'off':'on'}`,'small subtle')}${button('sfx',`Sound ${audio.sfxMuted?'off':'on'}`,'small subtle')}${withDebug?button('debug',`Collision ${debug?'on':'off'}`,'small subtle'):''}</div>`; }
function show(next:Screen) {
  screen=next;keys.clear();touch={x:0,y:0};mouse=undefined;resetStick();accumulator=0;
  document.body.classList.toggle('playing',next==='play');
  $('hud').hidden=!['play','pause','results'].includes(next);
  $('pause').hidden=next!=='play';
  audio.setMode(next==='play'?'sail':'calm');
  const layer=$('screen');
  if(next==='play'){layer.innerHTML='';updateHud();return;}
  let content='';
  if(next==='menu')content=`<p class="eyebrow">A pirate survival arcade</p><h1 class="brand">ESCAPE<span>FORTUNE FAVOURS THE AFLOAT</span></h1><p>One ship. One hit. A sea full of trouble.<br>Outsail the cannon. Make off with the gold.</p><div class="buttons">${button('play','Set sail →','primary')}${button('info','How to play','subtle')}</div>${audioButtons()}<div class="fineprint">WASD / ARROWS · TOUCH HELM · LANDSCAPE</div>`;
  if(next==='difficulty')content=`<p class="eyebrow">Choose your waters</p><h2>How brave, captain?</h2><div class="difficulty-grid">${(['Easy','Medium','Hard'] as Difficulty[]).map((mode,i)=>`<button id="choose-${mode}" class="action ${mode.toLowerCase()}"><strong>${mode}</strong><span>${['A gentle start','Keep your wits','All hands on deck'][i]}<br>${difficultyConfig[mode].volley} ${i?'quickfire balls':'opening ball'} · ${difficultyConfig[mode].interval}s fire<br>Best ${best(mode).toLocaleString()}</span></button>`).join('')}</div><p>The cannon fires faster as you survive.</p>${button('back','← Back to port','small subtle')}`;
  if(next==='info')content=`<p class="eyebrow">Captain’s orders</p><h2>Keep your ship afloat.</h2><div class="info-grid"><ul class="rules"><li><b>Steer</b> with WASD / arrows, the touch helm, or hold the water with your mouse.</li><li><b>One hit sinks you.</b> Balls ricochet forever and fly over the fort. Sail around it.</li><li><b>Score:</b> 10 / second, 50 / coin, +20 / green, −20 / red. Double score earns 2× new points.</li><li><b>10-second effects.</b> Repeats refresh; opposites multiply. Parley clears every ball.</li></ul><div class="token-guide">${Object.values(effectsConfig).map(e=>`<div class="${e.positive?'':'bad'}"><b>${e.icon}</b>${e.label}</div>`).join('')}</div></div><div class="fineprint">P / ESC PAUSE · B COLLISION VIEW</div>${button('back','← Back to port','small primary')}`;
  if(next==='pause')content=`<p class="eyebrow">Anchor dropped</p><h2>A moment in port.</h2><p>The sea can wait. Your voyage is paused.</p><div class="buttons">${button('resume','Resume voyage →','primary')}<div class="split">${button('retry','Restart','small')}${button('home','Main menu','small subtle')}</div></div>${audioButtons(true)}`;
  if(next==='results'&&run)content=`<p class="eyebrow">${run.mode} waters · Voyage over</p><h2>Lost to the deep.</h2><p>A bold run, captain. The sea keeps its gold.</p><div class="results"><div><span>SCORE</span><b>${run.score.toLocaleString()}</b></div><div><span>TIME</span><b>${run.elapsed.toFixed(1)}s</b></div><div><span>COINS</span><b>${run.coins}</b></div></div><div class="best">PERSONAL BEST · ${best(run.mode).toLocaleString()} · ${run.positives} boons / ${run.negatives} curses</div><div class="buttons">${button('retry','Sail again →','primary')}<div class="split">${button('levels','Change difficulty','small')}${button('home','Main menu','small subtle')}</div></div>`;
  layer.innerHTML=`<section class="panel" aria-label="${next}">${content}</section>`;
  bind('play',()=>show('difficulty'));bind('info',()=>show('info'));bind('back',()=>show('menu'));
  for(const mode of ['Easy','Medium','Hard'] as Difficulty[])bind(`choose-${mode}`,()=>start(mode));
  bind('resume',()=>show('play'));bind('home',()=>{run=undefined;scene?.clearFX();show('menu')});
  bind('retry',()=>start(run?.mode??'Easy'));bind('levels',()=>{run=undefined;show('difficulty')});
  bind('debug',()=>{debug=!debug;show('pause')});
  bind('music',()=>{audio.toggle('music');$('music').textContent=`Music ${audio.musicMuted?'off':'on'}`});
  bind('sfx',()=>{audio.toggle('sfx');$('sfx').textContent=`Sound ${audio.sfxMuted?'off':'on'}`});
}
function start(mode:Difficulty) {
  run=new Run(mode);
  // Protect against immediately repeated angles as well as seeded replay patterns.
  if(lastAngle[mode]!==undefined && Math.abs(run.angle-lastAngle[mode]!)<0.18)run.angle=(run.angle+0.7)%(Math.PI*2);
  run.initialAngle=run.angle;lastAngle[mode]=run.angle;
  accumulator=0;deathDelay=0;scene.clearFX();show('play');
}
function updateHud() {
  if(!run)return;
  $('time').textContent=run.elapsed.toFixed(1);$('coins').textContent=String(run.coins);$('score').textContent=run.score.toLocaleString();
  $('mode-tag').textContent=run.mode+(debug?' · DEBUG':'');
  $('effects').innerHTML=(Object.keys(run.effects) as EffectId[]).map(id=>`<span class="effect-pill ${effectsConfig[id].positive?'':'bad'}">${effectsConfig[id].icon} ${effectsConfig[id].label} ${Math.max(0,Math.ceil(run!.effects[id]!-run!.elapsed))}s</span>`).join('');
}
function getInput():Vec {
  let x=0,y=0;
  if(keys.has('a')||keys.has('arrowleft'))x--;if(keys.has('d')||keys.has('arrowright'))x++;
  if(keys.has('w')||keys.has('arrowup'))y--;if(keys.has('s')||keys.has('arrowdown'))y++;
  if(x||y)return{x,y};
  if(Math.hypot(touch.x,touch.y)>0.05)return touch;
  if(mouse&&run){const dx=mouse.x-run.ship.x,dy=mouse.y-run.ship.y,d=Math.hypot(dx,dy);if(d>8)return{x:dx/d*Math.min(1,d/80),y:dy/d*Math.min(1,d/80)};}
  return{x:0,y:0};
}
interface FX extends Vec { kind:'wake'|'shot'|'coin'|'positive'|'negative'|'death'|'bounce'; life:number; max:number; text?:string; angle?:number }
class Sea extends Phaser.Scene {
  private ship!:Phaser.GameObjects.Image;private cannon!:Phaser.GameObjects.Image;
  private ink!:Phaser.GameObjects.Graphics;private collision!:Phaser.GameObjects.Graphics;
  private tokens=new Map<number,Phaser.GameObjects.Container>();private fx:FX[]=[];
  private labels:{label:Phaser.GameObjects.Text;life:number;max:number}[]=[];
  private wakeAt=0;
  constructor(){super('Sea')}
  preload(){this.load.image('arena',arenaUrl);this.load.image('ship',shipUrl);this.load.image('island',islandUrl);this.load.image('cannon',cannonUrl)}
  create(){
    scene=this;
    this.add.image(0,0,'arena').setOrigin(0).setDisplaySize(WORLD.width,WORLD.height);
    this.textures.get('ship').add('trimmed',0,0,107,178,188);
    this.add.image(TUNING.island.x,TUNING.island.y,'island').setOrigin(120/261,112/228);
    this.cannon=this.add.image(TUNING.island.x,TUNING.island.y,'cannon').setOrigin(57/75,65/81).setScale(1.3);
    this.ink=this.add.graphics();
    this.ship=this.add.image(1410,770,'ship','trimmed').setScale(TUNING.shipArtScale);
    this.collision=this.add.graphics().setDepth(10);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(screen==='play'&&p.wasTouch===false){mouse={x:p.worldX,y:p.worldY};audio.unlock();}});
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(mouse&&p.isDown)mouse={x:p.worldX,y:p.worldY};});
    this.input.on('pointerup',()=>{mouse=undefined;});
    show('menu');
  }
  clearFX(){this.fx=[];this.labels.forEach(l=>l.label.destroy());this.labels=[];this.tokens.forEach(t=>t.destroy());this.tokens.clear();this.wakeAt=0;}
  private event(e:GameEvent){
    if(e.type!=='bounce')audio.play(e.type);
    const max=e.type==='death'?0.8:e.type==='shot'?0.15:e.type==='bounce'?0.12:0.35;
    this.fx.push({...e,kind:e.type,life:max,max});
    if(e.text){
      const text=this.add.text(Math.max(270,Math.min(1650,e.x)),Math.max(250,e.y-90),e.text,{fontFamily:'Georgia',fontSize:'29px',fontStyle:'bold',color:e.type==='negative'?'#ffd0ae':'#fff6ae',stroke:'#134352',strokeThickness:6}).setOrigin(.5).setDepth(8);
      this.labels.push({label:text,life:1.35,max:1.35});
    }
    if(e.type==='death'){saveBest();deathDelay=0.8;this.cameras.main.shake(220,0.004);}
  }
  private token(p:Pickup) {
    const c=this.add.container(p.x,p.y),g=this.add.graphics();
    const coin=p.kind==='coin',positive=!coin&&effectsConfig[p.kind as EffectId].positive;
    const rim=coin?0xf5c13b:positive?0x54d286:0xec7760;
    g.fillStyle(0x004b78,.32).fillEllipse(3,7,64,64);
    g.fillStyle(0x764221).fillCircle(0,0,29);g.fillStyle(rim).fillCircle(0,-2,27);
    g.lineStyle(3,coin?0xfff299:0xf9e5a5).strokeCircle(0,-2,23);
    if(!coin){g.lineStyle(1,0xffe3a2,.65);for(let i=0;i<8;i++){const a=i*Math.PI/4;g.lineBetween(Math.cos(a)*17,Math.sin(a)*17-2,Math.cos(a)*22,Math.sin(a)*22-2)}}
    const icon=this.add.text(0,-3,coin?'☠':effectsConfig[p.kind as EffectId].icon,{fontFamily:'Georgia',fontSize:coin?'30px':'26px',fontStyle:'bold',color:coin?'#fff0a0':'#15464a'}).setOrigin(.5);
    c.add([g,icon]);this.tokens.set(p.id,c);return c;
  }
  update(_time:number,delta:number){
    audio.update();const dt=Math.min(delta/1000,0.1);
    if(screen==='play'&&run&&!run.dead){
      accumulator+=dt;
      while(accumulator>=TUNING.fixedStep&&!run.dead){run.step(TUNING.fixedStep,getInput());accumulator-=TUNING.fixedStep;}
      if(run.elapsed>=this.wakeAt&&Math.hypot(getInput().x,getInput().y)>0.1){this.wakeAt=run.elapsed+.055;this.fx.push({x:run.ship.x-Math.cos(run.heading)*60*run.size,y:run.ship.y-Math.sin(run.heading)*60*run.size,kind:'wake',life:.65,max:.65});}
    }
    if(run){for(const e of run.events)this.event(e);run.events=[];}
    if(screen==='play'&&run?.dead){deathDelay-=dt;if(deathDelay<=0){show('results');updateHud();}}
    if(screen!=='pause'){
      this.fx.forEach(f=>f.life-=dt);this.fx=this.fx.filter(f=>f.life>0);
      this.labels.forEach(l=>{l.life-=dt;l.label.y-=dt*40;l.label.alpha=Math.min(1,l.life*3)});
      this.labels=this.labels.filter(l=>{if(l.life<=0){l.label.destroy();return false}return true});
    }
    const r=run;
    this.ship.setVisible(!!r&&!r.dead);this.cannon.rotation=(r?.angle??_time*.00013)-Math.atan2(-50,-40);
    if(r){this.ship.setPosition(r.ship.x,r.ship.y).setRotation(r.heading+Math.PI/2).setScale(TUNING.shipArtScale*r.size);}
    for(const [id,t]of this.tokens)if(!r?.pickups.some(p=>p.id===id)){t.destroy();this.tokens.delete(id);}
    if(r)for(const p of r.pickups){const t=this.tokens.get(p.id)??this.token(p),phase=r.elapsed-p.born;t.y=p.y+Math.sin(phase*6)*4;t.setScale(1+Math.sin(phase*5)*.06);t.alpha=Math.min(1,(p.expires-r.elapsed)*2);}
    this.ink.clear();
    for(const f of this.fx){
      const a=f.life/f.max,t=1-a;
      if(f.kind==='wake'){this.ink.lineStyle(2,0xcdfaff,a*.6);this.ink.strokeCircle(f.x,f.y,5+t*16);}
      else if(f.kind==='death'){
        for(let i=0;i<12;i++){const angle=i*Math.PI/6;this.ink.fillStyle(i%2?0xffcc55:0xff6f31,a);this.ink.fillCircle(f.x+Math.cos(angle)*t*140,f.y+Math.sin(angle)*t*140,5+a*22);}
        this.ink.lineStyle(5,0xffeb8e,a).strokeCircle(f.x,f.y,20+t*160);
      }else if(f.kind==='shot'){
        const a2=f.angle??run?.angle??0,x=TUNING.island.x+Math.cos(a2)*103,y=TUNING.island.y+Math.sin(a2)*103;
        this.ink.fillStyle(0xffd674,a).fillCircle(x,y,15+t*16);this.ink.fillStyle(0xfff6d5,a).fillCircle(x,y,8+t*12);
      }else{this.ink.lineStyle(3,f.kind==='negative'?0xffa889:0xffec9b,a).strokeCircle(f.x,f.y,20+t*35);}
    }
    if(r)for(const b of r.balls){this.ink.fillStyle(0x002c60,.35).fillCircle(b.x+4,b.y+7,TUNING.ballRadius+2);this.ink.fillStyle(0x192f42).fillCircle(b.x,b.y,TUNING.ballRadius);this.ink.lineStyle(2,0x738496).strokeCircle(b.x,b.y,TUNING.ballRadius-1);this.ink.fillStyle(0xb2c6cc).fillCircle(b.x-4,b.y-4,3);}
    this.collision.clear();
    if(debug){
      this.collision.lineStyle(3,0x89ff8a).strokePoints(COAST,true);
      this.collision.lineStyle(3,0xffd859).strokeCircle(TUNING.island.x,TUNING.island.y,TUNING.island.radius);
      if(r){this.collision.lineStyle(3,0xffffff).strokeCircle(r.ship.x,r.ship.y,TUNING.shipShoreRadius*r.size);
        const h=TUNING.shipHullHalfLength*r.size,dx=Math.cos(r.heading)*h,dy=Math.sin(r.heading)*h;
        this.collision.lineStyle(TUNING.shipHullRadius*r.size*2,0xff5eac,.4).lineBetween(r.ship.x-dx,r.ship.y-dy,r.ship.x+dx,r.ship.y+dy);
        for(const b of r.balls)this.collision.lineStyle(2,0xff88ff).strokeCircle(b.x,b.y,TUNING.ballRadius);
      }
    }
    uiAt+=delta;if(uiAt>80&&r){updateHud();uiAt=0;}
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:WORLD.width,height:WORLD.height,backgroundColor:'#0874e7',scene:Sea,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,roundPixels:false},input:{activePointers:3},audio:{noAudio:true}});

$('pause').addEventListener('click',()=>{audio.unlock();if(screen==='play'&&!run?.dead)show('pause')});
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(e.repeat)return;
  if(k==='escape'||k==='p'){if(screen==='play'&&!run?.dead)show('pause');else if(screen==='pause')show('play');return;}
  // D remains steering; B or the pause menu toggles collision calibration.
  if(k==='b'){debug=!debug;return;}
  keys.add(k);document.body.classList.add('keyboard');audio.unlock();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(screen==='play'&&!run?.dead)show('pause')});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='play'&&!run?.dead)show('pause')});
function orientationGuard(){if(matchMedia('(orientation: portrait) and (max-width: 1000px)').matches&&screen==='play'&&!run?.dead)show('pause')}
window.addEventListener('resize',orientationGuard);
const joystick=$('joystick'),stick=$('stick');let stickPointer:number|undefined;
function resetStick(){if(stick){stick.style.transform='';}stickPointer=undefined;touch={x:0,y:0};}
function moveStick(e:PointerEvent){
  const box=joystick.getBoundingClientRect(),radius=box.width*.36;
  let dx=e.clientX-(box.left+box.width/2),dy=e.clientY-(box.top+box.height/2),d=Math.hypot(dx,dy);
  if(d>radius){dx*=radius/d;dy*=radius/d;}
  touch={x:dx/radius,y:dy/radius};stick.style.transform=`translate(${dx}px,${dy}px)`;
}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();if(screen!=='play')return;audio.unlock();document.body.classList.remove('keyboard');stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e)});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e)});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(ev,resetStick);
// Read-only diagnostics are opt-in. The browser acceptance runner additionally
// gets a narrow harness so it can drive every modifier and fatal-hit path.
if(import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  Object.assign(window,{escapeTest:{
    state:()=>({screen,mode:run?.mode,time:run?.elapsed,score:run?.score,coins:run?.coins,ship:run?.ship,size:run?.size,angle:run?.initialAngle,balls:run?.balls.length,shots:run?.shots,cannonAngle:run?.angle,openingVolley:run?.openingVolley,nextShot:run?.nextShot,shipSpeed:run?.shipSpeed,pickups:run?.pickups.map(p=>({...p})),effects:run?.effects,dead:run?.dead,debug}),
    apply:(id:EffectId)=>run?.apply(id),
    collect:()=>{if(run?.pickups[0])run.collect(run.pickups[0])},
    fatal:()=>{if(run)run.balls.push({id:99999,...run.ship,vx:1,vy:0})},
    expire:()=>{if(run){for(const id of Object.keys(run.effects) as EffectId[])run.effects[id]=run.elapsed+.02}},
    collision:()=>run?{shipSafe:safeWater(run.ship,TUNING.shipShoreRadius*run.size),ballsSafe:run.balls.every(b=>safeWater(b,TUNING.ballRadius-.1,false)),clearance:nearestShore(run.ship).distance}:null,
    debug:()=>{debug=!debug;},
  }});
}
