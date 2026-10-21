import { difficultyConfig, effectsConfig, EFFECT_VALUES, fireInterval, NEGATIVES, POSITIVES, SCORE, TUNING, type Difficulty, type EffectId } from './config';
import { ballHitsShip, constrainShip, distance, safeWater, stepBall, type Ball, type Vec } from './physics';
export type PickupKind='coin'|EffectId;
export interface Pickup extends Vec { id:number; kind:PickupKind; expires:number; born:number }
export interface GameEvent { type:'shot'|'coin'|'positive'|'negative'|'death'|'bounce'; x:number; y:number; text?:string }
export class Run {
  mode:Difficulty;
  elapsed=0; points=0; coins=0; positives=0; negatives=0; dead=false;
  ship:Vec={x:1410,y:770}; heading=-Math.PI/2;
  angle:number; initialAngle:number; balls:Ball[]=[]; pickups:Pickup[]=[];
  effects:Partial<Record<EffectId,number>>={}; events:GameEvent[]=[];
  shots=0; nextShot:number=TUNING.firstShot; private serial=0;
  private coinAt=0.7; private positiveAt=2.6; private negativeAt=4.4;
  constructor(mode:Difficulty, public rng= Math.random) {
    this.mode=mode;this.angle=this.initialAngle=rng()*Math.PI*2;
    const a=rng()*Math.PI*2;
    this.ship={x:TUNING.island.x+Math.cos(a)*460,y:TUNING.island.y+Math.sin(a)*290};
    constrainShip(this.ship,TUNING.shipShoreRadius);
  }
  active(id:EffectId) { return (this.effects[id]??0)>this.elapsed; }
  get size() { return (this.active('small')?EFFECT_VALUES.small:1)*(this.active('large')?EFFECT_VALUES.large:1); }
  get shipSpeed() { return TUNING.shipSpeed*(this.active('fast')?EFFECT_VALUES.fast:1)*(this.active('slow')?EFFECT_VALUES.slow:1); }
  get ballMultiplier() { return this.active('ballsFast')?EFFECT_VALUES.ballsFast:1; }
  get score() { return Math.max(0,Math.floor(this.points+1e-7)); }
  award(amount:number) { this.points=Math.max(0,this.points+amount*(this.active('double')?EFFECT_VALUES.double:1)); }
  safeSpawn(radius=TUNING.pickupClearance):Vec|undefined {
    for(let i=0;i<150;i++) {
      const p={x:100+this.rng()*1720,y:175+this.rng()*775};
      if(!safeWater(p,radius) || distance(p,this.ship)<TUNING.shipShoreRadius*this.size+radius+20) continue;
      // Reserve both HUD and mobile thumbstick areas. Keep pickups away from hazards.
      if((p.y<280 && (p.x<900 || p.x>1500)) || (p.x<480 && p.y>650)) continue;
      if(this.pickups.some(q=>distance(p,q)<radius*2+14) || this.balls.some(b=>distance(p,b)<70)) continue;
      return p;
    }
  }
  spawnPickup(kind:PickupKind) {
    if(kind==='coin'&&this.active('noCoins')) return;
    const p=this.safeSpawn();if(!p) return;
    const d=difficultyConfig[this.mode];
    const life=kind==='coin'?d.coinLife:effectsConfig[kind].positive?d.positiveLife:d.negativeLife;
    this.pickups.push({...p,id:++this.serial,kind,born:this.elapsed,expires:this.elapsed+life});
  }
  apply(id:EffectId) {
    const def=effectsConfig[id];
    if(def.positive) this.positives++;else this.negatives++;
    // Score the pickup before activating double; it doubles only future accrual.
    this.award(def.positive?SCORE.positive:SCORE.negative);
    if(def.seconds>0)this.effects[id]=this.elapsed+def.seconds;
    if(id==='clear')this.balls=[];
    if(id==='noCoins')this.pickups=this.pickups.filter(p=>p.kind!=='coin');
    constrainShip(this.ship,TUNING.shipShoreRadius*this.size);
    this.events.push({type:def.positive?'positive':'negative',...this.ship,text:def.message});
  }
  collect(p:Pickup) {
    this.pickups=this.pickups.filter(q=>q.id!==p.id);
    if(p.kind==='coin') { this.coins++;this.award(SCORE.coin);this.events.push({type:'coin',...p,text:`+${SCORE.coin*(this.active('double')?EFFECT_VALUES.double:1)} booty`}); }
    else this.apply(p.kind);
  }
  private fire() {
    this.angle+=(this.rng()-0.5)*TUNING.shotJitter;
    let a=this.angle;
    // Delay an aimed shot away from a nearby ship, retaining the visible barrel
    // heading. No ball appears in the hull or an unavoidable muzzle collision.
    const muzzle={x:TUNING.island.x+Math.cos(a)*TUNING.muzzleDistance,y:TUNING.island.y+Math.sin(a)*TUNING.muzzleDistance};
    if(distance(muzzle,this.ship)<TUNING.shipShoreRadius*this.size+90) { this.nextShot=this.elapsed+0.2;return; }
    this.balls.push({...muzzle,id:++this.serial,vx:Math.cos(a)*TUNING.ballSpeed,vy:Math.sin(a)*TUNING.ballSpeed});
    this.events.push({type:'shot',...muzzle});this.shots++;
    this.nextShot=this.elapsed+(this.shots<difficultyConfig[this.mode].volley?TUNING.volleyGap:fireInterval(this.mode,this.elapsed));
  }
  step(dt:number,input:Vec={x:0,y:0}) {
    if(this.dead)return;
    // Split score integration exactly at effect expiry (even in direct tests).
    let t=this.elapsed,end=t+dt;
    const doubleEnd=this.effects.double??0;
    const doubled=Math.max(0,Math.min(end,doubleEnd)-t);
    this.points+=SCORE.perSecond*(dt+doubled);
    this.elapsed=end;
    for(const id of Object.keys(this.effects) as EffectId[]) if(!this.active(id))delete this.effects[id];
    const len=Math.hypot(input.x,input.y), scale=len>1?1/len:1;
    if(len>0.08) {
      this.heading=Math.atan2(input.y,input.x);
      this.ship.x+=input.x*scale*this.shipSpeed*dt;this.ship.y+=input.y*scale*this.shipSpeed*dt;
    }
    constrainShip(this.ship,TUNING.shipShoreRadius*this.size);
    this.angle+=TUNING.cannonRotation*difficultyConfig[this.mode].rotation*dt;
    if(this.elapsed+1e-8>=this.nextShot)this.fire();
    for(const b of this.balls) {
      const bounced=stepBall(b,dt,this.ballMultiplier,(_prev,next)=>{
        if(!this.dead && ballHitsShip(next,this.ship,this.heading,this.size))this.die();
      });
      if(bounced)this.events.push({type:'bounce',x:b.x,y:b.y});
      if(this.dead)return;
    }
    this.pickups=this.pickups.filter(p=>p.expires>this.elapsed);
    for(const p of [...this.pickups]) if(distance(p,this.ship)<TUNING.shipHullRadius*this.size+TUNING.pickupRadius) this.collect(p);
    if(this.elapsed>=this.coinAt) { this.spawnPickup('coin');this.coinAt=this.elapsed+TUNING.coinEvery; }
    if(this.elapsed>=this.positiveAt) { this.spawnPickup(POSITIVES[Math.min(3,Math.floor(this.rng()*4))]);this.positiveAt=this.elapsed+TUNING.positiveEvery; }
    if(this.elapsed>=this.negativeAt) { this.spawnPickup(NEGATIVES[Math.min(3,Math.floor(this.rng()*4))]);this.negativeAt=this.elapsed+TUNING.negativeEvery; }
  }
  die() { if(!this.dead){this.dead=true;this.events.push({type:'death',...this.ship});} }
}
