import { describe,expect,it } from 'vitest';
import { COAST, ballHitsShip, constrainShip, distance, inside, nearestShore, reflect, resolveShore, safeWater, stepBall, type Ball } from '../src/physics';
import { TUNING } from '../src/config';
function random(seed=42){let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
describe('shore physics',()=>{
 it('reflects off an oblique segment without changing speed',()=>{
  const n={x:-Math.SQRT1_2,y:Math.SQRT1_2},v={x:500,y:-200},r=reflect(v,n);
  expect(r.x).toBeCloseTo(-200);expect(r.y).toBeCloseTo(500);
  expect(Math.hypot(r.x,r.y)).toBeCloseTo(Math.hypot(v.x,v.y));
 });
 it('is a concave traced shore with real headlands rather than a rectangle',()=>{
  expect(COAST.length).toBeGreaterThan(100);
  expect(inside({x:960,y:540})).toBe(true);expect(inside({x:15,y:540})).toBe(false);
  expect(nearestShore({x:710,y:1015}).distance).toBeLessThan(15);
  expect(nearestShore({x:820,y:1015}).distance).toBeGreaterThan(20);
 });
 it('resolves penetration from outside a corner and from the bottom centre',()=>{
  for(const p of [{x:30,y:30},{x:960,y:1070},{x:1890,y:1050},{x:710,y:1040}]){
   resolveShore(p,13);expect(safeWater(p,12.99,false)).toBe(true);
  }
 });
 it('keeps fast balls inside for thousands of ricochets including all corners and bottom middle',()=>{
  const rng=random();let contacts=0;
  const starts=[{x:960,y:950},{x:100,y:100},{x:1810,y:100},{x:1800,y:950},{x:110,y:950},{x:710,y:960}];
  for(let j=0;j<18;j++){
   const angle=rng()*Math.PI*2,speed=j%3===0?1800:310;
   const b:Ball={...starts[j%starts.length],id:j,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed};
   resolveShore(b,TUNING.ballRadius);
   for(let i=0;i<12000;i++){
    contacts+=stepBall(b,1/120,1.25);
    if(!safeWater(b,TUNING.ballRadius-.1,false))throw new Error(`Escaped ${j}/${i}: ${JSON.stringify(b)}`);
    expect(Math.hypot(b.vx,b.vy)).toBeCloseTo(speed,5);
   }
  }
  expect(contacts).toBeGreaterThan(1000);
 },30000);
 it('reflects downward fast shots at the bottom-centre headlands',()=>{
  for(const x of [680,710,740,780,820,900,940,980]){
   const b:Ball={id:x,x,y:950,vx:0,vy:1800};
   let contacts=0;
   for(let i=0;i<12;i++){contacts+=stepBall(b,1/120,1.25);expect(safeWater(b,12.9,false)).toBe(true);}
   expect(contacts).toBeGreaterThan(0);expect(b.vy).toBeLessThan(0);
  }
 });
 it('keeps the entire art bounding circle off shore and island at half/default/double size',()=>{
  for(const size of [.5,1,2])for(const p0 of [...COAST,TUNING.island]){
   const p={x:p0.x,y:p0.y};constrainShip(p,TUNING.shipShoreRadius*size);
   expect(safeWater(p,TUNING.shipShoreRadius*size-.1),JSON.stringify({p0,p,size,near:nearestShore(p)})).toBe(true);
   expect(distance(p,TUNING.island)).toBeGreaterThanOrEqual(TUNING.island.radius+TUNING.shipShoreRadius*size-.1);
  }
 });
 it('uses a heading-aware hull and scales the hitbox with the ship',()=>{
  const ship={x:500,y:500};
  expect(ballHitsShip({x:560,y:500},ship,0,1)).toBe(true);
  expect(ballHitsShip({x:500,y:570},ship,0,1)).toBe(false);
  expect(ballHitsShip({x:560,y:500},ship,0,.5)).toBe(false);
  expect(ballHitsShip({x:600,y:500},ship,0,2)).toBe(true);
 });
});
