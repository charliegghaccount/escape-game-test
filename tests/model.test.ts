import { describe,expect,it } from 'vitest';
import { difficultyConfig,effectsConfig,fireInterval,NEGATIVES,POSITIVES,SCORE,TUNING,type Difficulty,type EffectId } from '../src/config';
import { Run } from '../src/model';
import { safeWater,distance } from '../src/physics';
function random(seed=7){let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function advance(run:Run,seconds:number){for(let i=0;i<Math.round(seconds*120);i++)run.step(1/120)}
describe('difficulty and scoring',()=>{
 for(const mode of ['Easy','Medium','Hard'] as Difficulty[])it(`${mode}: correct volley, steady interval, angle variation and no overlapping schedules`,()=>{
  const r=new Run(mode,random()),times:number[]=[];
  // Clear fired balls immediately to isolate scheduler from a genuine hit.
  while(r.elapsed<15){const old=r.shots;r.step(1/120);if(r.shots>old)times.push(r.elapsed);r.balls=[];}
  const d=difficultyConfig[mode];expect(times[0]).toBeCloseTo(1,4);
  for(let i=1;i<d.volley;i++)expect(times[i]-times[i-1]).toBeCloseTo(1.5,2);
  expect(times[d.volley]-times[d.volley-1]).toBeCloseTo(fireInterval(mode,times[d.volley-1]),1);
  expect(fireInterval(mode,0)).toBe(d.interval);
  expect(fireInterval(mode,60)).toBe(d.interval-d.rampPerMinute);
  expect(fireInterval(mode,999999)).toBe(d.minInterval);
  const rng=random();expect(new Set(Array.from({length:20},()=>new Run(mode,rng).angle)).size).toBe(20);
 });
 it('earns time score with zero coins, scores coins separately and clamps curses',()=>{
  const r=new Run('Easy');advance(r,.5);expect(r.score).toBe(5);expect(r.coins).toBe(0);
  r.collect({id:5,kind:'coin',x:0,y:0,born:0,expires:5});expect(r.score).toBe(55);expect(r.coins).toBe(1);
  for(let i=0;i<10;i++)r.apply('slow');expect(r.score).toBe(0);
 });
 it('doubles only accrual during the effect and handles exact expiry boundaries',()=>{
  const r=new Run('Easy');r.points=100;r.apply('double');expect(r.score).toBe(120);
  r.step(.5);expect(r.score).toBe(130);
  r.collect({id:5,kind:'coin',x:0,y:0,born:0,expires:5});expect(r.score).toBe(230);
  r.elapsed=9.9;r.points=0;r.step(.2);expect(r.points).toBeCloseTo(3,4);expect(r.active('double')).toBe(false);
 });
});
describe('all eight modifiers',()=>{
 for(const id of Object.keys(effectsConfig) as EffectId[])it(`${id} emits correct signed message and expires or acts instantly`,()=>{
  const r=new Run('Easy');r.points=100;r.apply(id);
  const e=r.events.at(-1)!;expect(e.type).toBe(effectsConfig[id].positive?'positive':'negative');expect(e.text).toBe(effectsConfig[id].message);
  expect(e.text?.endsWith('!')).toBe(true);
  if(effectsConfig[id].seconds){expect(r.active(id)).toBe(true);r.elapsed=10;r.step(.01);expect(r.active(id)).toBe(false);}
  else expect(r.active(id)).toBe(false);
 });
 it('refreshes rather than compounds, combines opposites deterministically, restores on expiry',()=>{
  const r=new Run('Easy');r.apply('small');r.apply('small');expect(r.size).toBe(.5);
  r.elapsed=4;r.apply('small');expect(r.effects.small).toBe(14);
  r.apply('large');expect(r.size).toBe(1);
  r.apply('fast');r.apply('slow');expect(r.shipSpeed).toBe(TUNING.shipSpeed*.75);
  r.apply('ballsFast');r.apply('ballsFast');expect(r.ballMultiplier).toBe(1.25);
  r.elapsed=14;r.step(.01);expect(r.size).toBe(1);expect(r.shipSpeed).toBe(TUNING.shipSpeed);expect(r.ballMultiplier).toBe(1);
 });
 it('applies 25% speed to old and new balls and restores their base velocities',()=>{
  const r=new Run('Easy',random());r.ship={x:1500,y:800};
  r.balls.push({id:1,x:400,y:400,vx:100,vy:0});r.apply('ballsFast');r.step(.1);
  expect(r.balls[0].x).toBeCloseTo(412.5);
  r.elapsed=.99;r.step(.02);expect(r.balls).toHaveLength(2);
  expect(Math.hypot(r.balls[1].vx,r.balls[1].vy)).toBeCloseTo(TUNING.ballSpeed);
  r.elapsed=10;r.step(.01);expect(r.ballMultiplier).toBe(1);expect(r.balls[0].vx).toBe(100);
 });
 it('Parley removes ALL balls; disable coins clears existing coins and blocks spawns until expiry',()=>{
  const r=new Run('Easy',random());
  r.balls=Array.from({length:200},(_,id)=>({id,x:400,y:400,vx:100,vy:0}));r.apply('clear');expect(r.balls).toHaveLength(0);
  r.spawnPickup('coin');expect(r.pickups.some(p=>p.kind==='coin')).toBe(true);r.apply('noCoins');
  r.spawnPickup('coin');expect(r.pickups.some(p=>p.kind==='coin')).toBe(false);
  r.elapsed=10;r.step(.01);r.spawnPickup('coin');expect(r.pickups.some(p=>p.kind==='coin')).toBe(true);
 });
 it('a retry creates clean timers, scores, effects, balls and coin state',()=>{
  const old=new Run('Hard');old.apply('noCoins');old.apply('large');old.die();
  const r=new Run('Hard');expect(r.effects).toEqual({});expect(r.balls).toEqual([]);expect(r.pickups).toEqual([]);expect(r.coins).toBe(0);expect(r.elapsed).toBe(0);expect(r.points).toBe(0);expect(r.nextShot).toBe(1);expect(r.dead).toBe(false);
 });
});
describe('spawns and one-hit death',()=>{
 for(const mode of ['Easy','Medium','Hard'] as Difficulty[])it(`${mode}: every pickup has correct lifetime and safe non-overlapping water placement`,()=>{
  const r=new Run(mode,random());const d=difficultyConfig[mode];
  for(const kind of ['coin',...POSITIVES,...NEGATIVES] as const){
   r.spawnPickup(kind);const p=r.pickups.at(-1)!;expect(p.kind).toBe(kind);
   expect(safeWater(p,TUNING.pickupClearance)).toBe(true);
   expect(distance(p,r.ship)).toBeGreaterThan(TUNING.shipShoreRadius+TUNING.pickupClearance);
   expect(p.expires-p.born).toBe(kind==='coin'?d.coinLife:effectsConfig[kind].positive?d.positiveLife:d.negativeLife);
  }
  for(const p of r.pickups)for(const q of r.pickups)if(p!==q)expect(distance(p,q)).toBeGreaterThan(TUNING.pickupClearance*2);
  r.elapsed=7;r.step(.01);expect(r.pickups.every(p=>p.born>=7)).toBe(true);
 });
 it('spawns all four variants in each category with approximately equal frequency',()=>{
  const r=new Run('Easy',random(945));const counts=new Map<EffectId,number>();
  for(let i=0;i<1000;i++){
   r.elapsed=i*8;r.balls=[];r.pickups=[];r.step(1/120);
   for(const p of r.pickups)if(p.kind!=='coin')counts.set(p.kind,(counts.get(p.kind)??0)+1);
  }
  expect(counts.size).toBe(8);
  for(const list of [POSITIVES,NEGATIVES])for(const id of list){
   expect(counts.get(id)).toBeGreaterThan(180);expect(counts.get(id)).toBeLessThan(320);
  }
 });
 it('dies on a single actual hull hit and freezes final state',()=>{
  const r=new Run('Easy');r.balls.push({id:1,...r.ship,vx:100,vy:0});r.step(1/120);
  expect(r.dead).toBe(true);const stats=[r.elapsed,r.score,r.coins];r.step(10);expect([r.elapsed,r.score,r.coins]).toEqual(stats);expect(r.events.some(e=>e.type==='death')).toBe(true);
 });
 it('never collects an expired token',()=>{
  const r=new Run('Easy');r.pickups=[{id:1,...r.ship,kind:'coin',born:-5,expires:0}];r.step(.01);expect(r.coins).toBe(0);expect(r.score).toBeLessThan(SCORE.coin);
 });
});
