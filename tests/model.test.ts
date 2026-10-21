import { describe,expect,it } from 'vitest';
import { difficultyConfig,effectsConfig,fireInterval,pickModifier,NEGATIVES,POSITIVES,SCORE,TUNING,EFFECT_VALUES,type Difficulty,type EffectId } from '../src/config';
import { Run } from '../src/model';
import { safeWater,distance } from '../src/physics';
function random(seed=7){let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function advance(run:Run,seconds:number){for(let i=0;i<Math.round(seconds*120);i++)run.step(1/120)}
describe('difficulty and scoring',()=>{
 for(const mode of ['Easy','Medium','Hard'] as Difficulty[])it(`${mode}: correct volley, steady interval, angle variation and no overlapping schedules`,()=>{
  const r=new Run(mode,random()),times:number[]=[];
  // Clear fired balls immediately to isolate scheduler from a genuine hit.
  while(r.elapsed<15){const old=r.shots;r.step(1/120);if(r.shots>old)times.push(r.elapsed);r.balls=[];}
  const d=difficultyConfig[mode];expect(times[0]).toBeCloseTo(TUNING.firstShot,4);
  for(let i=1;i<d.volley;i++)expect(times[i]-times[i-1]).toBeCloseTo(TUNING.volleyGap,2);
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
  r.apply('large');expect(r.size).toBe(EFFECT_VALUES.small*EFFECT_VALUES.large);
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
  const r=new Run('Hard');expect(r.effects).toEqual({});expect(r.balls).toEqual([]);expect(r.pickups).toEqual([]);expect(r.coins).toBe(0);expect(r.elapsed).toBe(0);expect(r.points).toBe(0);expect(r.nextShot).toBe(TUNING.firstShot);expect(r.dead).toBe(false);
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
 it('spawns Parley less often while keeping other variants balanced',()=>{
  const r=new Run('Easy',random(945));const counts=new Map<EffectId,number>();
  for(let i=0;i<1000;i++){
   r.elapsed=i*16;r.balls=[];r.pickups=[];r.step(1/120);
   for(const p of r.pickups)if(p.kind!=='coin')counts.set(p.kind,(counts.get(p.kind)??0)+1);
  }
  expect(counts.size).toBe(8);
  expect(counts.get('clear')).toBeGreaterThan(40);expect(counts.get('clear')).toBeLessThan(115);
  for(const id of ['small','double','fast'] as EffectId[]){
   expect(counts.get(id)).toBeGreaterThan(250);expect(counts.get(id)).toBeLessThan(370);
   expect(counts.get(id)!).toBeGreaterThan(counts.get('clear')!*2);
  }
  for(const id of NEGATIVES){expect(counts.get(id)).toBeGreaterThan(180);expect(counts.get(id)).toBeLessThan(320);}
 });
 it('dies on a single actual hull hit and freezes final state',()=>{
  const r=new Run('Easy');r.balls.push({id:1,...r.ship,vx:100,vy:0});r.step(1/120);
  expect(r.dead).toBe(true);const stats=[r.elapsed,r.score,r.coins];r.step(10);expect([r.elapsed,r.score,r.coins]).toEqual(stats);expect(r.events.some(e=>e.type==='death')).toBe(true);
 });
 it('never collects an expired token',()=>{
  const r=new Run('Easy');r.pickups=[{id:1,...r.ship,kind:'coin',born:-5,expires:0}];r.step(.01);expect(r.coins).toBe(0);expect(r.score).toBeLessThan(SCORE.coin);
 });
});


describe('revised tuning and quickfire opening',()=>{
 for(const mode of ['Easy','Medium','Hard'] as Difficulty[]) {
  it(`${mode}: fires the full random-direction volley within two seconds across many runs`,()=>{
   const firstAngles:number[]=[];
   for(let seed=1;seed<=32;seed++){
    const r=new Run(mode,random(seed));r.ship={x:1500,y:800};
    const shots:{time:number;angle:number}[]=[];
    for(let frame=0;frame<240;frame++){
     r.step(TUNING.fixedStep);
     for(const e of r.events)if(e.type==='shot'){
      shots.push({time:r.elapsed,angle:e.angle!});
      const b=r.balls.at(-1)!;
      expect(Math.atan2(Math.sin(Math.atan2(b.vy,b.vx)-r.angle),Math.cos(Math.atan2(b.vy,b.vx)-r.angle))).toBeCloseTo(0);
     }
     r.events=[];r.balls=[];
    }
    expect(shots).toHaveLength(difficultyConfig[mode].volley);
    expect(r.openingVolley).toBe(false);
    shots.forEach((shot,i)=>expect(shot.time).toBeCloseTo(TUNING.firstShot+i*TUNING.volleyGap,5));
    for(let i=1;i<shots.length;i++){
     const difference=Math.abs(Math.atan2(Math.sin(shots[i].angle-shots[i-1].angle),Math.cos(shots[i].angle-shots[i-1].angle)));
     expect(difference).toBeGreaterThanOrEqual(TUNING.volleyMinTurn-1e-6);
    }
    firstAngles.push(shots[0].angle);
   }
   expect(new Set(firstAngles).size).toBe(32);
  });
  it(`${mode}: actual steady shot gaps shorten over time and obey the configured minimum`,()=>{
   const r=new Run(mode,random(33));r.ship={x:1500,y:800};const times:number[]=[];
   while(r.elapsed<130){
    r.step(TUNING.fixedStep);
    if(r.events.some(e=>e.type==='shot'))times.push(r.elapsed);
    r.events=[];r.balls=[];r.pickups=[];
   }
   const n=difficultyConfig[mode].volley;
   const gaps=times.slice(n).map((t,i)=>({at:times[n+i-1],gap:t-times[n+i-1]}));
   for(const {at,gap} of gaps){
    expect(Math.abs(gap-fireInterval(mode,at))).toBeLessThanOrEqual(TUNING.fixedStep+1e-7);
    expect(gap).toBeGreaterThanOrEqual(difficultyConfig[mode].minInterval-1e-7);
   }
   const atMinute=gaps.find(g=>g.at>=60)!;
   expect(atMinute.gap).toBeLessThan(gaps[0].gap-.9);
   expect(gaps.every((g,i)=>i===0||g.gap<=gaps[i-1].gap+TUNING.fixedStep)).toBe(true);
  });
  it(`${mode}: resumes the exact normal rotation and interval after the volley`,()=>{
   const r=new Run(mode,random(90));r.ship={x:1500,y:800};
   while(r.openingVolley){r.step(TUNING.fixedStep);r.balls=[];r.events=[];}
   const last=r.elapsed,a=r.angle;
   expect(r.nextShot-last).toBeCloseTo(fireInterval(mode,last),6);
   r.step(.1);
   expect(r.angle-a).toBeCloseTo(TUNING.cannonRotation*difficultyConfig[mode].rotation*.1,6);
  });
 }
 it('visibly quick-turns between random opening shots instead of using normal rotation',()=>{
  const r=new Run('Hard',random(31));r.ship={x:1500,y:800};
  advance(r,TUNING.firstShot);const a=r.angle;r.balls=[];
  advance(r,.1);
  expect(Math.abs(r.angle-a)/.1).toBeGreaterThan(r.rotationSpeed*2);
 });
 it('does not postpone opening shots or place them in the hull when a ship hugs the fort',()=>{
  for(const rng of [()=>0,()=>.999999,random(13)]){
   const r=new Run('Hard',rng);r.ship={x:1180,y:540};let count=0;
   for(let i=0;i<240;i++){
    r.step(TUNING.fixedStep);
    for(const e of r.events)if(e.type==='shot'){
     count++;expect(distance(e,r.ship)).toBeGreaterThanOrEqual(TUNING.shipShoreRadius+90);
    }
    r.events=[];r.balls=[];
   }
   expect(count).toBe(5);
  }
 });
 it('increases actual ship travel by 25%, keeps normalized diagonals and applies the smaller XL hull',()=>{
  const r=new Run('Easy',random());r.ship={x:1400,y:700};r.step(.1,{x:1,y:0});
  expect(r.ship.x).toBeCloseTo(1442.5);expect(r.shipSpeed).toBe(425);
  r.ship={x:1400,y:700};r.step(.1,{x:1,y:1});
  expect(distance(r.ship,{x:1400,y:700})).toBeCloseTo(42.5);
  r.apply('large');expect(r.size).toBe(1.35);
  expect(safeWater(r.ship,TUNING.shipShoreRadius*r.size-.1)).toBe(true);
 });
 it('spawns positive and negative modifiers at the reduced cadence, with coins unchanged',()=>{
  const r=new Run('Easy',random(18));const positive:number[]=[],negative:number[]=[],coins:number[]=[];
  for(let i=0;i<40*120;i++){
   r.step(TUNING.fixedStep);
   for(const p of r.pickups){
    if(p.kind==='coin')coins.push(p.born);
    else (effectsConfig[p.kind].positive?positive:negative).push(p.born);
   }
   r.pickups=[];r.balls=[];r.events=[];
  }
  expect(positive).toHaveLength(4);expect(negative).toHaveLength(3);
  expect(positive[0]).toBeCloseTo(6,1);expect(negative[0]).toBeCloseTo(8,1);
  for(let i=1;i<positive.length;i++)expect(positive[i]-positive[i-1]).toBeCloseTo(10,1);
  for(let i=1;i<negative.length;i++)expect(negative[i]-negative[i-1]).toBeCloseTo(12,1);
  for(let i=1;i<coins.length;i++)expect(coins[i]-coins[i-1]).toBeCloseTo(1.5,1);
 });
 it('keeps Parley selectable but reduces its weighted share to approximately eight percent',()=>{
  const rng=random(79);let parley=0;const counts=new Map<EffectId,number>();
  for(let i=0;i<13000;i++){
   const kind=pickModifier(POSITIVES,rng);counts.set(kind,(counts.get(kind)??0)+1);if(kind==='clear')parley++;
  }
  expect(parley/13000).toBeGreaterThan(.065);expect(parley/13000).toBeLessThan(.09);
  expect(counts.size).toBe(4);
 });
});
