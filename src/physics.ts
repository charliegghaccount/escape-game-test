import { TUNING } from './config';
export interface Vec { x: number; y: number }
export interface Ball extends Vec { vx: number; vy: number; id: number }
// Traced in the original 1920×1080 image space. Normalization keeps the trace
// editable independently of display size. These follow the inner waterline,
// including the four bent corners and the bottom-centre headlands.
const trace = [
  [80,65],[135,58],[205,57],[255,49],[301,57],[343,66],[385,57],[425,53],
  [470,61],[510,58],[549,53],[590,46],[625,51],[666,61],[705,62],[744,65],
  [765,48],[806,47],[855,45],[901,42],[946,55],[984,44],[1023,49],[1063,43],
  [1108,42],[1150,40],[1190,37],[1237,33],[1280,35],[1320,48],[1375,53],
  [1420,44],[1460,42],[1515,36],[1560,36],[1605,33],[1650,33],[1700,41],
  [1750,38],[1800,42],[1845,58],[1871,92],[1862,143],[1861,200],[1860,245],
  [1876,290],[1870,340],[1875,390],[1873,435],[1880,480],[1870,525],
  [1874,571],[1880,615],[1873,658],[1864,699],[1870,748],[1871,800],
  [1870,847],[1867,895],[1874,940],[1867,984],[1867,1017],
  [1828,1024],[1780,1031],[1733,1034],[1690,1041],[1645,1046],
  [1600,1041],[1550,1047],[1500,1044],[1450,1046],[1400,1041],
  [1350,1048],[1305,1042],[1260,1044],[1220,1035],[1180,1040],
  [1140,1040],[1100,1034],[1060,1028],[1020,1029],[980,1023],[940,1040],
  [900,1030],[860,1035],[820,1044],[780,1044],[748,1028],[710,1023],
  [675,1032],[640,1041],[600,1035],[555,1029],[510,1023],[465,1023],
  [420,1030],[380,1031],[342,1018],[310,1021],[270,1035],[225,1034],
  [185,1037],[145,1026],[100,1027],[64,1025],
  [53,987],[49,947],[42,907],[43,861],[48,817],[49,773],[42,731],
  [44,691],[49,650],[57,611],[71,580],[69,540],[61,505],[46,470],
  [49,434],[40,394],[40,351],[46,308],[47,273],[59,237],[62,201],
  [55,161],[43,126],[40,91],[53,67],
];
export const normalizedCoast = trace.map(([x,y]) => ({ x: x / 1920, y: y / 1080 }));
export const COAST: Vec[] = normalizedCoast.map(p => ({ x: p.x * 1920, y: p.y * 1080 }));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x-b.x, a.y-b.y);
export function inside(p: Vec, polygon = COAST): boolean {
  let odd = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) odd=!odd;
  }
  return odd;
}
export function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return { x:a.x+dx*t, y:a.y+dy*t };
}
export function nearestShore(p: Vec) {
  let d=Infinity, q: Vec=COAST[0], edge=0;
  for(let i=0;i<COAST.length;i++) {
    const c=closestOnSegment(p,COAST[i],COAST[(i+1)%COAST.length]);
    const dd=(p.x-c.x)**2+(p.y-c.y)**2;
    if(dd<d) { d=dd; q=c; edge=i; }
  }
  return { distance:Math.sqrt(d), point:q, edge };
}
export function safeWater(p: Vec, radius: number, island = true) {
  return inside(p) && nearestShore(p).distance >= radius &&
    (!island || distance(p,TUNING.island) >= TUNING.island.radius+radius);
}
export function reflect(v: Vec, normal: Vec): Vec {
  const dot=v.x*normal.x+v.y*normal.y;
  return {x:v.x-2*dot*normal.x,y:v.y-2*dot*normal.y};
}
// Iterative circle vs segment/vertex projection handles concave shore, not an
// invisible bounding box. All movements are substepped to < half ball radius.
export function resolveShore(p: Vec, radius: number, velocity?: Vec) {
  let contacts=0;
  for(let i=0;i<32;i++) {
    const n=nearestShore(p), isIn=inside(p);
    if(isIn && n.distance >= radius-1e-6) return contacts;
    let nx=p.x-n.point.x, ny=p.y-n.point.y;
    if(!isIn) { nx=-nx; ny=-ny; }
    let len=Math.hypot(nx,ny);
    if(len<1e-8) {
      const a=COAST[n.edge], b=COAST[(n.edge+1)%COAST.length];
      nx=-(b.y-a.y);ny=b.x-a.x;len=Math.hypot(nx,ny);
    }
    nx/=len;ny/=len;
    const push=isIn ? radius-n.distance+0.015 : radius+n.distance+0.015;
    p.x+=nx*push;p.y+=ny*push;
    if(velocity && velocity.x*nx+velocity.y*ny<0) {
      const r=reflect(velocity,{x:nx,y:ny});velocity.x=r.x;velocity.y=r.y;
    }
    contacts++;
  }
  return contacts;
}
export function constrainShip(p: Vec, radius: number) {
  const wanted={...p};
  for(let i=0;i<8;i++) {
    resolveShore(p,radius);
    const d=distance(p,TUNING.island), limit=radius+TUNING.island.radius;
    if(d>=limit-1e-6) return;
    const nx=d>0?(p.x-TUNING.island.x)/d:1,ny=d>0?(p.y-TUNING.island.y)/d:0;
    p.x=TUNING.island.x+nx*(limit+0.02);p.y=TUNING.island.y+ny*(limit+0.02);
    if(safeWater(p,radius-1e-6))return;
  }
  // At double size the expanded fort and inset coast overlap at a few narrow
  // passages. Alternating projection alone can oscillate there. Find the nearest
  // legal point on the expanded fort contour instead of pushing through cliffs.
  let candidate:Vec|undefined,best=Infinity;
  const limit=radius+TUNING.island.radius+0.1;
  for(let i=0;i<192;i++) {
    const a=i*Math.PI*2/192;
    const q={x:TUNING.island.x+Math.cos(a)*limit,y:TUNING.island.y+Math.sin(a)*limit};
    const d=(q.x-wanted.x)**2+(q.y-wanted.y)**2;
    if(d<best && safeWater(q,radius)){candidate=q;best=d;}
  }
  if(candidate){p.x=candidate.x;p.y=candidate.y;}
}
export function stepBall(b: Ball, dt: number, multiplier=1, onMove?: (previous: Vec, next: Vec) => void) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt*multiplier/(TUNING.ballRadius*0.45)));
  let contacts=0;
  for(let i=0;i<steps;i++) {
    const prev={x:b.x,y:b.y};
    b.x+=b.vx*dt*multiplier/steps;b.y+=b.vy*dt*multiplier/steps;
    const v={x:b.vx,y:b.vy};
    contacts+=resolveShore(b,TUNING.ballRadius,v);b.vx=v.x;b.vy=v.y;
    onMove?.(prev,b);
  }
  return contacts;
}
export function ballHitsShip(ball: Vec, ship: Vec, angle: number, size: number) {
  // Capsule follows the ship's heading, independent of transparent sprite bounds.
  const half=TUNING.shipHullHalfLength*size;
  const dx=Math.cos(angle)*half,dy=Math.sin(angle)*half;
  const q=closestOnSegment(ball,{x:ship.x-dx,y:ship.y-dy},{x:ship.x+dx,y:ship.y+dy});
  return distance(ball,q)<=TUNING.shipHullRadius*size+TUNING.ballRadius;
}
