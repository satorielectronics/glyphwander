'use strict';
// ============================================================
//  GLYPHWANDER v2 — a tiny deterministic roguelike engine
//  Randomness: map gen = hash(seed,depth); combat/AI = seeded
//  stream per floor; cellular automata = hash(seed,turn,cell)
//  so the world sim is order-independent and replayable.
//  Layers per cell: tile, fuel, heat, smoke, poison, elec,
//  burn source, stored-fire flag, footprints.
// ============================================================
const W=48,H=32;
const T_WALL=0,T_FLOOR=1,T_GRASS=2,T_WATER=3,T_FIRE=4,T_ASH=5,T_OIL=6,T_ICE=7,T_STAIRS=8,
      T_MUD=9,T_DIRT=10,T_VINE=11,T_VINE_ICE=12,T_GRATE=13,T_SNOW=14,T_SLICK=15,T_CAMP=16,T_TREE=17,T_PIT=18;
const TNAME=['wall','floor','grass','water','fire','ash','oil','ice','stairs','mud','dirt','vines','frozen vines','grate','snow','slick ice','campfire','tree','fire pit'];
const DIRS8=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const DIRS4=[[0,-1],[1,0],[0,1],[-1,0]];
const ARROWS={'0,-1':'↑','1,-1':'↗','1,0':'→','1,1':'↘','0,1':'↓','-1,1':'↙','-1,0':'←','-1,-1':'↖'};
const FONT='"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const COLD=t=>t===T_WATER||t===T_ICE||t===T_SNOW||t===T_SLICK||t===T_VINE_ICE;

// ---------------- exposed engine parameters ----------------
const P={
  seed:1337,
  fireSpread:0.45, burnTime:3, oilSpread:0.9, vineSpread:0.85,
  windDir:'E', windStrength:0.5, smoke:0.5,
  heatDiffusion:0.35, ambient:0.3, ignitePoint:0.8, meltPoint:0.55,
  poisonDecay:0.94, flashThreshold:0.12,
  regrow:0.015, grassGrowth:0.004, vineGrowth:0.01, fireflies:0.12,
  conduct:150, meatRot:150,
  monsterDensity:1, campEvery:90, hungerRate:10, lightRadius:5, nightChance:0.35,
  zoom:15, showHeat:'Off', showCones:'On', darkRooms:0.35, throwNoise:5,
};
const WIND={Calm:[0,0],N:[0,-1],NE:[.707,-.707],E:[1,0],SE:[.707,.707],S:[0,1],SW:[-.707,.707],W:[-1,0],NW:[-.707,-.707]};
const PARAM_DEFS=[
  {h:'FIRE'},
  {k:'fireSpread',label:'Grass spread',min:0,max:1,step:0.05},
  {k:'oilSpread',label:'Oil chain',min:0,max:1,step:0.05},
  {k:'vineSpread',label:'Vine spread',min:0,max:1,step:0.05},
  {k:'burnTime',label:'Burn time',min:1,max:10,step:1},
  {h:'HEAT'},
  {k:'heatDiffusion',label:'Diffusion',min:0,max:0.9,step:0.05},
  {k:'ambient',label:'Ambient temp',min:0,max:0.7,step:0.05},
  {k:'ignitePoint',label:'Auto-ignite at',min:0.4,max:1,step:0.02},
  {k:'meltPoint',label:'Ice melts at',min:0.3,max:0.9,step:0.02},
  {k:'showHeat',label:'Heat overlay',select:['Off','On']},
  {h:'LIGHT & STEALTH'},
  {k:'darkRooms',label:'Dark rooms',min:0,max:1,step:0.05},
  {k:'showCones',label:'Vision cones',select:['On','Off']},
  {k:'throwNoise',label:'Throw noise',min:1,max:10,step:1},
  {h:'AIR'},
  {k:'windDir',label:'Wind',select:Object.keys(WIND)},
  {k:'windStrength',label:'Wind bias',min:0,max:1,step:0.05},
  {k:'smoke',label:'Smoke output',min:0,max:1,step:0.05},
  {k:'poisonDecay',label:'Poison linger',min:0.8,max:0.99,step:0.01},
  {k:'flashThreshold',label:'Flash density',min:0.02,max:0.5,step:0.02},
  {h:'GROWTH & DECAY'},
  {k:'regrow',label:'Ash → grass',min:0,max:0.1,step:0.005},
  {k:'grassGrowth',label:'Grass creep',min:0,max:0.05,step:0.002},
  {k:'vineGrowth',label:'Vine creep',min:0,max:0.08,step:0.002},
  {k:'fireflies',label:'Firefly chance',min:0,max:0.6,step:0.02},
  {k:'meatRot',label:'Meat rots after',min:20,max:400,step:10},
  {h:'WORLD'},
  {k:'conduct',label:'Conduct tiles',min:0,max:400,step:10},
  {k:'campEvery',label:'Campfire every',min:0,max:300,step:10},
  {k:'monsterDensity',label:'Monsters ×',min:0.2,max:3,step:0.1},
  {k:'nightChance',label:'Night floors',min:0,max:1,step:0.05},
  {k:'hungerRate',label:'Turns/hunger',min:2,max:30,step:1},
  {k:'lightRadius',label:'Torch radius',min:2,max:10,step:1},
  {k:'zoom',label:'Tiles across',min:9,max:31,step:2},
];

// ---------------- deterministic randomness ----------------
function mulberry32(a){const f=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};f.get=()=>a|0;f.set=v=>{a=v|0};return f}
function hashU(a,b,c,d){let h=(0x9e3779b9^(a|0))>>>0;h=Math.imul(h^(b|0),0x85ebca6b);h^=h>>>13;h=Math.imul(h^(c|0),0xc2b2ae35);h^=h>>>16;h=Math.imul(h^(d|0),0x27d4eb2f);h^=h>>>15;h=Math.imul(h,0x165667b1);h^=h>>>16;return h>>>0}
function h01(a,b,c,d){return hashU(a,b,c,d)/4294967296}
const idx=(x,y)=>y*W+x, inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const cheb=(a,b,c,d)=>Math.max(Math.abs(a-c),Math.abs(b-d));
const sgn=v=>v>0?1:v<0?-1:0;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ---------------- content ----------------
const ITEMS={
  onigiri:{ch:'%',color:'#f2ead8',name:'Onigiri',use:true,desc:'Restores 50 fullness. COOK it next to fire (or leave it in flames) to grill it.'},
  grilled:{ch:'%',color:'#e0a050',name:'Grilled Onigiri',use:true,desc:'Restores 65 fullness and 5 HP.'},
  meat:{ch:'%',color:'#e07a7a',name:'Raw Meat',use:true,desc:'+25 fullness, but may upset your stomach. COOK it next to fire or a red-hot grate. Rots over time — unless kept in a bag.'},
  cooked:{ch:'%',color:'#d08a4a',name:'Cooked Meat',use:true,desc:'+40 fullness and +10 HP.'},
  rotten:{ch:'%',color:'#8a9a4a',name:'Rotten Meat',use:true,desc:'Leaks poison gas wherever it lies. Eating it is a terrible idea. Throwing it is a great one.'},
  herb:{ch:'!',color:'#7fe07f',name:'Medicinal Herb',use:true,desc:'Restores 25 HP. Raises max HP if you are already full.'},
  fireStaff:{ch:'/',color:'#ff7b2e',name:'Staff of Flame',staff:true,use:true,desc:'Zap fire forward. Ignites grass, oil and vines along the path, melts ice and snow, bakes mud.'},
  iceStaff:{ch:'/',color:'#7fd8ff',name:'Staff of Frost',staff:true,use:true,desc:'Zap frost forward. Water → ice, ground → snow, oil → slick ice, burning oil → slick ice with fire trapped inside. Freezes the target.'},
  boltStaff:{ch:'/',color:'#ffe24a',name:'Staff of Thunder',staff:true,use:true,desc:'Zap lightning forward. Electrifies every connected tile of water and metal grate it touches.'},
  galeStaff:{ch:'/',color:'#e8eef5',name:'Staff of Gales',staff:true,use:true,desc:'Blast wind forward: pushes fire, smoke and poison down the line and hurls the first creature up to 3 tiles.'},
  oilJar:{ch:'!',color:'#b07cff',name:'Oil Jar',use:false,desc:'Throw to splash oil (radius 1). Oil burns fast and chains. Explodes if it lands in fire.'},
  miasma:{ch:'!',color:'#a6d84a',name:'Miasma Jar',use:false,desc:'Throw to release a poison cloud. Poison gas detonates along the whole cloud when it touches fire.'},
  seeds:{ch:'*',color:'#9be06a',name:'Grass Seeds',use:false,desc:'Throw to sprout grass (radius 2). Fuel for later.'},
  inferno:{ch:'?',color:'#ff5a3a',name:'Inferno Scroll',use:true,desc:'Ignites everything flammable within 3 tiles and scorches nearby foes. Including the grass you stand on.'},
  rain:{ch:'?',color:'#5aa8ff',name:'Rain Scroll',use:true,desc:'Douses fire and cools everything within 3 tiles. Ash turns to mud, floors flood into puddles.'},
  blizzard:{ch:'?',color:'#dff4ff',name:'Blizzard Scroll',use:true,bagT:true,desc:'Freezes everything within 3 tiles: water → ice, oil → slick, ground → snow, foes frozen. Read onto a bag: food inside freezes solid and stays fresh forever, even after you take it out.'},
  weapon:{ch:')',color:'#d6dde6',name:'Weapon',desc:'Equip to add its power to your attacks. Seals trigger an elemental effect on every hit.'},
  pouch:{ch:'(',color:'#c9a46a',name:'Pouch',bag:3,desc:'Holds 3 items in a single bag slot. Scrolls can be read onto a bag to affect everything inside. Food inside never rots. Bursts open when thrown; burns in fire.'},
  satchel:{ch:'(',color:'#e0b878',name:'Satchel',bag:5,desc:'Holds 5 items in a single bag slot.'},
  coldbox:{ch:'(',color:'#9aa6b6',name:'Iron Box',bag:3,fireproof:true,desc:'Holds 3 items. Fireproof: it never burns or spills in fire. Food inside never rots.'},
  gold:{ch:'$',color:'#ffd84a',name:'Gold',desc:'Spend it at a blacksmith.'},
  lumber:{ch:'=',color:'#c08a50',name:'Lumber',desc:'Firewood. With some Dry Grass, BUILD a campfire in front of you. Walk into a campfire (or throw lumber on it) to add fuel. Lumber lying in fire becomes a campfire.'},
  ironOre:{ch:'*',color:'#d08a5a',name:'Iron Ore',desc:'Rough iron, mined from rusty veins with a pickaxe. A blacksmith smelts 2 ore into 1 bar.'},
  mithrilOre:{ch:'*',color:'#9fe8ff',name:'Mithril Ore',desc:'Rare, glittering ore from deeper floors. A blacksmith smelts 2 ore into 1 bar.'},
  ironBar:{ch:'=',color:'#c8d0d8',name:'Iron Bar',desc:'Smelted iron. Trade bars to a blacksmith for powerful gear.'},
  mithrilBar:{ch:'=',color:'#7fe8ff',name:'Mithril Bar',desc:'Smelted mithril. The finest things a blacksmith makes need it.'},
  tainted:{ch:'%',color:'#b88ad8',name:'Tainted Jerky',use:true,desc:'Rotten meat, cooked. Filling (+30), but whoever eats it is paralyzed for 5 turns. Throw it at an enemy and it gulps it down and freezes up.'},
  dryGrass:{ch:'"',color:'#d8c860',name:'Dry Grass',desc:'Plant matter for kindling. With Lumber, BUILD a campfire in front of you. You often get some when hacking through vines. Burns away in fire.'},
  reveal:{ch:'?',color:'#fff7c0',name:'Dawn Scroll',use:true,desc:'Floods the whole floor with light: the entire map is revealed and every creature and item on it becomes visible.'},
  storm:{ch:'?',color:'#8fb0ff',name:'Storm Scroll',use:true,desc:'A thunderstorm breaks over the room you are in for 40 turns: rain douses fire, cools and floods the ground, and lightning strikes at random — drawn to metal grates and creatures, chained through water. Including you.'},
  honing:{ch:'?',color:'#f0f0f0',name:'Honing Scroll',use:true,bagT:true,desc:'+1 to your equipped weapon — or +1 to every weapon inside a chosen bag.'},
  flameSeal:{ch:'?',color:'#ff8a3d',name:'Flame Seal',use:true,bagT:true,seal:'fire',desc:'Seals fire onto your weapon (or every weapon in a bag): +2 damage, and hits ignite the ground under the target.'},
  frostSeal:{ch:'?',color:'#7fd8ff',name:'Frost Seal',use:true,bagT:true,seal:'ice',desc:'Seals frost onto your weapon (or every weapon in a bag): hits may freeze the target and freeze water beneath it.'},
  thunderSeal:{ch:'?',color:'#ffe24a',name:'Thunder Seal',use:true,bagT:true,seal:'bolt',desc:'Seals thunder onto your weapon (or every weapon in a bag): +2 damage, and hits electrify water or grates under the target. Mind where you stand.'},
  venomSeal:{ch:'?',color:'#b6e04a',name:'Venom Seal',use:true,bagT:true,seal:'venom',desc:'Seals venom onto your weapon (or every weapon in a bag): hits leave poison gas on the target. Poison + fire = explosion.'},
  smelting:{ch:'?',color:'#c0a0ff',name:'Smelting Scroll',use:true,bagT:true,bagOnly:true,desc:'Read onto a bag: fuses every weapon inside into one, summing their bonuses and keeping every seal.'},
  recharge:{ch:'?',color:'#fff6a0',name:'Recharge Scroll',use:true,bagT:true,desc:'+1 charge to every staff you carry — or +2 to every staff inside a chosen bag.'},
};
ITEMS.inferno.bagT=true;ITEMS.inferno.desc+=' Read onto a bag: cooks the food inside, burns paper and herbs, and detonates any jars (on you).';
ITEMS.rain.bagT=true;ITEMS.rain.desc+=' Read onto a bag: seeds inside sprout into herbs.';
const WEAPONS={dagger:{name:'Dagger',atk:2},club:{name:'Club',atk:3},katana:{name:'Katana',atk:5},pickaxe:{name:'Pickaxe',atk:2,dig:true},greatsword:{name:'Greatsword',atk:7},mithril:{name:'Mithril Edge',atk:9}};
const SEALS={fire:{tag:'F',name:'flame'},ice:{tag:'I',name:'frost'},bolt:{tag:'T',name:'thunder'},venom:{tag:'V',name:'venom'}};
const ITEM_W=[['onigiri',13],['herb',11],['meat',3],['fireStaff',6],['iceStaff',5],['boltStaff',5],['galeStaff',5],['oilJar',8],['miasma',5],['seeds',6],['inferno',4],['rain',4],['blizzard',4],
  ['weapon',6],['pouch',3],['satchel',2],['coldbox',2],['honing',5],['flameSeal',2],['frostSeal',2],['thunderSeal',2],['venomSeal',2],['smelting',2],['recharge',2],['lumber',6],['dryGrass',6],['reveal',3],['storm',3]];
const MON={
  rat:{ch:'r',name:'cave rat',color:'#c8a27c',hp:5,atk:2,def:0,xp:2,min:1,w:9,ai:'wander',meat:.25},
  goblin:{ch:'g',name:'goblin',color:'#9be070',hp:9,atk:3,def:1,xp:5,min:1,w:8,ai:'hunt',meat:.3},
  beetle:{ch:'b',name:'moss beetle',color:'#b6c95a',hp:6,atk:1,def:2,xp:3,min:1,w:6,ai:'graze'},
  slime:{ch:'s',name:'slime',color:'#5fe8c8',hp:10,atk:2,def:0,xp:3,min:2,w:6,ai:'hunt',split:true},
  ember:{ch:'e',name:'ember imp',color:'#ff8a3d',hp:7,atk:3,def:0,xp:6,min:2,w:6,ai:'wander',fireImmune:true,trail:true},
  toad:{ch:'t',name:'bog toad',color:'#8fc93a',hp:8,atk:2,def:0,xp:6,min:2,w:5,ai:'hunt',poisonImmune:true,puffer:true,meat:.2},
  thief:{ch:'T',name:'thief',color:'#f0d860',hp:8,atk:1,def:1,xp:8,min:3,w:4,ai:'hunt',steal:true},
  ogre:{ch:'O',name:'ogre',color:'#e0645a',hp:22,atk:6,def:2,xp:15,min:4,w:4,ai:'hunt',slow:true,panicky:true,meat:.6},
  wraith:{ch:'W',name:'frost wraith',color:'#d8f0ff',hp:14,atk:4,def:1,xp:12,min:4,w:4,ai:'hunt',frost:true,coldImmune:true},
};
const DIRECT=new Set(['you','zap']);
const FINAL_FLOOR=10;

let G=null, faceMode=false, SB=null;

function pickW(list,r){let s=0;for(const [,w] of list)s+=w;let v=r*s;for(const [k,w] of list){if((v-=w)<0)return k}return list[0][0]}
const STACK={lumber:20,dryGrass:20,seeds:10,herb:10,ironOre:10,mithrilOre:10,ironBar:10,mithrilBar:10};
const qty=it=>it.n||1;
// merge `it` into same-kind stacks of `list`; returns what is left over (or null)
function mergeInto(list,it){const max=STACK[it.kind];if(!max)return it;
  for(const o of list){if(o===it||o.kind!==it.kind||qty(o)>=max)continue;const mv=Math.min(max-qty(o),qty(it));o.n=qty(o)+mv;it.n=qty(it)-mv;if(it.n<=0)return null}
  return it}
// put an item (or stack) into the pack: fills existing stacks first, then free slots. false = some is left in `it`
function addToPack(it){const p=G.player,max=STACK[it.kind];let left=mergeInto(p.inv,it);
  while(left){if(p.inv.length>=12)return false;
    if(max&&qty(left)>max){p.inv.push(Object.assign({},left,{n:max}));left.n-=max}else{p.inv.push(left);left=null}}
  return true}
function placeFloor(x,y,it){if(STACK[it.kind]){const o=G.floorItems.find(f=>f.x===x&&f.y===y&&f.it.kind===it.kind);if(o){o.it.n=qty(o.it)+qty(it);return}}G.floorItems.push({x,y,it})}
// take one unit from a stack (or the whole item if it is not stacked)
function takeOne(list,k){const it=list[k];if(qty(it)>1){it.n--;return Object.assign({},it,{n:1})}return list.splice(k,1)[0]}
function mkItem(kind){const it={kind};if(STACK[kind])it.n=1;if(ITEMS[kind].staff)it.charges=3+Math.floor(G.rng()*3);if(kind==='meat')it.age=0;
  if(kind==='weapon'){it.w=pickW([['dagger',4],['club',4],['katana',2],['pickaxe',2]],G.rng());it.plus=G.rng()<0.3?1:0;it.seals=[]}
  if(ITEMS[kind].bag)it.items=[];
  if(kind==='gold')it.amt=Math.round((10+G.rng()*20)*Math.max(1,G.depth));
  return it}
function mkWeapon(w,plus=0,seals=[]){return {kind:'weapon',w,plus,seals:[...seals]}}
const isBag=it=>!!ITEMS[it.kind].bag;
function itemName(it){
  if(it.kind==='weapon'){const w=WEAPONS[it.w];return `${w.name}${it.plus?(it.plus>0?'+':'')+it.plus:''}${it.seals.length?' ['+it.seals.map(s=>SEALS[s].tag).join('')+']':''}`}
  if(isBag(it))return `${ITEMS[it.kind].name} (${it.items.length}/${ITEMS[it.kind].bag})`;
  if(it.kind==='gold')return `${it.amt} gold`;
  if(qty(it)>1)return `${ITEMS[it.kind].name} ×${qty(it)}`;
  return ITEMS[it.kind].name+(it.charges!=null?` [${it.charges}]`:'')+(it.frozen?' (frozen)':'')}
function atkOf(e){return e.isPlayer&&e.weapon?e.atk+WEAPONS[e.weapon.w].atk+e.weapon.plus:e.atk}
function mkMonster(kind,x,y){const d=MON[kind],dp=G.depth-1,hp=d.hp+Math.floor(dp*1.2);
  const m=Object.assign({},d,{kind,x,y,hp,maxhp:hp,atk:d.atk+Math.floor(dp/3),frozen:0,stuck:0,panic:0,puffCD:2,alert:0,sus:0,search:0,para:0,
    dir:Math.floor(G.rng()*8),tx:null,ty:null,id:++G.uid,face:null});m.face=DIRS8[m.dir];return m}

// ---------------- run / floor setup ----------------
function newRun(seed){
  P.seed=seed>>>0;
  G={depth:0,turn:0,uid:0,over:false,log:[],fx:[],flies:[],
     player:{x:0,y:0,ch:'@',name:'you',hp:24,maxhp:24,atk:2,def:1,lv:1,xp:0,full:100,face:[0,1],inv:[],isPlayer:true,stuck:0,gold:0,weapon:null},npc:null};
  nextFloor();
  const dg=mkWeapon('dagger');G.player.inv.push(dg,mkItem('onigiri'),mkItem('fireStaff'),mkItem('oilJar'),mkItem('galeStaff'),mkItem('pouch'));G.player.weapon=dg;autosave();
  say('Shift+dir or FACE to turn without moving. Staffs & throws fire where @ faces. Press ? for keyboard controls.','dim');
  updateHUD();
}
function nextFloor(){
  if(typeof stopExplore==='function'){stopExplore();exitLook()}
  G.depth++;
  if(G.depth>FINAL_FLOOR){victory();return}
  G.rng=mulberry32(hashU(P.seed,G.depth,0xA11CE,7));
  G.night=G.depth>=2&&h01(P.seed,G.depth,8,8)<P.nightChance;
  G.flies=[];
  genFloor();
  const p=G.player;
  const start=randomRoomCell(c=>[T_FLOOR,T_GRASS,T_DIRT].includes(G.tile[c]),G.stairRoom);
  p.x=start%W;p.y=(start/W)|0;p.stuck=0;
  G.npc=null;
  if(G.depth>=2&&h01(P.seed,G.depth,21,1)<0.5){const c=randomRoomCell(c=>[T_FLOOR,T_GRASS,T_DIRT].includes(G.tile[c]));G.npc={x:c%W,y:(c/W)|0,ch:'&',name:'blacksmith',npc:true}}
  const n=Math.round((4+G.depth*0.7)*P.monsterDensity);
  for(let k=0;k<n;k++)spawnMonster(true);
  const ni=5+Math.floor(G.rng()*3);
  for(let k=0;k<ni;k++){const c=randomRoomCell(c=>!COLD(G.tile[c])&&G.tile[c]!==T_VINE),it=mkItem(pickW(ITEM_W,G.rng()));
    if(it.kind==='lumber')it.n=1+Math.floor(G.rng()*3);else if(it.kind==='dryGrass')it.n=1+Math.floor(G.rng()*4);placeFloor(c%W,(c/W)|0,it)}
  if(G.rng()<0.6)spawnCamp(true);
  G.lit=false;G.storm=null;
  const ng=1+Math.floor(G.rng()*3);for(let k=0;k<ng;k++){const c=randomRoomCell(c=>!COLD(G.tile[c])&&G.tile[c]!==T_VINE);G.floorItems.push({x:c%W,y:(c/W)|0,it:mkItem('gold')})}
  if(G.npc)say('You hear the ring of a hammer. A blacksmith (&) works on this floor.','warn');
  const flavor=['The air is dry. Good burning weather.','Water drips somewhere.','You smell lamp oil.','Something scuttles in the grass.','The walls hum faintly.','Metal creaks underfoot.'];
  say(`B${G.depth}F — ${G.night?'Night falls. Only fire and fireflies give light.':flavor[hashU(P.seed,G.depth,3,3)%flavor.length]}`,'warn');
  camX=p.x;camY=p.y;
  computeView();
  autosave();
}
function allocLayers(){const N=W*H;
  G.tile=new Uint8Array(N);G.fuel=new Int16Array(N);G.gas=new Float32Array(N);G.pois=new Float32Array(N);
  G.heat=new Float32Array(N).fill(G.night?0.15:P.ambient);G.elec=new Uint8Array(N);G.src=new Uint8Array(N);G.stored=new Uint8Array(N);
  G.prints=new Uint8Array(N);G.seen=new Uint8Array(N);G.vis=new Uint8Array(N);G.light=new Float32Array(N);
  G.roomIdx=new Int16Array(N).fill(-1);G.ore=new Uint8Array(N);G.ents=[];G.floorItems=[];}
function genFloor(){
  const R=mulberry32(hashU(P.seed,G.depth,1,0)),N=W*H;
  allocLayers();
  const sw=16,sh=10,rooms=[];
  for(let gy=0;gy<3;gy++)for(let gx=0;gx<3;gx++){
    const x0=gx*sw,y0=gy*sh+1,real=R()<0.8||gx===gy;let rx,ry,rw,rh;
    if(real){rw=4+Math.floor(R()*(sw-7));rh=3+Math.floor(R()*(sh-5));rx=x0+1+Math.floor(R()*(sw-rw-2));ry=y0+1+Math.floor(R()*(sh-rh-2))}
    else{rw=1;rh=1;rx=x0+3+Math.floor(R()*(sw-6));ry=y0+2+Math.floor(R()*(sh-4))}
    rooms.push({x:rx,y:ry,w:rw,h:rh,gx,gy,real,lit:R()>=P.darkRooms});
  }
  rooms.forEach((r,k)=>{for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){G.tile[idx(x,y)]=T_FLOOR;if(r.real)G.roomIdx[idx(x,y)]=k}});
  const conns=[],vis=new Set([0]),has=new Set();
  while(vis.size<9){const cand=[];for(const a of vis){const ra=rooms[a];for(const [dx,dy] of DIRS4){const gx=ra.gx+dx,gy=ra.gy+dy;if(gx<0||gy<0||gx>2||gy>2)continue;const b=gy*3+gx;if(!vis.has(b))cand.push([a,b])}}
    const e=cand[Math.floor(R()*cand.length)];conns.push(e);vis.add(e[1]);has.add(Math.min(...e)*9+Math.max(...e))}
  for(let a=0;a<9;a++)for(const b of [a+1,a+3]){if(b>8||(b===a+1&&a%3===2))continue;if(!has.has(a*9+b)&&R()<0.25)conns.push([a,b])}
  const carve=(x,y)=>{if(G.tile[idx(x,y)]===T_WALL)G.tile[idx(x,y)]=T_FLOOR};
  for(let [a,b] of conns){
    let A=rooms[a],B=rooms[b];if(A.gx>B.gx||A.gy>B.gy)[A,B]=[B,A];
    const ax=A.x+Math.floor(R()*A.w),ay=A.y+Math.floor(R()*A.h),bx=B.x+Math.floor(R()*B.w),by=B.y+Math.floor(R()*B.h);
    if(A.gy===B.gy){const lo=A.x+A.w,hi=B.x-1,mx=lo+Math.floor(R()*Math.max(1,hi-lo+1));
      for(let x=Math.min(ax,mx);x<=Math.max(ax,mx);x++)carve(x,ay);
      for(let y=Math.min(ay,by);y<=Math.max(ay,by);y++)carve(mx,y);
      for(let x=Math.min(mx,bx);x<=Math.max(mx,bx);x++)carve(x,by);
    }else{const lo=A.y+A.h,hi=B.y-1,my=lo+Math.floor(R()*Math.max(1,hi-lo+1));
      for(let y=Math.min(ay,my);y<=Math.max(ay,my);y++)carve(ax,y);
      for(let x=Math.min(ax,bx);x<=Math.max(ax,bx);x++)carve(x,my);
      for(let y=Math.min(my,by);y<=Math.max(my,by);y++)carve(bx,y);
    }
  }
  const blob=(r,mat,rmin,rmax,ok)=>{const cx=r.x+R()*r.w,cy=r.y+R()*r.h,rad=rmin+R()*(rmax-rmin);
    for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const i=idx(x,y);if(!ok(G.tile[i]))continue;
      if(Math.hypot((x-cx)*0.8,y-cy)+R()*0.9<rad)G.tile[i]=mat}};
  const fl=t=>t===T_FLOOR;
  rooms.forEach(r=>{if(!r.real)return;
    if(R()<0.8){const nb=1+Math.floor(R()*3);for(let k=0;k<nb;k++)blob(r,T_GRASS,1.5,3.6,fl)}
    if(R()<0.35){blob(r,T_WATER,1,2.4,t=>t===T_FLOOR||t===T_GRASS);if(R()<0.5)blob(r,T_MUD,1,2.2,fl)}
    if(G.depth>=2&&R()<0.3)blob(r,T_OIL,0.8,1.8,fl);
    if(G.depth>=2&&R()<0.25)blob(r,T_GRATE,1.2,2.6,fl);
    if(G.night&&R()<0.5)blob(r,T_SNOW,1.5,3,t=>t===T_FLOOR||t===T_GRASS);
    if(R()<0.3){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const i=idx(x,y);if(G.tile[i]===T_GRASS&&wallCount8(x,y)>=3&&R()<0.5)G.tile[i]=T_VINE}}
  });
  for(let i=0;i<N;i++)if(G.tile[i]===T_FLOOR&&G.roomIdx[i]<0&&R()<0.015)G.tile[i]=T_VINE;
  for(let i=0;i<N;i++)if(COLD(G.tile[i]))G.heat[i]=0.12;
  G.rooms=rooms;
  const realIdx=rooms.map((r,k)=>r.real?k:-1).filter(k=>k>=0);
  G.stairRoom=realIdx[Math.floor(R()*realIdx.length)];
  const sc=randomRoomCell(c=>[T_FLOOR,T_GRASS,T_DIRT].includes(G.tile[c]),-1,G.stairRoom,R);
  G.tile[sc]=T_STAIRS;
  genTreesAndOre();
}
function genTreesAndOre(){
  const R=mulberry32(hashU(P.seed,G.depth,2,0));
  // trees: isolated (nothing solid around them) so they never cut a room off
  for(const r of G.rooms){if(!r.real||R()>=0.45)continue;const n=2+Math.floor(R()*5);
    for(let k=0;k<n*4&&k<60;k++){const x=r.x+1+Math.floor(R()*Math.max(1,r.w-2)),y=r.y+1+Math.floor(R()*Math.max(1,r.h-2)),i=idx(x,y);
      if(![T_FLOOR,T_GRASS,T_DIRT].includes(G.tile[i]))continue;let ok=true;
      for(const [dx,dy] of DIRS8){const t=G.tile[idx(x+dx,y+dy)];if(t===T_WALL||t===T_TREE||t===T_STAIRS||t===T_VINE){ok=false;break}}
      if(ok){G.tile[i]=T_TREE;G.fuel[i]=3}}}
  // ore veins in walls that face open ground
  const face=[];for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=idx(x,y);if(G.tile[i]!==T_WALL)continue;if(DIRS4.some(([dx,dy])=>passTile(G.tile[idx(x+dx,y+dy)])||G.tile[idx(x+dx,y+dy)]===T_TREE))face.push(i)}
  const vein=(kind,len)=>{let i=face[Math.floor(R()*face.length)];for(let k=0;k<len;k++){G.ore[i]=kind;const x=i%W,y=(i/W)|0;
    const nb=DIRS4.map(([dx,dy])=>idx(x+dx,y+dy)).filter(j=>G.tile[j]===T_WALL&&!G.ore[j]&&(j%W)>0&&(j%W)<W-1&&((j/W)|0)>0&&((j/W)|0)<H-1);if(!nb.length)break;i=nb[Math.floor(R()*nb.length)]}};
  if(face.length){const iv=2+Math.floor(R()*3);for(let k=0;k<iv;k++)vein(1,2+Math.floor(R()*3));
    if(G.depth>=3){const mv=Math.floor(R()*2)+(G.depth>=6?1:0);for(let k=0;k<mv;k++)vein(2,1+Math.floor(R()*2))}}
}
function wallCount8(x,y){let n=0;for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(!inb(nx,ny)||G.tile[idx(nx,ny)]===T_WALL)n++}return n}
function randomRoomCell(ok,avoidRoom=-1,onlyRoom=-1,R=G.rng){
  for(let tries=0;tries<800;tries++){
    const k=onlyRoom>=0?onlyRoom:Math.floor(R()*9);const r=G.rooms[k];if(!r.real||(k===avoidRoom&&tries<600))continue;
    const x=r.x+Math.floor(R()*r.w),y=r.y+Math.floor(R()*r.h),c=idx(x,y);
    if(!passTile(G.tile[c])||entAt(x,y)||(G.npc&&G.npc.x===x&&G.npc.y===y)||(G.player&&G.player.x===x&&G.player.y===y&&tries<700))continue;
    if(ok&&!ok(c))continue;return c;
  }
  for(let c=0;c<W*H;c++)if(G.tile[c]===T_FLOOR)return c;return 0;
}
function spawnMonster(initial){
  const list=Object.entries(MON).filter(([,d])=>d.min<=G.depth).map(([k,d])=>[k,d.w]);
  const kind=pickW(list,G.rng());
  const pr=G.roomIdx[idx(G.player.x,G.player.y)];
  const c=randomRoomCell(c=>G.tile[c]!==T_FIRE&&(initial||!G.vis[c]),initial?(G.stairRoom===pr?-1:pr):pr);
  if(G.vis[c]&&!initial)return;
  G.ents.push(mkMonster(kind,c%W,(c/W)|0));
}

function spawnCamp(initial){
  const c=randomRoomCell(c=>[T_FLOOR,T_DIRT,T_ASH].includes(G.tile[c])&&(initial||!G.vis[c]));
  if(!initial&&G.vis[c])return;
  const x=c%W,y=(c/W)|0;G.tile[c]=T_CAMP;G.fuel[c]=60+Math.floor(G.rng()*80);G.heat[c]=0.95;
  if(G.rng()<0.5){const d=DIRS8[Math.floor(G.rng()*8)];if(walkable(x+d[0],y+d[1])){const it=mkItem(G.rng()<0.6?'lumber':'dryGrass');it.n=1+Math.floor(G.rng()*3);placeFloor(x+d[0],y+d[1],it)}}
  if(!initial)say('You smell woodsmoke somewhere on this floor.','dim');
}
function campMenu(ci){
  const lit=G.tile[ci]===T_CAMP,fuel=G.fuel[ci],L=findItem('lumber'),opts=[];
  if(lit)opts.push({label:'Put it out — leaves a dark fire pit that keeps its fuel',ch:'~',color:'#7fb8ff',fn:()=>act(()=>{
    G.tile[ci]=T_PIT;G.heat[ci]=Math.min(G.heat[ci],0.6);G.gas[ci]=Math.min(1,G.gas[ci]+0.35);noise(ci%W,(ci/W)|0,2);
    say(`You smother the campfire. It's dark now. (${fuel} turns of fuel left in the pit)`,'dim');fxGlyph(ci%W,(ci/W)|0,'~','#9aa0a8',0,400)})});
  else opts.push({label:fuel>0?`Relight it — ${fuel} turns of fuel`:'Relight it — no fuel left (add lumber first)',ch:'^',color:'#ffb050',fn:()=>{
    if(fuel<=0){say('Nothing left to burn. Add some lumber first.','dim');return campMenu(ci)}
    act(()=>{G.tile[ci]=T_CAMP;G.heat[ci]=0.95;say('You strike a spark. The campfire crackles back to life.','fire');fxGlyph(ci%W,(ci/W)|0,'^','#ffb050',0,500)})}});
  opts.push({label:L?`Add lumber (+60 fuel → ${fuel+60})`:'Add lumber — you have none',ch:'=',color:'#c08a50',fn:()=>{
    if(!findItem('lumber')){say('You have no lumber.','dim');return campMenu(ci)}
    act(()=>{removeFound(findItem('lumber'));G.fuel[ci]=Math.min(9999,G.fuel[ci]+60);say(`You add lumber to the ${lit?'campfire':'fire pit'}. (${G.fuel[ci]} turns of fuel)`,lit?'fire':'')})}});
  choose(lit?`CAMPFIRE · ${fuel} TURNS OF FUEL`:`FIRE PIT (OUT) · ${fuel} TURNS OF FUEL`,opts,closeModal);
}
function nextToCamp(){const p=G.player;for(const [dx,dy] of DIRS8){const x=p.x+dx,y=p.y+dy;if(inb(x,y)&&G.tile[idx(x,y)]===T_CAMP)return true}return false}
// find an item in pack or bags: returns [container,index]
function findItem(kind){const p=G.player;let k=p.inv.findIndex(x=>x.kind===kind);if(k>=0)return [p.inv,k];
  for(const b of p.inv)if(isBag(b)){k=b.items.findIndex(x=>x.kind===kind);if(k>=0)return [b.items,k]}return null}
function removeFound([arr,k]){return takeOne(arr,k)}
const BUILD_OK=[T_FLOOR,T_DIRT,T_ASH,T_GRASS,T_OIL];
function buildCampfire(){
  const p=G.player,[dx,dy]=p.face,x=p.x+dx,y=p.y+dy,i=idx(x,y);
  const L=findItem('lumber'),D=findItem('dryGrass');
  if(!L||!D){say('You need Lumber and Dry Grass to build a campfire.','dim');return false}
  if(!inb(x,y)||!BUILD_OK.includes(G.tile[i])){say(`You can't build a fire on ${inb(x,y)?TNAME[G.tile[i]]:'that'}. Face bare ground.`,'dim');return false}
  if(occupant(x,y)){say('Something is in the way.','dim');return false}
  if(dx&&dy&&!canDiag(p.x,p.y,dx,dy)){say("You can't reach around the corner.",'dim');return false}
  removeFound(L);removeFound(findItem('dryGrass'));
  const t=G.tile[i];G.tile[i]=T_CAMP;G.fuel[i]=120;G.heat[i]=0.95;
  say(t===T_GRASS||t===T_OIL?`You build a campfire… on ${TNAME[t]}. Bold.`:'You stack the lumber, tuck in the kindling and strike a spark. A campfire crackles to life.','fire');
  fxGlyph(x,y,'^','#ffb050',0,500);return true}

// ---------------- queries ----------------
function passTile(t){return t!==T_WALL&&t!==T_VINE&&t!==T_VINE_ICE&&t!==T_CAMP&&t!==T_TREE&&t!==T_PIT}
function entAt(x,y){if(!G.ents)return null;for(const e of G.ents)if(!e.dead&&e.x===x&&e.y===y)return e;return null}
function occupant(x,y){return entAt(x,y)||(G.player.x===x&&G.player.y===y?G.player:null)||(G.npc&&G.npc.x===x&&G.npc.y===y?G.npc:null)}
function canDiag(x,y,dx,dy){if(dx&&dy)return G.tile[idx(x+dx,y)]!==T_WALL&&G.tile[idx(x,y+dy)]!==T_WALL;return true}
function walkable(x,y){return inb(x,y)&&passTile(G.tile[idx(x,y)])}
function blocksSight(i){const t=G.tile[i];return t===T_WALL||t===T_TREE||t===T_VINE||t===T_VINE_ICE||G.gas[i]+G.pois[i]>0.85}
function los(x0,y0,x1,y1){let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx+dy,x=x0,y=y0;
  while(!(x===x1&&y===y1)){const e2=2*err;if(e2>=dy){err+=dy;x+=sx}if(e2<=dx){err+=dx;y+=sy}
    if(x===x1&&y===y1)return true;if(blocksSight(y*W+x))return false}return true}
function nearestFire(x,y,r){let best=null,bd=99;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=x+dx,ny=y+dy;if(!inb(nx,ny)||(G.tile[idx(nx,ny)]!==T_FIRE&&G.tile[idx(nx,ny)]!==T_CAMP))continue;const d=Math.hypot(dx,dy);if(d<bd){bd=d;best=[nx,ny]}}return best}

// ---------------- view / light ----------------
// Environment light: everything except the player's own torch. Walls and thick smoke cast shadows.
function computeLight(){
  const N=W*H,L=new Float32Array(N);
  if(G.lit)L.fill(0.7);
  if(!G.night)for(const r of G.rooms){if(!r.real||!r.lit)continue;for(let y=r.y-1;y<=r.y+r.h;y++)for(let x=r.x-1;x<=r.x+r.w;x++){if(!inb(x,y))continue;const j=idx(x,y);
    const edge=(x<r.x||y<r.y||x>=r.x+r.w||y>=r.y+r.h)?0.45:0.55;if(L[j]<edge)L[j]=edge}}
  const add=(fx,fy,str,rad)=>{const R=Math.ceil(rad);for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const x=fx+dx,y=fy+dy;if(!inb(x,y))continue;const d=Math.hypot(dx,dy);if(d>rad)continue;
    const j=idx(x,y),v=str*(1-d/(rad+0.4));if(v<=L[j])continue;if((dx||dy)&&!los(fx,fy,x,y))continue;L[j]=v}};
  for(let i=0;i<N;i++){const t=G.tile[i];if(t===T_CAMP)add(i%W,(i/W)|0,1,4.6);else if(t===T_FIRE)add(i%W,(i/W)|0,1,3.6);else if(G.elec[i])add(i%W,(i/W)|0,0.7,3);else if(t===T_SLICK&&G.stored[i])add(i%W,(i/W)|0,0.35,1.5)}
  for(const f of G.flies)add(f.x,f.y,0.65,2.5);
  if(G.strikeAt&&G.strikeAt.turn===G.turn)add(G.strikeAt.x,G.strikeAt.y,1,7);
  G.env=L;
}
function torchRadius(){return G.torch===false?0:G.night?Math.max(1.5,P.lightRadius-3):P.lightRadius}
// how lit the player is, as seen by others (0 = pitch dark)
function playerLightLevel(){const p=G.player;return Math.min(1.2,(G.env?G.env[idx(p.x,p.y)]:0.5)+(torchRadius()?0.7:0))}
function computeView(){
  computeLight();
  const p=G.player,N=W*H,tr=torchRadius();
  if(G.sandbox){G.vis.fill(1);G.seen.fill(1);for(let i=0;i<N;i++){const d=Math.hypot(i%W-p.x,((i/W)|0)-p.y);G.light[i]=Math.max(0.28,G.env[i],tr?1-d/(tr+0.5):0)}computeCones();buildMinimap();return}
  G.vis.fill(0);G.light.fill(0);
  if(G.lit){for(let i=0;i<N;i++){G.vis[i]=1;G.seen[i]=1;G.light[i]=Math.max(0.6,G.env[i])}computeCones();buildMinimap();return}
  const VR=14;
  for(let y=p.y-VR;y<=p.y+VR;y++)for(let x=p.x-VR;x<=p.x+VR;x++){
    if(!inb(x,y))continue;const i=idx(x,y),d=Math.hypot(x-p.x,y-p.y);
    let L=Math.max(G.env[i],tr?Math.max(0,1-d/(tr+0.5)):0);
    if(d<=(tr?1.5:2.5))L=Math.max(L,tr?0.22:0.16);   // you can always make out what's close; eyes adjust without a torch
    if(L<=0.04)continue;
    if(!los(p.x,p.y,x,y))continue;
    L=Math.max(L*(1-Math.min(0.45,(G.gas[i]+G.pois[i])*0.45)),G.env[i]*0.85);
    G.vis[i]=1;G.seen[i]=1;G.light[i]=Math.max(L,0.08);
  }
  // silhouettes: creatures in line of sight within 8 tiles can be made out even in darkness
  for(const m of G.ents){m.silhouette=false;const i=idx(m.x,m.y);if(G.vis[i]||cheb(m.x,m.y,p.x,p.y)>8||!los(p.x,p.y,m.x,m.y))continue;G.vis[i]=1;G.seen[i]=1;G.light[i]=Math.max(G.light[i],0.1);m.silhouette=true}
  computeCones();buildMinimap();
}
// ---------------- perception ----------------
function facingDot(m,x,y){const [fx,fy]=m.face||DIRS8[m.dir||0],vx=x-m.x,vy=y-m.y,l=Math.hypot(vx,vy);if(!l)return 1;return (fx*vx+fy*vy)/(Math.hypot(fx,fy)*l)}
function detects(m){
  const p=G.player,d=cheb(m.x,m.y,p.x,p.y);if(d>9||!los(m.x,m.y,p.x,p.y))return false;
  const dot=facingDot(m,p.x,p.y);
  if(d<=1&&dot>-0.35)return true;
  const cone=dot>=0.35?1:dot>=-0.35?0.35:0.1;
  let chance=clamp((playerLightLevel()*1.3-(d-1)*0.07+(m.alert>0?0.35:0))*cone,0,1);
  if(dot>=0.35&&d<=2)chance=Math.max(chance,0.3);  // close and in front: it can sense you even in the dark
  return h01(P.seed,G.turn,m.id,60)<chance;
}
function faceToward(m,x,y){const dx=sgn(x-m.x),dy=sgn(y-m.y);if(dx||dy)m.face=[dx,dy]}
// A sound at (x,y) carries r tiles; walls muffle it to half that. Every creature that hears it turns to face it.
// Unaware ones grow suspicious and go to look; alerted ones that have lost sight of you go to check it too.
function noise(x,y,r){
  const p=G.player;let heard=0;
  for(const m of G.ents){if(m.dead)continue;const d=cheb(m.x,m.y,x,y);if(d>r)continue;
    if(d>Math.ceil(r/2)&&!los(m.x,m.y,x,y))continue;
    faceToward(m,x,y);heard++;
    if(m.alert>0){if(!los(m.x,m.y,p.x,p.y)){m.tx=x;m.ty=y}}
    else{m.sus=Math.max(m.sus,4);m.tx=x;m.ty=y}
    if(seenBy(m.x,m.y))fxGlyph(m.x,m.y,'?','#ffe24a',0,600)}
  return heard;
}
// how far a thrown item's landing carries
function throwNoise(it){const k=it.kind;return Math.max(1,P.throwNoise+(['weapon','oilJar','miasma','lumber'].includes(k)||isBag(it)?1:['seeds','dryGrass','herb','onigiri','grilled'].includes(k)?-2:0))}
function computeCones(){
  const N=W*H;if(!G.cone||G.cone.length!==N)G.cone=new Uint8Array(N);G.cone.fill(0);
  if(P.showCones!=='On')return;
  for(const m of G.ents){if(!G.vis[idx(m.x,m.y)])continue;const v=m.alert>0?2:1;
    for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){if(!dx&&!dy)continue;const x=m.x+dx,y=m.y+dy;if(!inb(x,y)||Math.hypot(dx,dy)>5.3)continue;const i=idx(x,y);
      if(G.tile[i]===T_WALL||!G.seen[i]||facingDot(m,x,y)<0.38||!los(m.x,m.y,x,y))continue;G.cone[i]=Math.max(G.cone[i],v)}}
}

// ---------------- messages / fx ----------------
function say(msg,cls=''){G.log.push({msg,cls});if(G.log.length>40)G.log.shift();renderLog()}
function fxText(x,y,text,color){G.fx.push({k:'t',x,y,text,color,t0:performance.now(),dur:800})}
function fxGlyph(x,y,ch,color,delay=0,dur=260){G.fx.push({k:'g',x,y,ch,color,t0:performance.now()+delay,dur})}
const seenBy=(x,y)=>inb(x,y)&&G.vis[idx(x,y)];

// ---------------- combat ----------------
function Name(e){return e.isPlayer?'You':'The '+e.name}
function attack(a,b){
  const R=G.rng;
  let mult=1;
  if(a.isPlayer&&!b.isPlayer&&!b.npc){if(!b.face)b.face=DIRS8[b.dir||0];
    const behind=facingDot(b,a.x,a.y)<-0.35,unaware=!(b.alert>0)||b.para>0;
    mult=behind&&unaware?3:behind||unaware?2:1;
    b.alert=8;b.sus=0;b.tx=a.x;b.ty=a.y;
    noise(a.x,a.y,4)}
  if(mult===1&&R()>(a.isPlayer?0.92:0.85)){if(a.isPlayer||seenBy(a.x,a.y))say(`${Name(a)} ${a.isPlayer?'miss':'misses'}.`,'dim');fxText(b.x,b.y,'miss','#6b7787');return}
  let dmg=Math.max(1,atkOf(a)+Math.floor(R()*3)-b.def)*mult;
  if(mult>1){say(mult===3?`CRITICAL! You strike the unsuspecting ${b.name} from behind! ×3`:`Sneak attack on the ${b.name}! ×2`,'good');fxText(b.x,b.y-0.4,mult===3?'CRIT ×3':'×2','#ffd84a')}
  if(!a.isPlayer&&a.steal&&!a.carry&&G.player.inv.length){
    const k=Math.floor(R()*G.player.inv.length);a.carry=G.player.inv.splice(k,1)[0];a.fleeing=true;if(a.carry===G.player.weapon)G.player.weapon=null;
    say(`The thief snatches your ${itemName(a.carry)} and bolts!`,'bad');return}
  if(b.isPlayer)G.cause=`a ${a.name}`;
  const seals=a.isPlayer&&a.weapon?a.weapon.seals:[],bx=b.x,by=b.y;
  if(seals.includes('fire')&&!b.fireImmune)dmg+=2;
  if(seals.includes('bolt'))dmg+=2;
  hurt(b,dmg,a.isPlayer?'you':'monster');
  if(seals.length)sealHit(b,bx,by,seals);
  if(!b.dead&&!b.isPlayer&&a.isPlayer)faceToward(b,a.x,a.y);
}
function sealHit(b,x,y,seals){
  const i=idx(x,y);
  if(seals.includes('fire')){ignite(i);fxGlyph(x,y,'*','#ff8a3d',0,220)}
  if(seals.includes('ice')){if(G.tile[i]===T_WATER)frostCell(i);if(!b.dead&&!b.coldImmune&&G.rng()<0.35){b.frozen=Math.max(b.frozen,2);say(`The ${b.name} freezes!`,'ice')}fxGlyph(x,y,'+','#9fe8ff',0,220)}
  if(seals.includes('bolt')){fxGlyph(x,y,'ϟ','#fff27a',0,220);if(G.tile[i]===T_WATER||G.tile[i]===T_GRATE)electrify(x,y)}
  if(seals.includes('venom')){G.pois[i]=Math.min(1,G.pois[i]+0.6);fxGlyph(x,y,'%','#b6e04a',0,220)}
}
const CAUSE_TEXT={lightning:'a lightning strike',flames:'the flames',electrocution:'electrocution',blast:'an explosion','poison gas':'poison gas','icy water':'icy water',heat:'the heat','searing grate':'a searing grate',crushed:'a hard landing',starvation:'starvation','rotten meat':'rotten meat'};
function hurt(e,dmg,cause){
  if(e.dead||G.over||e.npc)return;
  if(e.isPlayer&&((G.sandbox&&SB&&SB.god)||G.god)){fxText(e.x,e.y,'0','#6b7787');return}
  if(cause==='flames'&&e.coldImmune)dmg*=2;
  e.hp-=dmg;fxText(e.x,e.y,'-'+dmg,e.isPlayer?'#ff6a5a':'#ffffff');
  if(e.isPlayer){if(CAUSE_TEXT[cause])G.cause=CAUSE_TEXT[cause];
    if(e.hp<=0){if(G.sandbox){e.hp=e.maxhp;say(`That would have killed you (${G.cause||cause}). HP restored.`,'bad');return}e.hp=0;gameOver()}return}
  if(e.hp<=0){kill(e,cause);return}
  if(e.split&&e.hp>=4)trySplit(e);
}
function trySplit(e){
  if(G.ents.length>=45)return;
  const order=DIRS8.slice().sort((a,b)=>h01(G.turn,e.id,a[0]*3+a[1],1)-h01(G.turn,e.id,b[0]*3+b[1],1));
  for(const [dx,dy] of order){const nx=e.x+dx,ny=e.y+dy;if(walkable(nx,ny)&&!occupant(nx,ny)&&G.tile[idx(nx,ny)]!==T_FIRE){
    const c=mkMonster('slime',nx,ny);c.hp=c.maxhp=Math.floor(e.hp/2);e.hp-=c.hp;c.tx=e.tx;c.ty=e.ty;G.ents.push(c);
    if(seenBy(e.x,e.y))say('The slime splits in two!','warn');return}}
}
const VERB={lightning:'is struck down',flames:'burns to cinders',electrocution:'is fried',water:'fizzles out',blast:'is blown apart','poison gas':'chokes on the gas','icy water':'sinks into the icy water',heat:'collapses from the heat','searing grate':'is seared on the grate',crushed:'is smashed'};
function kill(e,cause){
  e.dead=true;
  const env=!DIRECT.has(cause)&&cause!=='monster';
  if(seenBy(e.x,e.y))say(`The ${e.name} ${VERB[cause]||'is defeated'}.${env?' (environment kill ×2 XP)':''}`,env?'fire':'');
  if(e.carry){G.floorItems.push({x:e.x,y:e.y,it:e.carry});say(`It drops your ${itemName(e.carry)}.`,'good')}
  else if(e.meat&&h01(P.seed,e.id,G.turn,5)<e.meat)G.floorItems.push({x:e.x,y:e.y,it:mkItem('meat')});
  else if(h01(P.seed,e.id,G.turn,6)<0.3){const g=mkItem('gold');g.amt=Math.round(g.amt*0.6);G.floorItems.push({x:e.x,y:e.y,it:g})}
  gainXp(e.xp*(env?2:1));
  G.ents=G.ents.filter(m=>!m.dead);
}
function xpNeed(lv){return 5*lv*(lv+1)}
function gainXp(n){const p=G.player;p.xp+=n;while(p.xp>=xpNeed(p.lv)){p.xp-=xpNeed(p.lv);p.lv++;p.maxhp+=4;p.hp+=4;p.atk+=1;say(`Level up! You are now Lv${p.lv}.`,'good')}}

// ---------------- material transforms ----------------
function ignite(i){const t=G.tile[i];
  if(t===T_GRASS){G.tile[i]=T_FIRE;G.fuel[i]=P.burnTime;G.src[i]=1}
  else if(t===T_OIL||t===T_SLICK){G.tile[i]=T_FIRE;G.fuel[i]=2;G.src[i]=2;G.stored[i]=0}
  else if(t===T_VINE){G.tile[i]=T_FIRE;G.fuel[i]=2;G.src[i]=3}
  else if(t===T_TREE){G.tile[i]=T_FIRE;G.fuel[i]=10;G.src[i]=4}
  else if(t===T_PIT&&G.fuel[i]>0){G.tile[i]=T_CAMP;if(G.vis[i])say('The fire pit catches and flares back to life.','fire')}
  else if(t===T_VINE_ICE)G.tile[i]=T_VINE;
  else if(t===T_ICE||t===T_SNOW){G.tile[i]=T_WATER;plunge(i)}
  else if(t===T_MUD)G.tile[i]=T_DIRT;
  else if(t===T_WATER)G.gas[i]=Math.min(1,G.gas[i]+0.6);
  if(t!==T_WALL&&t!==T_WATER)G.heat[i]=Math.max(G.heat[i],0.9);
}
function frostCell(i){const t=G.tile[i];
  if(t===T_WATER)G.tile[i]=T_ICE;
  else if(t===T_CAMP){G.tile[i]=T_PIT;if(G.vis[i])say('The campfire is snuffed out — it can be relit.','ice')}
  else if(t===T_FIRE){if(G.src[i]===2){G.tile[i]=T_SLICK;G.stored[i]=1}else G.tile[i]=T_ASH;G.fuel[i]=0}
  else if(t===T_OIL){G.tile[i]=T_SLICK;G.stored[i]=0}
  else if(t===T_VINE)G.tile[i]=T_VINE_ICE;
  else if(t===T_FLOOR||t===T_GRASS||t===T_DIRT||t===T_ASH)G.tile[i]=T_SNOW;
  if(t!==T_WALL)G.heat[i]=0;
}
function plunge(i){const x=i%W,y=(i/W)|0,e=occupant(x,y);if(!e||e.dead)return;
  if(e.isPlayer)say('The ice gives way — you plunge into freezing water!','bad');else if(seenBy(x,y))say(`The ice cracks under the ${e.name}!`,'ice');
  if(!e.isPlayer&&!e.coldImmune)e.frozen=Math.max(e.frozen,1);
  hurt(e,3,'icy water')}

// ---------------- world: cellular automata ----------------
function diffuse(src,emit,decay,wx,wy,ws){
  const N=W*H,t=G.tile,out=new Float32Array(N);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(t[i]===T_WALL)continue;
    let s=src[i]*0.5;
    for(const [dx,dy] of DIRS4){const nx=x+dx,ny=y+dy,ni=ny*W+nx;const w=0.125*(1+ws*(-dx*wx-dy*wy));
      s+=(inb(nx,ny)&&t[ni]!==T_WALL?src[ni]:src[i])*w}
    s=(s+emit[i])*decay;out[i]=s<0.01?0:Math.min(1,s)}
  return out;
}
function worldStep(){
  const N=W*H,t=G.tile,f=G.fuel,heat=G.heat,nt=t.slice(),nf=f.slice(),nh=new Float32Array(N);
  const [wx,wy]=WIND[P.windDir]||[0,0],ws=P.windStrength,T=G.turn,S=P.seed;
  const amb=G.night?Math.max(0,P.ambient-0.15):P.ambient;
  // 1. temperature field
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,c=t[i];
    if(c===T_WALL){nh[i]=amb;continue}
    if(c===T_FIRE){nh[i]=1;continue}
    if(c===T_CAMP){nh[i]=0.95;continue}
    let s=0,n=0;for(const [dx,dy] of DIRS4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const ni=ny*W+nx;if(t[ni]===T_WALL)continue;s+=heat[ni];n++}
    const k=c===T_GRATE?Math.min(0.9,P.heatDiffusion*2):COLD(c)?P.heatDiffusion*0.4:P.heatDiffusion;
    let h=heat[i]+(n?k*(s/n-heat[i]):0);
    const target=COLD(c)?0.1:amb;h+=(target-h)*(COLD(c)?0.1:0.04);
    nh[i]=clamp(h,0,1)}
  // 2. tile transitions
  const plunged=[],burntGrass=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,c=t[i];if(c===T_WALL)continue;
    let fireN=0,q=1,grassN=0,vineN=0,wallO=0;
    for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;
      if(!inb(nx,ny)){if(!(dx&&dy))wallO++;continue}
      const nc=t[ny*W+nx],orth=!(dx&&dy);
      if(orth){if(nc===T_GRASS)grassN++;if(nc===T_VINE)vineN++;if(nc===T_WALL)wallO++}
      if(nc===T_CAMP&&(c===T_GRASS||c===T_OIL||c===T_VINE||c===T_TREE)){fireN++;q*=1-clamp((c===T_OIL?P.oilSpread:P.fireSpread)*0.08*(orth?1:0.6),0,1);continue}
      if(nc!==T_FIRE)continue;fireN++;
      if(c===T_GRASS||c===T_OIL||c===T_VINE||c===T_TREE){
        const along=(-dx*wx-dy*wy)/Math.hypot(dx,dy);
        let base=c===T_OIL?P.oilSpread:c===T_VINE?P.vineSpread:c===T_TREE?P.fireSpread*0.45:P.fireSpread*(0.6+nh[i]*0.8);
        q*=1-clamp(base*(orth?1:0.7)*(1+ws*along*1.5),0,1)}
    }
    const r=h01(S,T,i,1),hh=nh[i];
    switch(c){
      case T_PIT: if(f[i]>0&&((fireN&&r<0.25)||(hh>P.ignitePoint&&h01(S,T,i,8)<0.3))){nt[i]=T_CAMP;if(G.vis[i])say('Flames reach the fire pit — it relights.','fire')}break;
      case T_CAMP: nf[i]=f[i]-1;if(nf[i]<=0){nt[i]=T_ASH;nf[i]=0;if(G.vis[i])say('A campfire burns down to embers.','dim')}break;
      case T_FIRE: nf[i]=f[i]-1;if(nf[i]<=0){nt[i]=T_ASH;nf[i]=0;if(G.src[i]===1)burntGrass.push(i)}break;
      case T_GRASS:case T_OIL:case T_VINE:case T_TREE:
        if((fireN&&r<1-q)||(hh>P.ignitePoint&&h01(S,T,i,6)<0.35)){nt[i]=T_FIRE;nf[i]=c===T_GRASS?P.burnTime:c===T_TREE?10:2;G.src[i]=c===T_GRASS?1:c===T_OIL?2:c===T_TREE?4:3;if(c===T_TREE&&G.vis[i])say('A tree goes up in flames!','fire')}
        else if(c===T_GRASS&&wallO>=2&&h01(S,T,i,7)<P.vineGrowth*0.5&&!occupant(x,y))nt[i]=T_VINE;
        break;
      case T_ASH: if(r<P.regrow)nt[i]=T_GRASS;break;
      case T_FLOOR:case T_DIRT:
        if(grassN&&r<P.grassGrowth*grassN*(c===T_DIRT?3:1))nt[i]=T_GRASS;
        else if(vineN&&wallO>=2&&h01(S,T,i,7)<P.vineGrowth*vineN&&!occupant(x,y)&&!G.floorItems.some(f=>f.x===x&&f.y===y))nt[i]=T_VINE;
        break;
      case T_ICE: if(hh>P.meltPoint&&r<0.5){nt[i]=T_WATER;plunged.push(i)}break;
      case T_SNOW: if(hh>P.meltPoint-0.05&&r<0.5)nt[i]=T_WATER;break;
      case T_SLICK: if(hh>P.meltPoint&&r<0.5){if(G.stored[i]){nt[i]=T_FIRE;nf[i]=2;G.src[i]=2;G.stored[i]=0}else nt[i]=T_OIL}break;
      case T_VINE_ICE: if(hh>P.meltPoint-0.05&&r<0.5)nt[i]=T_VINE;break;
      case T_MUD: if(hh>0.7&&r<0.3)nt[i]=T_DIRT;break;
      case T_WATER: if(hh>0.92&&r<0.05)nt[i]=T_FLOOR;break;
    }
  }
  // 3. air: smoke/steam + poison
  const es=new Float32Array(N),ep=new Float32Array(N);
  for(let i=0;i<N;i++){if(t[i]===T_CAMP)es[i]=P.smoke*0.1;else if(t[i]===T_FIRE)es[i]=P.smoke*0.45;else if(t[i]===T_WATER&&nh[i]>0.5)es[i]=0.15+0.25*P.smoke}
  for(const fi of G.floorItems)if(fi.it.kind==='rotten')ep[idx(fi.x,fi.y)]+=0.12;
  let ng=diffuse(G.gas,es,0.9,wx,wy,ws),np=diffuse(G.pois,ep,P.poisonDecay,wx,wy,ws);
  G.tile=nt;G.fuel=nf;G.heat=nh;G.gas=ng;G.pois=np;
  for(const i of plunged)plunge(i);
  // 4. poison flash: any poison touching fire/extreme heat detonates the whole connected cloud
  const seeds=[];
  for(let i=0;i<N;i++){if(np[i]<P.flashThreshold)continue;const x=i%W,y=(i/W)|0;
    let hot=nt[i]===T_FIRE||nh[i]>0.85;if(!hot)for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(inb(nx,ny)&&nt[ny*W+nx]===T_FIRE){hot=true;break}}
    if(hot)seeds.push(i)}
  if(seeds.length)flash(seeds);
  // 5. timers, fireflies
  for(let i=0;i<N;i++){if(G.elec[i])G.elec[i]--;if(G.prints[i])G.prints[i]--}
  for(const i of burntGrass)if(h01(S,T,i,12)<P.fireflies&&G.flies.length<40)G.flies.push({x:i%W,y:(i/W)|0,ttl:30+Math.floor(h01(S,T,i,13)*30),id:++G.uid});
  for(const fl of G.flies){const d=DIRS8[hashU(S,T,fl.id,14)%8],nx=fl.x+d[0],ny=fl.y+d[1];
    if(inb(nx,ny)&&G.tile[idx(nx,ny)]!==T_WALL&&h01(S,T,fl.id,15)<0.7){fl.x=nx;fl.y=ny}fl.ttl--}
  G.flies=G.flies.filter(f=>f.ttl>0&&G.tile[idx(f.x,f.y)]!==T_WATER);
  if(G.storm)stormStep();
  // 6. floor items react to fire
  for(const fi of G.floorItems.slice()){
    const i=idx(fi.x,fi.y),ti=G.tile[i];if(ti!==T_FIRE&&ti!==T_CAMP)continue;
    const k=fi.it.kind,vis=G.vis[i];
    if(k==='lumber'){G.floorItems.splice(G.floorItems.indexOf(fi),1);
      const n=qty(fi.it);
      if(ti===T_CAMP){G.fuel[i]=Math.min(9999,G.fuel[i]+60*n);if(vis)say(`The lumber catches. The campfire roars higher. (+${60*n} fuel)`,'fire')}
      else{G.tile[i]=T_CAMP;G.fuel[i]=Math.min(9999,80+60*(n-1));if(vis)say('Burning lumber settles into a steady campfire.','fire')}continue}
    if(isBag(fi.it)&&ITEMS[k].fireproof)continue;
    if(isBag(fi.it)){G.floorItems.splice(G.floorItems.indexOf(fi),1);if(vis)say(`The ${ITEMS[k].name} burns away, spilling its contents!`,'fire');scatter(fi.x,fi.y,fi.it.items);continue}
    if(k==='onigiri'){fi.it.kind='grilled';if(vis)say('An onigiri sizzles in the flames… grilled!','fire')}
    else if(k==='meat'||k==='rotten'){fi.it.kind=k==='meat'?'cooked':'tainted';if(vis)say(k==='meat'?'Meat sizzles in the fire. Cooked!':'Rotten meat crackles in the fire… it smells strange.','fire')}
    else if(k==='oilJar'){G.floorItems.splice(G.floorItems.indexOf(fi),1);explode(fi.x,fi.y,'An oil jar explodes!')}
    else if(k==='miasma'){G.floorItems.splice(G.floorItems.indexOf(fi),1);poisonCloud(fi.x,fi.y,2,1);if(vis)say('A miasma jar cracks in the heat…','warn')}
    else if(['herb','seeds','dryGrass'].includes(k)||ITEMS[k].ch==='?'){G.floorItems.splice(G.floorItems.indexOf(fi),1);if(vis)say(`The ${ITEMS[k].name} burns up.`,'fire')}
  }
}
function flash(seeds){
  const seen=new Set(seeds),q=seeds.map(i=>[i,0]);let any=false,n=0;
  while(q.length){const [i,d]=q.shift();const x=i%W,y=(i/W)|0;n++;
    if(G.vis[i])any=true;
    fxGlyph(x,y,'✶','#e8ff7a',d*35,320);
    G.pois[i]=0;G.heat[i]=1;
    const t=G.tile[i];if(t===T_GRASS||t===T_OIL||t===T_VINE||t===T_SLICK)ignite(i);
    else if(t===T_FLOOR||t===T_DIRT||t===T_ASH){G.tile[i]=T_FIRE;G.fuel[i]=1;G.src[i]=0}
    const e=occupant(x,y);if(e&&!e.dead){if(e.isPlayer)G.cause='a gas explosion';hurt(e,6,'blast')}
    for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=ny*W+nx;if(seen.has(j)||G.pois[j]<0.06||G.tile[j]===T_WALL)continue;seen.add(j);q.push([j,d+1])}}
  if(any)say(`The poison cloud ignites! (${n} tiles)`,'fire');
}
function poisonCloud(x,y,r,amt){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=x+dx,ny=y+dy;if(!inb(nx,ny)||Math.hypot(dx,dy)>r+0.3)continue;const i=idx(nx,ny);if(G.tile[i]===T_WALL)continue;G.pois[i]=Math.min(1,G.pois[i]+amt*(1-Math.hypot(dx,dy)/(r+1.5)))}}
function explode(x,y,msg){
  noise(x,y,6);
  if(seenBy(x,y))say(msg,'fire');
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const i=idx(nx,ny),t=G.tile[i];
    if(t===T_WALL||t===T_STAIRS)continue;
    if(t===T_WATER||t===T_ICE||t===T_SNOW||t===T_MUD||t===T_VINE_ICE){ignite(i);continue}
    if(t===T_GRASS||t===T_OIL||t===T_VINE||t===T_SLICK)ignite(i);else{G.tile[i]=T_FIRE;G.fuel[i]=1;G.src[i]=0}
    G.heat[i]=1;G.gas[i]=Math.max(G.gas[i],Math.min(0.7,G.gas[i]+0.25));
    fxGlyph(nx,ny,'@','#ffd27a',0,300);
    const e=occupant(nx,ny);if(e){if(e.isPlayer)G.cause='an explosion';hurt(e,8,'blast')}
  }
}
// ---------------- storm (one room) ----------------
function stormArea(){const p=G.player,ri=G.roomIdx[idx(p.x,p.y)];
  if(ri>=0){const r=G.rooms[ri];return [r.x-1,r.y-1,r.x+r.w,r.y+r.h]}
  return [Math.max(0,p.x-4),Math.max(0,p.y-4),Math.min(W-1,p.x+4),Math.min(H-1,p.y+4)]}
function inStorm(x,y){const a=G.storm&&G.storm.area;return a&&x>=a[0]&&y>=a[1]&&x<=a[2]&&y<=a[3]}
function stormStep(){
  const st=G.storm,[x0,y0,x1,y1]=st.area,S=P.seed,T=G.turn;
  st.turns--;
  const cells=[],grates=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=idx(x,y),t=G.tile[i];if(t===T_WALL)continue;cells.push(i);if(t===T_GRATE)grates.push(i);
    G.gas[i]*=0.7;G.pois[i]*=0.85;G.heat[i]+=(0.12-G.heat[i])*0.2;
    const r=h01(S,T,i,40);
    if(t===T_FIRE&&r<0.4){G.tile[i]=T_ASH;G.fuel[i]=0}
    else if(t===T_CAMP&&r<0.08){G.tile[i]=T_PIT;if(G.vis[i])say('The rain hisses out a campfire. It can be relit once it stops.','ice')}
    else if(t===T_ASH&&r<0.05)G.tile[i]=T_MUD;
    else if((t===T_FLOOR||t===T_DIRT)&&r<0.012)G.tile[i]=T_WATER;
    else if(t===T_SNOW&&r<0.05)G.tile[i]=T_WATER;
    else if(t===T_MUD&&r<0.01)G.tile[i]=T_WATER}
  if(!cells.length){G.storm=null;return}
  const strikes=h01(S,T,0,41)<0.15?2:h01(S,T,1,41)<0.5?1:0;
  for(let k=0;k<strikes;k++){const roll=h01(S,T,k,42);let c;
    const ms=G.ents.filter(m=>inStorm(m.x,m.y));
    const tall=grates.concat(cells.filter(j=>G.tile[j]===T_TREE));
    if(roll<0.4&&tall.length)c=tall[hashU(S,T,k,43)%tall.length];
    else if(roll<0.65&&ms.length){const m=ms[hashU(S,T,k,44)%ms.length];c=idx(m.x,m.y)}
    else c=cells[hashU(S,T,k,45)%cells.length];
    strike(c%W,(c/W)|0)}
  if(st.turns<=0){G.storm=null;say('The storm clouds break apart.','dim')}
}
function strike(x,y){
  const i=idx(x,y);G.flashT=performance.now();G.strikeAt={x,y,turn:G.turn};noise(x,y,6);
  for(let k=1;k<=5;k++)if(inb(x,y-k))fxGlyph(x,y-k,k%2?'/':'\\','#f4f8ff',0,160);
  fxGlyph(x,y,'ϟ','#ffffff',0,420);
  G.heat[i]=1;
  for(const [dx,dy] of [[0,0],...DIRS4]){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny),t=G.tile[j];if(t===T_GRASS||t===T_OIL||t===T_VINE)ignite(j)}
  const e=occupant(x,y);
  if(e&&!e.npc){if(e.isPlayer){say('Lightning strikes you!','bad');G.cause='a lightning strike'}else if(G.vis[i])say(`Lightning strikes the ${e.name}!`,'zap');hurt(e,10,'lightning')}
  else if(G.vis[i])say('Lightning strikes nearby!','zap');
  if(G.tile[i]===T_WATER||G.tile[i]===T_GRATE)electrify(x,y,true);
}
function electrify(sx,sy,quiet){
  const seen=new Set([idx(sx,sy)]),q=[[sx,sy]];let n=0;
  while(q.length&&n<P.conduct){const [x,y]=q.shift();const i=idx(x,y);G.elec[i]=2;n++;
    fxGlyph(x,y,'ϟ','#fff27a',n*6,320);
    for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);const tj=G.tile[j];if(seen.has(j)||(tj!==T_WATER&&tj!==T_GRATE))continue;seen.add(j);q.push([nx,ny])}}
  if(!quiet||G.vis[idx(sx,sy)])say(`Lightning races through water and metal (${n} tiles)!`,'zap');
}
function envDamage(){
  for(const e of [G.player,...G.ents]){
    if(e.dead||G.over)continue;const i=idx(e.x,e.y),t=G.tile[i];
    if(t===T_FIRE){if(e.frozen)e.frozen=0;
      if(e.carry){G.floorItems.push({x:e.x,y:e.y,it:e.carry});if(seenBy(e.x,e.y))say(`The thief drops your ${itemName(e.carry)} in the flames!`,'warn');e.carry=null;e.fleeing=false}
      if(!e.fireImmune){if(e.isPlayer)say('You are burning!','bad');hurt(e,3+Math.floor(G.depth/3),'flames')}}
    if(e.dead||G.over)continue;
    if((t===T_WATER||t===T_GRATE)&&G.elec[i]){if(e.isPlayer)say('ZAP! The ground is live!','bad');hurt(e,6,'electrocution')}
    if(e.dead||G.over)continue;
    if(t===T_WATER&&e.trail)hurt(e,4,'water');
    if(e.dead||G.over)continue;
    if(G.pois[i]>0.25&&!e.poisonImmune){if(e.isPlayer)say('You choke on poison gas!','bad');hurt(e,1+Math.floor(G.pois[i]*3),'poison gas')}
    if(e.dead||G.over)continue;
    if(t===T_GRATE&&G.heat[i]>0.6&&!e.fireImmune){if(e.isPlayer)say('The grate sears your feet!','bad');hurt(e,3,'searing grate')}
    else if(t!==T_FIRE&&G.heat[i]>0.85&&!e.fireImmune)hurt(e,1,'heat');
  }
}

// ---------------- movement helpers ----------------
const NOISY={[T_WATER]:'splash',[T_GRATE]:'clang',[T_ICE]:'crack',[T_SNOW]:'crunch',[T_SLICK]:'crack'};
function onEnter(e,dx,dy){
  const i=idx(e.x,e.y),t=G.tile[i];
  if(e.isPlayer&&NOISY[t]){noise(e.x,e.y,3);fxText(e.x,e.y,NOISY[t]+'!','#8a96a8')}
  if(t===T_SNOW)G.prints[i]=60;
  if(t===T_MUD){e.stuck=1;if(e.isPlayer)say('You sink into the mud.','dim')}
  if(e.frost&&t!==T_STAIRS){frostCell(i)}
  if(t===T_SLICK&&(dx||dy))slide(e,dx,dy);
}
function slide(e,dx,dy){
  let moved=0;
  for(let k=0;k<20&&!e.dead;k++){
    if(G.tile[idx(e.x,e.y)]!==T_SLICK)break;
    const nx=e.x+dx,ny=e.y+dy;
    if(!walkable(nx,ny)||!canDiag(e.x,e.y,dx,dy)){if(moved){if(e.isPlayer||seenBy(e.x,e.y))say(`${Name(e)} ${e.isPlayer?'slam':'slams'} into the wall.`,'warn');hurt(e,2,'crushed')}break}
    const o=occupant(nx,ny);
    if(o){if(seenBy(nx,ny))say(`${Name(e)} ${e.isPlayer?'crash':'crashes'} into ${o.isPlayer?'you':'the '+o.name}!`,'warn');hurt(o,3,'crushed');hurt(e,2,'crushed');break}
    fxGlyph(e.x,e.y,'≡','#c9a8ff',k*30,200);
    e.x=nx;e.y=ny;moved++;
    const t=G.tile[idx(nx,ny)];if(t===T_SNOW)G.prints[idx(nx,ny)]=60;if(t===T_MUD){e.stuck=1;break}
  }
  if(moved&&e.isPlayer){say(`You slide ${moved} tiles on the slick ice!`,'ice');pickupAt(e.x,e.y)}
}
function knockback(e,dx,dy,n){
  let moved=0;
  for(let k=0;k<n&&!e.dead;k++){const nx=e.x+dx,ny=e.y+dy;
    if(!walkable(nx,ny)||!canDiag(e.x,e.y,dx,dy)){hurt(e,3,'crushed');break}
    const o=occupant(nx,ny);if(o){hurt(o,2,'crushed');hurt(e,2,'crushed');break}
    e.x=nx;e.y=ny;moved++;onEnter(e,dx,dy)}
  return moved;
}

// ---------------- monsters ----------------
function stepScore(nx,ny,tx,ty){return cheb(nx,ny,tx,ty)+0.1*Math.hypot(nx-tx,ny-ty)}
function safeFor(m,nx,ny,desperate){const i=idx(nx,ny),t=G.tile[i];
  if(t===T_FIRE&&!m.fireImmune&&!desperate)return false;
  if((t===T_WATER||t===T_GRATE)&&G.elec[i])return false;
  if(m.trail&&t===T_WATER)return false;
  if(G.pois[i]>0.3&&!m.poisonImmune&&!desperate)return false;
  if(t===T_GRATE&&G.heat[i]>0.6&&!m.fireImmune)return false;
  return true}
function freeStep(m,ex,ey,desperate){const nx=m.x+ex,ny=m.y+ey;return walkable(nx,ny)&&!occupant(nx,ny)&&canDiag(m.x,m.y,ex,ey)&&safeFor(m,nx,ny,desperate)}
function moveMonster(m,nx,ny){const oi=idx(m.x,m.y),dx=nx-m.x,dy=ny-m.y;m.x=nx;m.y=ny;if(dx||dy)m.face=[sgn(dx),sgn(dy)];
  if(m.trail){const t=G.tile[oi];if(t===T_GRASS||t===T_OIL||t===T_VINE)ignite(oi)}
  onEnter(m,dx,dy)}
// Shortest path to (tx,ty) around walls, trees and hazards, preferring the straightest of the equally short routes.
// Distances are flooded out from the target; if the target is occupied (you) or solid (a tree), the cells next to it are the goal.
function pathStep(m,tx,ty){
  if(cheb(m.x,m.y,tx,ty)>24)return false;
  const N=W*H,dist=new Int16Array(N).fill(-1),s=idx(m.x,m.y),goal=idx(tx,ty),q=[];
  const okCell=(x,y,j)=>j===s||(walkable(x,y)&&!occupant(x,y)&&safeFor(m,x,y));
  if((occupant(tx,ty)&&goal!==s)||!walkable(tx,ty)){for(const [dx,dy] of DIRS8){const nx=tx+dx,ny=ty+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(okCell(nx,ny,j)&&canDiag(nx,ny,-dx,-dy)){dist[j]=0;q.push(j)}}}
  else{dist[goal]=0;q.push(goal)}
  if(dist[s]===0)return false;
  for(let head=0;head<q.length&&dist[s]<0;head++){const i=q[head],x=i%W,y=(i/W)|0;
    for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(dist[j]>=0||!okCell(nx,ny,j)||!canDiag(nx,ny,-dx,-dy))continue;dist[j]=dist[i]+1;q.push(j)}}
  if(dist[s]<0)return false;
  let best=null,bd=1e9;
  for(const [dx,dy] of DIRS8){const nx=m.x+dx,ny=m.y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(dist[j]!==dist[s]-1||!canDiag(m.x,m.y,dx,dy))continue;
    if(!walkable(nx,ny)||occupant(nx,ny))continue;const d=Math.hypot(nx-tx,ny-ty);if(d<bd){bd=d;best=[nx,ny]}}
  if(!best)return false;moveMonster(m,...best);return true}
function stepToward(m,tx,ty){let best=null,bs=stepScore(m.x,m.y,tx,ty);
  for(const [ex,ey] of DIRS8){if(!freeStep(m,ex,ey))continue;const s=stepScore(m.x+ex,m.y+ey,tx,ty);if(s<bs-1e-6){bs=s;best=[m.x+ex,m.y+ey]}}
  if(best)moveMonster(m,...best);return !!best}
function panicMove(m,fire){
  let best=null,bs=-1;
  for(const [ex,ey] of DIRS8){const nx=m.x+ex,ny=m.y+ey;if(!walkable(nx,ny)||!canDiag(m.x,m.y,ex,ey)||G.tile[idx(nx,ny)]===T_FIRE)continue;
    const s=Math.hypot(nx-fire[0],ny-fire[1]);if(s>bs){bs=s;best=[ex,ey]}}
  if(!best)return;const [ex,ey]=best,nx=m.x+ex,ny=m.y+ey,o=occupant(nx,ny);if(o&&o.npc)return;
  if(o){const bx=nx+ex,by=ny+ey;
    if(walkable(bx,by)&&!occupant(bx,by)&&canDiag(nx,ny,ex,ey)){o.x=bx;o.y=by;onEnter(o,ex,ey);
      if(seenBy(nx,ny))say(`The panicked ogre shoves ${o.isPlayer?'you':'the '+o.name} aside!`,'warn');if(o.isPlayer)G.cause='a panicked ogre';hurt(o,2,'crushed');
      if(!m.dead)moveMonster(m,nx,ny)}
    else{hurt(o,3,'crushed');if(seenBy(nx,ny))say(`The panicked ogre tramples ${o.isPlayer?'you':'the '+o.name}!`,'warn')}
  }else moveMonster(m,nx,ny);
}
function monsterAct(m){
  const p=G.player,d=cheb(m.x,m.y,p.x,p.y),i=idx(m.x,m.y);
  if(m.fleeing){let best=null,bs=d;
    for(const [ex,ey] of DIRS8){if(!freeStep(m,ex,ey,true))continue;const s=cheb(m.x+ex,m.y+ey,p.x,p.y);if(s>bs){bs=s;best=[m.x+ex,m.y+ey]}}
    if(best)moveMonster(m,...best);return}
  if(m.panicky){const fire=nearestFire(m.x,m.y,2);if(fire||G.heat[i]>0.5){if(!m.panic&&seenBy(m.x,m.y))say('The ogre panics at the flames!','warn');m.panic=3;m.fireSrc=fire||m.fireSrc||[m.x,m.y]}}
  if(m.panic>0){m.panic--;panicMove(m,m.fireSrc);return}
  const spotted=detects(m);
  if(spotted&&(m.ai==='hunt'||d<=(m.ai==='graze'?2:4))){
    if(!m.alert){if(seenBy(m.x,m.y)){say(`The ${m.name} spots you!`,'warn');fxGlyph(m.x,m.y,'!','#ff5a4a',0,600)}}
    m.alert=8;m.sus=0;m.tx=p.x;m.ty=p.y;faceToward(m,p.x,p.y)}
  if(m.puffer){m.puffCD--;if(m.puffCD<=0&&d<=5&&m.alert>0&&los(m.x,m.y,p.x,p.y)){poisonCloud(m.x,m.y,1,0.9);m.puffCD=5;if(seenBy(m.x,m.y))say('The bog toad belches a cloud of poison.','warn');return}}
  const dx=sgn(p.x-m.x),dy=sgn(p.y-m.y);
  if(d===1&&canDiag(m.x,m.y,dx,dy)&&(m.alert>0||spotted)){faceToward(m,p.x,p.y);attack(m,p);return}
  if(m.ai==='graze'){
    if(G.tile[i]===T_GRASS&&h01(P.seed,G.turn,m.id,20)<0.6){G.tile[i]=T_DIRT;return}
    for(const [ex,ey] of DIRS4){const nx=m.x+ex,ny=m.y+ey;if(inb(nx,ny)&&G.tile[idx(nx,ny)]===T_VINE){G.tile[idx(nx,ny)]=T_DIRT;if(seenBy(nx,ny))say('A moss beetle chews through the vines.','dim');return}}
    let best=null,bd=99;for(let yy=-5;yy<=5;yy++)for(let xx=-5;xx<=5;xx++){const nx=m.x+xx,ny=m.y+yy;if(!inb(nx,ny)||G.tile[idx(nx,ny)]!==T_GRASS||occupant(nx,ny))continue;const dd=Math.abs(xx)+Math.abs(yy)+h01(m.id,nx,ny,2)*0.5;if(dd<bd){bd=dd;best=[nx,ny]}}
    if(best&&stepToward(m,...best))return;
  }
  if(m.tx==null&&m.trail&&G.flies.length){let best=null,bd=9;for(const f of G.flies){const dd=cheb(m.x,m.y,f.x,f.y);if(dd<bd){bd=dd;best=f}}if(best){m.tx=best.x;m.ty=best.y}}
  if(m.tx!=null){const tx=m.tx,ty=m.ty,ok=pathStep(m,tx,ty)||stepToward(m,tx,ty);if(!m.alert&&m.sus)m.sus=Math.max(m.sus,2);
    if(!ok||(m.x===tx&&m.y===ty)){m.tx=null;m.ty=null;if(m.sus&&!m.alert){if(!ok)faceToward(m,tx,ty);else{m.search=4;if(seenBy(m.x,m.y))fxGlyph(m.x,m.y,'?','#ffe24a',0,500)}}}return}
  // arrived at a noise: look around for a few turns
  if(m.search>0){m.search--;const k=DIRS8.findIndex(d=>d[0]===m.face[0]&&d[1]===m.face[1]);m.face=DIRS8[(k+2)%8];return}
  // unaware: sometimes pause and look around (sentries turn 45°) — not while still suspicious of a sound
  if(!m.sus&&h01(P.seed,G.turn,m.id,61)<0.3){const k=DIRS8.findIndex(d=>d[0]===m.face[0]&&d[1]===m.face[1]);m.face=DIRS8[(k+(h01(P.seed,G.turn,m.id,62)<0.5?1:7))%8];return}
  for(let k=0;k<8;k++){
    const [ex,ey]=DIRS8[m.dir];
    if(freeStep(m,ex,ey)&&G.rng()<0.85){moveMonster(m,m.x+ex,m.y+ey);return}
    m.dir=(m.dir+1+Math.floor(G.rng()*7))%8;
  }
}
function monstersAct(){
  for(const m of G.ents.slice()){
    if(m.dead||G.over)continue;
    const i=idx(m.x,m.y);
    if(m.split&&G.tile[i]===T_WATER){m.hp=Math.min(m.maxhp+6,m.hp+2);if(m.hp>=m.maxhp+4){trySplit(m)}}
    if(!m.face)m.face=DIRS8[m.dir];
    if(m.alert>0)m.alert--;if(m.sus>0)m.sus--;
    if(m.para>0){m.para--;continue}
    if(m.frozen>0){m.frozen--;continue}
    if(m.stuck>0){m.stuck--;continue}
    if(m.slow&&!m.panic&&G.turn%2)continue;
    const steps=m.fleeing?2:1;
    for(let s=0;s<steps&&!m.dead&&!G.over;s++)monsterAct(m);
  }
}

// ---------------- player actions ----------------
function endTurn(){
  if(G.over)return;
  if(G.sandbox){G.turn++;if(SB.ai)monstersAct();worldStep();envDamage();finishTurn();return}
  G.turn++;
  monstersAct();if(G.over)return finishTurn();
  worldStep();if(G.over)return finishTurn();
  envDamage();if(G.over)return finishTurn();
  const p=G.player;
  const mine=new Set(),pool=[];
  const add=(it,own)=>{pool.push(it);if(own)mine.add(it)};// bag contents are sealed: they never rot
  p.inv.forEach(it=>add(it,true));G.floorItems.forEach(f=>add(f.it,false));
  for(const it of pool)if(it.kind==='meat'&&!it.frozen){it.age=(it.age||0)+1;if(it.age>=P.meatRot){it.kind='rotten';if(mine.has(it))say('Something in your pack smells rotten.','warn')}}
  if(G.turn%P.hungerRate===0&&p.full>0){p.full--;if(p.full===20)say('You are getting hungry.','warn');if(p.full===0)say('You are starving!','bad')}
  if(p.full<=0)hurt(p,1,'starvation');
  else if((G.turn%3===0||nextToCamp())&&p.hp<p.maxhp)p.hp++;
  if(P.campEvery>0&&G.turn%P.campEvery===0)spawnCamp(false);
  if(G.turn%45===0&&G.ents.length<Math.round(10*P.monsterDensity)+G.depth)spawnMonster(false);
  finishTurn();
}
function finishTurn(){computeView();updateHUD();if(lookMode)updateLook();
  const p=G.player;if(p.para>0&&!G.over&&!G.paraT){G.paraT=setTimeout(()=>{G.paraT=null;if(G.over)return;p.para--;if(!p.para)say('You can move again.','good');endTurn()},170)}}
function paralyzed(){if(G.player.para>0){say("You can't move — you're paralyzed!",'bad');return true}return false}
function playerMove(dx,dy){
  if(G.over)return;const p=G.player;
  if(dx===0&&dy===0){endTurn();return}
  p.face=[dx,dy];
  if(faceMode){setFace(false);updateHUD();return}
  if(p.stuck>0){p.stuck--;say('You struggle free of the mud.','dim');endTurn();return}
  const nx=p.x+dx,ny=p.y+dy;if(!inb(nx,ny))return;
  const m=entAt(nx,ny);
  if(m){if(canDiag(p.x,p.y,dx,dy)){attack(p,m);endTurn()}else say("You can't attack around a corner.",'dim');return}
  // diagonal into a corner or wall: slide along whichever orthogonal is open
  if(dx&&dy&&(!canDiag(p.x,p.y,dx,dy)||!inb(nx,ny)||G.tile[idx(nx,ny)]===T_WALL)&&!(G.npc&&G.npc.x===nx&&G.npc.y===ny)){
    const open=[[dx,0],[0,dy]].filter(([ax,ay])=>{const tx=p.x+ax,ty=p.y+ay;return inb(tx,ty)&&G.tile[idx(tx,ty)]!==T_WALL&&!occupant(tx,ty)});
    if(!open.length){fxGlyph(nx,ny,'×','#6b7787',0,180);return}
    const cont=([ax,ay])=>{const sx=p.x+ax,sy=p.y+ay;return walkable(sx+dx,sy+dy)&&canDiag(sx,sy,dx,dy)?1:0};
    const pick=open.length===2&&cont(open[1])>cont(open[0])?open[1]:open[0];
    playerMove(pick[0],pick[1]);return}
  if(G.npc&&G.npc.x===nx&&G.npc.y===ny){openSmith();return}
  const t=G.tile[idx(nx,ny)];
  if(t===T_TREE){const ti=idx(nx,ny);G.fuel[ti]--;noise(nx,ny,4);fxGlyph(nx,ny,'/','#c08a50',0,200);
    if(G.fuel[ti]<=0){G.tile[ti]=T_DIRT;G.fuel[ti]=0;const L=mkItem('lumber');L.n=2+Math.floor(G.rng()*3);placeFloor(nx,ny,L);if(G.rng()<0.5)placeFloor(nx,ny,mkItem('dryGrass'));say(`Timber! The tree falls. (${L.n} lumber)`,'good')}
    else say(`You chop at the tree. (${G.fuel[ti]} more)`,'dim');endTurn();return}
  if(t===T_WALL&&G.ore[idx(nx,ny)]&&!(p.weapon&&WEAPONS[p.weapon.w].dig)){say(`A vein of ${G.ore[idx(nx,ny)]===2?'mithril':'iron'} ore. You need a pickaxe to mine it.`,'dim');return}
  if(t===T_WALL&&p.weapon&&WEAPONS[p.weapon.w].dig&&!dx!==!dy&&nx>0&&ny>0&&nx<W-1&&ny<H-1){
    const oi=idx(nx,ny);if(G.ore[oi]){const o=mkItem(G.ore[oi]===2?'mithrilOre':'ironOre');o.n=G.ore[oi]===2?1:1+Math.floor(G.rng()*2);G.ore[oi]=0;G.tile[oi]=T_FLOOR;G.heat[oi]=G.heat[idx(p.x,p.y)];
      placeFloor(nx,ny,o);noise(nx,ny,5);fxGlyph(nx,ny,'*',ITEMS[o.kind].color,0,300);say(`You break open the vein: ${itemName(o)}!`,'good');endTurn();return}
    G.tile[idx(nx,ny)]=T_FLOOR;G.heat[idx(nx,ny)]=G.heat[idx(p.x,p.y)];noise(nx,ny,4);say('You dig through the wall.','dim');fxGlyph(nx,ny,'#','#9aa6b6');endTurn();return}
  if(!canDiag(p.x,p.y,dx,dy))return;
  if(t===T_CAMP||t===T_PIT){campMenu(idx(nx,ny));return}
  if(t===T_VINE){G.tile[idx(nx,ny)]=T_GRASS;say('You hack through the vines.','dim');
    if(h01(P.seed,G.turn,idx(nx,ny),50)<0.5){placeFloor(nx,ny,mkItem('dryGrass'));say('Some dry grass falls loose.','dim')}endTurn();return}
  if(t===T_VINE_ICE){G.tile[idx(nx,ny)]=T_FLOOR;say('The frozen vines shatter!','ice');fxGlyph(nx,ny,'*','#bff6ff')}
  else if(t===T_WALL)return;
  p.x=nx;p.y=ny;
  if(t===T_FIRE)say('You step into the flames!','bad');
  onEnter(p,dx,dy);
  pickupAt(p.x,p.y);
  if(G.tile[idx(p.x,p.y)]===T_STAIRS)say('Stairs down. Press STAIRS (>) to descend.','warn');
  endTurn();
}
function pickupAt(x,y){
  for(let k=G.floorItems.length-1;k>=0;k--){const f=G.floorItems[k];if(f.x!==x||f.y!==y)continue;
    if(f.it.kind==='gold'){G.player.gold+=f.it.amt;G.floorItems.splice(k,1);say(`Picked up ${f.it.amt} gold.`,'good');continue}
    const name=itemName(f.it),before=qty(f.it);
    if(addToPack(f.it)){G.floorItems.splice(k,1);say(`Picked up ${name}.`,'good')}
    else if(qty(f.it)<before)say(`Picked up ${before-qty(f.it)} — your pack is full, ${itemName(f.it)} stays here.`,'warn');
    else say(`Your pack is full. ${name} stays here.`,'warn')}
}
function descend(){
  const p=G.player;if(G.over)return;
  if(G.tile[idx(p.x,p.y)]!==T_STAIRS){say('There are no stairs here.','dim');return}
  nextFloor();updateHUD();
}
function rayPath(range,stopAtEnt){
  const p=G.player,[dx,dy]=p.face,path=[];let x=p.x,y=p.y,hit=null;
  for(let k=0;k<range;k++){
    if(dx&&dy&&!canDiag(x,y,dx,dy))break;
    x+=dx;y+=dy;if(!inb(x,y)||G.tile[idx(x,y)]===T_WALL)break;
    path.push([x,y]);const e=entAt(x,y);if(e&&stopAtEnt){hit=e;break}
    if(G.tile[idx(x,y)]===T_VINE||G.tile[idx(x,y)]===T_CAMP)break;
  }
  return {path,hit};
}
const STAFF_KIND={fireStaff:'fire',iceStaff:'ice',boltStaff:'bolt',galeStaff:'gale'};
function zapStaff(it){if(it.charges<=0){say('Nothing happens. The staff is spent.','dim');return}it.charges--;zap(STAFF_KIND[it.kind])}
function zap(kind){
  const {path,hit}=rayPath(12,kind!=='gale');
  const col={fire:'#ff8a3d',ice:'#9fe8ff',bolt:'#fff27a',gale:'#e8eef5'}[kind],ch={fire:'*',ice:'+',bolt:'ϟ',gale:'≋'}[kind];
  path.forEach(([x,y],n)=>fxGlyph(x,y,ch,col,n*28,240));
  if(kind==='gale')return gale(path);
  let touched=null;
  for(const [x,y] of path){const i=idx(x,y),t=G.tile[i];
    if(kind==='fire')ignite(i);
    if(kind==='ice')frostCell(i);
    if(kind==='bolt'&&(t===T_WATER||t===T_GRATE)&&!touched)touched=[x,y];
  }
  if(kind==='fire'){say('A gout of flame roars forward!','fire');
    if(hit){if(hit.frozen)hit.frozen=0;if(!hit.fireImmune)hurt(hit,(7+Math.floor(G.rng()*4))*(hit.coldImmune?2:1),'zap');else say(`The ${hit.name} drinks the fire.`,'warn');ignite(idx(hit.x,hit.y))}}
  if(kind==='ice'){say('A blast of frost!','ice');
    if(hit){if(hit.coldImmune)say(`The ${hit.name} is unbothered by the cold.`,'warn');else{hit.frozen=5;say(`The ${hit.name} is frozen solid.`,'ice');hurt(hit,hit.trail?8:3,'zap')}}}
  if(kind==='bolt'){say('Thunder cracks!','zap');
    if(hit)hurt(hit,9+Math.floor(G.rng()*5),'zap');
    if(!touched&&hit&&[T_WATER,T_GRATE].includes(G.tile[idx(hit.x,hit.y)]))touched=[hit.x,hit.y];
    if(touched)electrify(...touched)}
}
function gale(path){
  const [dx,dy]=G.player.face;say('A howling gale tears forward!','dim');
  // push air along a 3-wide band
  const band=[];for(const [x,y] of path)for(const o of [-1,0,1]){const bx=x+(dy?o:0)*(dx&&dy?0:1),by=y+(dx?o:0)*(dx&&dy?0:1);if(inb(bx,by))band.push([bx,by])}
  for(let k=band.length-1;k>=0;k--){const [x,y]=band[k],i=idx(x,y),nx=x+dx*2,ny=y+dy*2;
    if(!inb(nx,ny)||G.tile[idx(nx,ny)]===T_WALL)continue;const j=idx(nx,ny);
    G.gas[j]=Math.min(1,G.gas[j]+G.gas[i]*0.85);G.pois[j]=Math.min(1,G.pois[j]+G.pois[i]*0.85);G.gas[i]*=0.15;G.pois[i]*=0.15}
  // fire is blown one tile downwind
  const fires=path.filter(([x,y])=>G.tile[idx(x,y)]===T_FIRE).reverse();
  for(const [x,y] of fires){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny),t=G.tile[j];
    if(t===T_GRASS||t===T_OIL||t===T_VINE||t===T_SLICK)ignite(j);
    else if(t===T_FLOOR||t===T_DIRT||t===T_ASH){G.tile[j]=T_FIRE;G.fuel[j]=1;G.src[j]=0;G.heat[j]=1}
    fxGlyph(nx,ny,'^','#ff8a3d',60,260)}
  for(const [x,y] of path){const e=entAt(x,y);if(e){const n=knockback(e,dx,dy,3);if(seenBy(e.x,e.y))say(`The ${e.name} is hurled ${n} tiles!`,'warn');break}}
}
function throwItem(k){return throwIt(takeOne(G.player.inv,k))}
function throwIt(it){
  const p=G.player,d=ITEMS[it.kind];
  if(it===p.weapon)p.weapon=null;
  const {path,hit}=rayPath(throwDist(),true);
  path.forEach(([x,y],n)=>fxGlyph(x,y,d.ch,d.color,n*30,90));
  const [lx,ly]=path.length?path[path.length-1]:[p.x,p.y];
  say(`You throw the ${d.name}.`);
  if(hit&&!hit.dead){faceToward(hit,p.x,p.y);if(!hit.alert){hit.sus=4;hit.tx=p.x;hit.ty=p.y}}
  const heard=noise(lx,ly,throwNoise(it));
  if(heard&&!hit)say(`It clatters on the ground. ${heard===1?'Something':heard+' things'} turn${heard===1?'s':''} toward the sound.`,'dim');
  if(it.kind==='oilJar'){
    if(G.tile[idx(lx,ly)]===T_FIRE){explode(lx,ly,'The jar bursts into a fireball!');return}
    say('Oil splashes everywhere.','dim');
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=lx+dx,y=ly+dy;if(!inb(x,y))continue;const i=idx(x,y),t=G.tile[i];
      if(t===T_FIRE){explode(x,y,'The oil catches!');continue}
      if([T_FLOOR,T_GRASS,T_ASH,T_DIRT,T_MUD,T_SNOW].includes(t))G.tile[i]=T_OIL;if(t===T_ICE)G.tile[i]=T_SLICK}
    if(hit)hurt(hit,2,'you');return}
  if(it.kind==='miasma'){say('The jar shatters — a sickly cloud billows out.','warn');poisonCloud(lx,ly,2,1);if(hit)hurt(hit,2,'you');return}
  if(isBag(it)){say(`The ${d.name} bursts open!`,'warn');if(hit)hurt(hit,2,'you');scatter(lx,ly,it.items);return}
  if(it.kind==='seeds'){say('Grass sprouts instantly.','good');
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=lx+dx,y=ly+dy;if(!inb(x,y)||Math.hypot(dx,dy)>2.3)continue;const i=idx(x,y);if([T_FLOOR,T_ASH,T_DIRT,T_MUD].includes(G.tile[i]))G.tile[i]=T_GRASS}
    return}
  if(hit){
    if(it.kind==='herb'){hit.hp=Math.min(hit.maxhp,hit.hp+25);say(`The ${hit.name} looks healthier. Oops.`,'warn');return}
    if(it.kind==='tainted'){hit.para=6;hit.tx=null;hit.ty=null;say(`The ${hit.name} gulps down the jerky… and goes rigid! (paralyzed 6 turns)`,'good');fxGlyph(hit.x,hit.y,'≈','#c9a0ff',0,600);return}
    hurt(hit,it.kind==='weapon'?WEAPONS[it.w].atk+it.plus+2:2,'you');
  }
  if(G.tile[idx(lx,ly)]===T_WATER&&!hit){say(`The ${d.name} sinks.`,'dim');return}
  placeFloor(hit&&!hit.dead?hit.x:lx,hit&&!hit.dead?hit.y:ly,it);
}
function useItem(k,bag){
  const p=G.player,it=p.inv[k],d=ITEMS[it.kind];
  if(d.bagOnly&&!bag){say(`The ${d.name} must be read onto a bag.`,'dim');return false}
  if(bag&&d.bagT){p.inv.splice(k,1);bagScroll(it.kind,bag);return true}
  if(d.seal){p.inv.splice(k,1);const w=p.weapon,sn=SEALS[d.seal].name;
    if(!w)say('Your bare hands glow briefly. The seal is wasted.','dim');
    else if(w.seals.includes(d.seal))say(`Your ${WEAPONS[w.w].name} already bears a ${sn} seal.`,'dim');
    else{w.seals.push(d.seal);say(`A ${sn} seal burns into your ${itemName(w)}!`,'good')}
    return true}
  if(d.staff){zapStaff(it);return true}
  takeOne(p.inv,k);
  const area=(r,fn)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=p.x+dx,y=p.y+dy;if(!inb(x,y)||Math.hypot(dx,dy)>r+0.3||!los(p.x,p.y,x,y))continue;fn(x,y,idx(x,y),Math.hypot(dx,dy))}};
  switch(it.kind){
    case 'honing':if(p.weapon){p.weapon.plus++;say(`Your weapon gleams: ${itemName(p.weapon)}.`,'good')}else say('Your empty hands tingle. Nothing happens.','dim');break;
    case 'recharge':{let n=0;for(const x of p.inv)if(ITEMS[x.kind].staff){x.charges++;n++}say(n?`${n} staff${n>1?'s hum':' hums'} with fresh power. (+1)`:'Nothing to recharge.',n?'good':'dim');break}
    case 'onigiri':p.full=Math.min(100,p.full+50);say('Delicious. (+50 fullness)','good');break;
    case 'grilled':p.full=Math.min(100,p.full+65);p.hp=Math.min(p.maxhp,p.hp+5);say('Smoky and perfect. (+65 fullness)','good');break;
    case 'meat':p.full=Math.min(100,p.full+25);if(G.rng()<0.5){say('Raw meat… your stomach lurches.','bad');G.cause='raw meat';hurt(p,4,'raw meat')}else say('Chewy, but filling. (+25 fullness)','good');break;
    case 'tainted':p.full=Math.min(100,p.full+30);p.para=5;say('Chewy… then your limbs lock up. You are paralyzed! (5 turns)','bad');fxGlyph(p.x,p.y,'≈','#c9a0ff',0,600);break;
    case 'cooked':p.full=Math.min(100,p.full+40);p.hp=Math.min(p.maxhp,p.hp+10);say('A hearty meal. (+40 fullness, +10 HP)','good');break;
    case 'rotten':say('You retch violently, releasing a foul cloud!','bad');p.full=Math.min(100,p.full+5);poisonCloud(p.x,p.y,1,0.7);hurt(p,5,'rotten meat');break;
    case 'herb':if(p.hp>=p.maxhp){p.maxhp+=2;p.hp+=2;say('You feel sturdier. (+2 max HP)','good')}else{p.hp=Math.min(p.maxhp,p.hp+25);say('You feel better.','good')}break;
    case 'inferno':say('The scroll erupts in a ring of fire!','fire');
      area(3,(x,y,i,d)=>{const t=G.tile[i];if([T_GRASS,T_OIL,T_VINE,T_SLICK,T_ICE,T_SNOW,T_VINE_ICE,T_MUD].includes(t))ignite(i);G.heat[i]=Math.max(G.heat[i],0.75);fxGlyph(x,y,'^','#ff6a3a',d*40,300);
        const e=entAt(x,y);if(e&&!e.fireImmune)hurt(e,10*(e.coldImmune?2:1),'flames')});break;
    case 'rain':say('Rain pours down around you.','ice');
      area(3,(x,y,i)=>{const t=G.tile[i];
        if(t===T_FIRE){G.tile[i]=T_MUD;G.fuel[i]=0}
        else if(t===T_CAMP)G.tile[i]=T_PIT;
        else if(t===T_ASH)G.tile[i]=T_MUD;
        else if((t===T_FLOOR||t===T_DIRT)&&h01(P.seed,G.turn,i,9)<0.5)G.tile[i]=T_WATER;
        G.gas[i]=0;G.pois[i]*=0.3;G.heat[i]=Math.min(G.heat[i],0.15);fxGlyph(x,y,'\'','#7fb8ff',h01(i,1,2,3)*300,250)});break;
    case 'reveal':G.lit=true;say('Golden light floods every corner of the floor. Nothing can hide from you here.','good');break;
    case 'storm':{G.storm={turns:40,area:stormArea()};G.flashT=performance.now();say(G.roomIdx[idx(p.x,p.y)]>=0?'Thunder rolls — a storm breaks over this room!':'Thunder rolls — a storm gathers overhead!','zap');break}
    case 'blizzard':say('A blizzard howls around you!','ice');
      area(3,(x,y,i,d)=>{if(i!==idx(p.x,p.y)||G.tile[i]!==T_WATER)frostCell(i);fxGlyph(x,y,'*','#e8f8ff',d*40,300);
        const e=entAt(x,y);if(e&&!e.coldImmune){e.frozen=Math.max(e.frozen,3)}});break;
  }
  return true;
}
function scatter(x,y,items){
  const spots=[[0,0],...DIRS8];let k=0;
  for(const ci of items){let placed=false;
    for(let tries=0;tries<9&&!placed;tries++,k++){const s=spots[k%9],nx=x+s[0],ny=y+s[1];if(walkable(nx,ny)){placeFloor(nx,ny,ci);placed=true}}
    if(!placed)placeFloor(x,y,ci)}
}
function bagScroll(kind,bag){
  const p=G.player,bn=ITEMS[bag.kind].name,ws=bag.items.filter(x=>x.kind==='weapon'),d=ITEMS[kind];
  fxGlyph(p.x,p.y,'(',d.color,0,400);
  if(d.seal){let n=0;for(const w of ws)if(!w.seals.includes(d.seal)){w.seals.push(d.seal);n++}
    say(n?`${n} weapon${n>1?'s':''} in the ${bn} ${n>1?'take':'takes'} a ${SEALS[d.seal].name} seal.`:`Nothing in the ${bn} takes the seal.`,n?'good':'dim');return}
  switch(kind){
    case 'honing':ws.forEach(w=>w.plus++);say(ws.length?`${ws.length} weapon${ws.length>1?'s':''} in the ${bn} ${ws.length>1?'gleam':'gleams'}. (+1 each)`:`Nothing in the ${bn} reacts.`,ws.length?'good':'dim');break;
    case 'smelting':{if(ws.length<2){say(`The scroll fizzles. The ${bn} needs two or more weapons.`,'dim');break}
      const best=ws.reduce((a,b)=>WEAPONS[b.w].atk>WEAPONS[a.w].atk?b:a);
      const fused=mkWeapon(best.w,ws.reduce((s,w)=>s+w.plus,0),[...new Set(ws.flatMap(w=>w.seals))]);
      bag.items=bag.items.filter(x=>x.kind!=='weapon');bag.items.push(fused);
      say(`${ws.length} weapons melt together into a ${itemName(fused)}!`,'good');break}
    case 'recharge':{const st=bag.items.filter(x=>ITEMS[x.kind].staff);st.forEach(x=>x.charges+=2);say(st.length?`${st.length} staff${st.length>1?'s':''} in the ${bn} crackle. (+2 each)`:`Nothing in the ${bn} reacts.`,st.length?'good':'dim');break}
    case 'rain':{let n=0;bag.items.forEach(x=>{if(x.kind==='seeds'){x.kind='herb';n++}});say(n?`Water seeps into the ${bn}. ${n} seed pouch${n>1?'es sprout':' sprouts'} into herbs!`:`The ${bn} gets soggy. Nothing else happens.`,n?'good':'dim');break}
    case 'blizzard':{let n=0;bag.items.forEach(x=>{if(['meat','cooked','grilled','onigiri'].includes(x.kind)){x.frozen=true;x.age=0;n++}});say(n?`Frost fills the ${bn}. ${n} food item${n>1?'s are':' is'} frozen and will never rot.`:`Frost fills the ${bn}. Nothing to preserve.`,n?'ice':'dim');break}
    case 'inferno':{let cooked=0,burnt=0;const jars=[];
      bag.items=bag.items.filter(x=>{const k=x.kind;
        if(k==='onigiri'){x.kind='grilled';cooked++;return true}
        if(k==='meat'||k==='rotten'){x.kind=k==='meat'?'cooked':'tainted';cooked++;return true}
        if(k==='herb'||k==='seeds'||ITEMS[k].ch==='?'){burnt++;return false}
        if(k==='oilJar'||k==='miasma'){jars.push(k);return false}
        return true});
      say(`Flames roar inside the ${bn}! ${cooked} cooked, ${burnt} burnt.`,'fire');
      for(const j of jars){if(j==='oilJar')explode(p.x,p.y,'An oil jar inside the bag explodes!');else{poisonCloud(p.x,p.y,2,1);say('A miasma jar bursts in the flames!','bad');flash([idx(p.x,p.y)])}}
      break}
  }
}
function dropItem(k){const p=G.player,it=p.inv.splice(k,1)[0];if(it===p.weapon)p.weapon=null;placeFloor(p.x,p.y,it);say(`Dropped ${itemName(it)}.`)}

function gameOver(){G.over=true;say(`You were felled by ${G.cause||'something'} on B${G.depth}F.`,'bad');
  const g0=G;setTimeout(()=>G===g0&&showEnd(`FELLED ON B${G.depth}F`,`Killed by ${G.cause||'something'} on turn ${G.turn}, at Lv${G.player.lv}.`),500)}
function victory(){G.over=true;G.depth=FINAL_FLOOR;showEnd('YOU REACHED THE BOTTOM',`Cleared B${FINAL_FLOOR}F in ${G.turn} turns at Lv${G.player.lv}.`)}

// ============================================================
//  RENDERING
// ============================================================
const cv=document.getElementById('c'),cx=cv.getContext('2d');
let DPR=1,CW=0,CH=0,TS=24,camX=0,camY=0,bgCanvas=null,bgStep=10,vign=null,lastOx=0,lastOy=0;
function hslPal(h,s,l0,l1){const a=[];for(let k=0;k<10;k++)a.push(`hsl(${h},${s}%,${(l0+(l1-l0)*k/9).toFixed(1)}%)`);return a}
const PAL={
  face:hslPal(215,16,10,78),top:hslPal(218,14,7,42),floor:hslPal(220,12,8,34),grass:hslPal(105,48,9,58),
  water:hslPal(205,72,12,62),ash:hslPal(30,6,8,36),oil:hslPal(278,45,10,58),ice:hslPal(188,80,22,86),
  mem:hslPal(225,22,6,26),leaf:hslPal(120,50,12,52),ironOre:hslPal(22,62,22,64),mithOre:hslPal(188,85,30,82),logs:hslPal(28,55,14,55),rim:hslPal(205,30,20,86),rimMem:hslPal(215,22,10,40),smoke:hslPal(220,8,14,52),smokeLit:hslPal(28,32,20,66),pois:hslPal(72,95,18,68),
  mud:hslPal(28,42,8,42),dirt:hslPal(35,25,8,40),vine:hslPal(128,55,10,55),vineIce:hslPal(185,55,22,82),
  grate:hslPal(205,12,12,62),hot:hslPal(12,95,18,62),snow:hslPal(210,25,35,96),slick:hslPal(262,60,25,82),
  fire:Array.from({length:10},(_,k)=>`hsl(${(k*6).toFixed(0)},100%,${(32+k*5).toFixed(0)}%)`),
  elec:hslPal(55,100,40,88),
};
const RAMP={face:' .:-=+*#%@',top:' .-:=+',floor:' ..·:',grass:' .,\'";',ash:' .,:',oil:' .°oO',ice:' .:+#',fire:' .\'^*%#@',
  smoke:' .:;%',pois:' °*%&',mud:' .,~o',dirt:' .,:',vine:' ;&%#@',vineIce:' ;&%#',grate:' .+#',snow:' .·*',slick:' -=≡'};
function resize(){
  const r=cv.parentElement.getBoundingClientRect();DPR=Math.min(2,window.devicePixelRatio||1);CW=r.width;CH=r.height;
  cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);
  TS=Math.max(12,Math.floor(Math.min(CW/P.zoom,CH/(P.zoom*0.75))));
  bgStep=Math.max(8,Math.round(TS/2.4));
  bgCanvas=document.createElement('canvas');bgCanvas.width=Math.round((CW+bgStep*4)*DPR);bgCanvas.height=Math.round((CH+bgStep*4)*DPR);
  const b=bgCanvas.getContext('2d');b.scale(DPR,DPR);b.font=`${bgStep}px ${FONT}`;b.textAlign='center';b.textBaseline='middle';
  for(let y=0;y*bgStep<CH+bgStep*4;y++)for(let x=0;x*bgStep<CW+bgStep*4;x++){const r=h01(x,y,5,5);
    if(r<0.45)continue;b.fillStyle=r>0.93?'#2a3442':'#151c26';b.fillText(r>0.97?'=':r>0.6?'~':'-',(x+.5)*bgStep,(y+.5)*bgStep)}
  vign=cx.createRadialGradient(CW/2,CH/2,Math.min(CW,CH)*0.25,CW/2,CH/2,Math.max(CW,CH)*0.75);
  vign.addColorStop(0,'rgba(0,0,0,0)');vign.addColorStop(1,'rgba(0,0,0,0.7)');
}
function isFace(x,y){return y+1<H&&G.tile[idx(x,y+1)]!==T_WALL}
function render(now){
  if(!G||!G.tile)return;
  const p=G.player;
  camX+=(p.x-camX)*0.28;camY+=(p.y-camY)*0.28;if(Math.abs(p.x-camX)<0.01)camX=p.x;if(Math.abs(p.y-camY)<0.01)camY=p.y;
  cx.setTransform(DPR,0,0,DPR,0,0);
  cx.fillStyle='#06080b';cx.fillRect(0,0,CW,CH);
  const off=(now*0.004)%(bgStep*2);
  cx.globalAlpha=G.night?0.35:1;cx.drawImage(bgCanvas,-bgStep*2+off,-bgStep*2+off*0.5,CW+bgStep*4,CH+bgStep*4);cx.globalAlpha=1;
  const ox=CW/2-(camX+0.5)*TS,oy=CH/2-(camY+0.5)*TS;lastOx=ox;lastOy=oy;
  const x0=Math.max(0,Math.floor(-ox/TS)),x1=Math.min(W-1,Math.ceil((CW-ox)/TS)),y0=Math.max(0,Math.floor(-oy/TS)),y1=Math.min(H-1,Math.ceil((CH-oy)/TS));
  const SX=3,SY=3,sw=TS/SX,sh=TS/SY,fr=Math.floor(now/110),fr2=Math.floor(now/260);
  cx.font=`${Math.max(6,sh*1.18).toFixed(1)}px ${FONT}`;cx.textAlign='center';cx.textBaseline='middle';
  const tile=G.tile,heatOn=P.showHeat==='On';
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=y*W+x;if(!G.seen[i])continue;
    const v=G.vis[i],L=v?Math.min(1,G.light[i]*1.25):0,t=tile[i],px=ox+x*TS,py=oy+y*TS;
    cx.fillStyle=v?(t===T_FIRE?'#140804':'#090c11'):'#07090d';cx.fillRect(px,py,TS+0.6,TS+0.6);
    let oT=0,oB=0,oL=0,oR=0,oTL=0,oTR=0,oBL=0,oBR=0;
    if(t===T_WALL){const op=(ax,ay)=>inb(x+ax,y+ay)&&tile[idx(x+ax,y+ay)]!==T_WALL&&G.seen[idx(x+ax,y+ay)]?1:0;
      oT=op(0,-1);oB=op(0,1);oL=op(-1,0);oR=op(1,0);oTL=op(-1,-1);oTR=op(1,-1);oBL=op(-1,1);oBR=op(1,1)}
    const lum=v?0.18+0.82*L:0.3,face=t===T_WALL&&isFace(x,y),gas=v?G.gas[i]:0,poi=v?G.pois[i]:0,el=G.elec[i]&&(t===T_WATER||t===T_GRATE),hv=G.heat[i];
    for(let sy=0;sy<SY;sy++)for(let sx=0;sx<SX;sx++){
      const n=h01(i,sx,sy,7);let b,ramp,pal,ch=null,lit=false;
      if(poi>0.06&&h01(i,sx*3+sy,fr2,17)<poi*0.9+0.1){b=0.5+poi*0.5;ramp=RAMP.pois;pal=PAL.pois;lit=true}
      else if(gas>0.06&&h01(i,sx*3+sy,fr2,11)<(t===T_FIRE||t===T_CAMP?Math.max(0,gas-0.35)*0.6:gas*0.85)){const glow=G.env?G.env[i]:0;b=Math.max(0.35+gas*0.6,glow*0.9);ramp=RAMP.smoke;pal=glow>0.45?PAL.smokeLit:PAL.smoke;lit=glow>0.45}
      else if(el){b=0.6+0.4*h01(i,sx,sy,fr);ch=b>0.85?'ϟ':t===T_GRATE?'#':'≈';pal=PAL.elec;lit=true}
      else switch(t){
        case T_WALL:
          if((sy===0&&oT)||(sy===2&&oB)||(sx===0&&oL)||(sx===2&&oR)||(sx===0&&sy===0&&oTL)||(sx===2&&sy===0&&oTR)||(sx===0&&sy===2&&oBL)||(sx===2&&sy===2&&oBR)){
            ch=((sy===0&&oT)||(sy===2&&oB))&&!((sx===0&&oL)||(sx===2&&oR))?'=':((sx===0&&oL)||(sx===2&&oR))&&!((sy===0&&oT)||(sy===2&&oB))?'|':'#';
            b=v?Math.max(0.62,(0.8+0.2*n)*lum):0.75;pal=v?PAL.rim:PAL.rimMem;lit=true;break}
          if(face){b=(0.95-sy*0.13)*(0.75+0.25*n);ramp=RAMP.face;pal=PAL.face}else{b=0.55*(0.6+0.4*n);ramp=RAMP.top;pal=PAL.top}break;
        case T_FLOOR:case T_STAIRS: b=0.3*n+0.1;ramp=RAMP.floor;pal=PAL.floor;break;
        case T_GRASS: b=0.45+0.5*n;ramp=RAMP.grass;pal=PAL.grass;break;
        case T_ASH: b=0.15+0.45*n;ramp=RAMP.ash;pal=PAL.ash;break;
        case T_OIL: b=0.4+0.5*h01(i,sx,sy,fr2);ramp=RAMP.oil;pal=PAL.oil;break;
        case T_ICE: b=0.55+0.45*n;ramp=RAMP.ice;pal=PAL.ice;break;
        case T_MUD: b=0.35+0.45*n;ramp=RAMP.mud;pal=PAL.mud;break;
        case T_DIRT: b=0.2+0.4*n;ramp=RAMP.dirt;pal=PAL.dirt;break;
        case T_VINE: b=0.6+0.4*n;ramp=RAMP.vine;pal=PAL.vine;break;
        case T_VINE_ICE: b=0.6+0.4*n;ramp=RAMP.vineIce;pal=PAL.vineIce;break;
        case T_GRATE: b=0.55+0.4*((sx+sy)%2);ch=(sx+sy)%2?'#':'+';pal=hv>0.45?PAL.hot:PAL.grate;if(hv>0.45){b=0.4+hv*0.6;lit=true}break;
        case T_SNOW: if(G.prints[i]&&sx===1&&sy!==1){ch=':';b=0.3;pal=PAL.floor}else{b=0.35+0.55*n;ramp=RAMP.snow;pal=PAL.snow}break;
        case T_SLICK:{b=0.55+0.4*h01(i,sx,sy,fr2);ramp=RAMP.slick;pal=G.stored[i]&&h01(i,sx,sy,fr)<0.3?PAL.fire:PAL.slick;if(G.stored[i])lit=true;break}
        case T_WATER:{const w=Math.sin(now*0.0025+x*0.9+y*0.45+sx*0.8-sy*0.3);b=0.45+0.3*w;ch=w>0.3?'~':w>-0.4?'-':'.';pal=PAL.water;break}
        case T_PIT:{if(sy===2){ch=sx===1?'#':'=';b=0.45+0.2*n;pal=PAL.logs}else if(sy===1&&G.heat[i]>0.4&&h01(i,sx,sy,fr2)<0.35){ch=sx===1?'.':',';b=0.5+0.3*h01(i,sx,sy,fr);pal=PAL.fire;lit=true}else{ch=sy===1?(sx===1?'o':' '):' ';b=0.3;pal=PAL.ash}break}
        case T_TREE:{if(sy===2){ch=sx===1?'|':(n<0.5?',':' ');b=0.5+0.3*n;pal=sx===1?PAL.logs:PAL.grass}else{const sway=h01(i,sx,sy,fr2)<0.15;ch=sy===0?(sx===1?'^':'%'):(sx===1?'&':'%');if(sway)ch='*';b=0.55+0.4*n;pal=PAL.leaf}break}
        case T_CAMP:{const f=h01(i,sx,sy,fr);if(sy===2){ch=sx===1?'#':'=';b=0.55+0.2*n;pal=PAL.logs}else{b=sy===1?0.65+0.35*f:0.35+0.5*f*(sx===1?1:0.5);ramp=RAMP.fire;pal=PAL.fire}lit=true;break}
        case T_FIRE:{const f=h01(i,sx,sy,fr);b=0.45+0.55*f-sy*0.08+(G.fuel[i]>1?0.1:0);ramp=RAMP.fire;pal=PAL.fire;lit=true;break}
      }
      if(t===T_WALL&&G.ore[i]&&!((sy===0&&oT)||(sy===2&&oB)||(sx===0&&oL)||(sx===2&&oR))&&h01(i,sx,sy,9)<0.6){ch=h01(i,sx,sy,fr2)<0.12?'✦':'*';pal=G.ore[i]===2?PAL.mithOre:PAL.ironOre;b=v?0.55+0.45*n:0.5;lit=v&&G.ore[i]===2}
      if(!lit)b*=lum;
      if(!v)pal=PAL.mem;
      // heat shimmer on hot ground
      if(v&&t!==T_FIRE&&t!==T_WALL&&hv>0.6&&h01(i,sx,sy,fr)<(hv-0.6)*1.6){ch='~';pal=PAL.hot;b=0.3+hv*0.5}
      b=clamp(b,0,1);
      if(ch===null)ch=ramp[Math.min(ramp.length-1,Math.floor(b*ramp.length))];
      if(ch===' ')continue;
      cx.fillStyle=pal[Math.round(b*9)];cx.fillText(ch,px+(sx+0.5)*sw,py+(sy+0.5)*sh);
    }
    if(t===T_WALL&&(oT||oB||oL||oR)){cx.strokeStyle=v?`rgba(150,190,230,${(0.35+0.45*L).toFixed(2)})`:'rgba(110,130,160,0.32)';cx.lineWidth=Math.max(1,TS/18);cx.beginPath();
      if(oT){cx.moveTo(px,py+0.5);cx.lineTo(px+TS,py+0.5)}if(oB){cx.moveTo(px,py+TS-0.5);cx.lineTo(px+TS,py+TS-0.5)}
      if(oL){cx.moveTo(px+0.5,py);cx.lineTo(px+0.5,py+TS)}if(oR){cx.moveTo(px+TS-0.5,py);cx.lineTo(px+TS-0.5,py+TS)}cx.stroke()}
    if(G.cone&&G.cone[i]&&t!==T_WALL){cx.fillStyle=G.cone[i]===2?'rgba(255,80,60,0.10)':'rgba(255,214,120,0.08)';cx.fillRect(px,py,TS,TS)}
    if(heatOn&&v&&t!==T_WALL){const h=G.heat[i];cx.fillStyle=h>0.3?`rgba(255,${Math.round(200-h*180)},40,${((h-0.3)*0.7).toFixed(2)})`:`rgba(80,160,255,${((0.3-h)*0.9).toFixed(2)})`;cx.fillRect(px,py,TS,TS)}
  }
  const big=(ch,x,y,color,scale,glow)=>{const px=ox+x*TS,py=oy+y*TS;
    cx.fillStyle='#06080bdd';cx.fillRect(px+TS*0.14,py+TS*0.1,TS*0.72,TS*0.8);
    cx.font=`700 ${(TS*scale).toFixed(1)}px ${FONT}`;cx.shadowColor=color;cx.shadowBlur=glow;cx.fillStyle=color;cx.fillText(ch,px+TS/2,py+TS/2+1);cx.shadowBlur=0};
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;if(tile[i]===T_STAIRS&&G.seen[i])big('>',x,y,G.vis[i]?'#bff6ff':'#4a5a6a',0.8,G.vis[i]?TS*0.5:0)}
  for(const f of G.floorItems){if(!G.vis[idx(f.x,f.y)])continue;const d=ITEMS[f.it.kind];big(d.ch,f.x,f.y,d.color,0.62,TS*0.3)}
  if(faceMode||G.aimPreview){const sp=G.aimPreview&&G.aimSpec?G.aimSpec:{range:10,stop:true},{path,hit}=rayPath(sp.range,sp.stop);cx.font=`700 ${(TS*0.45).toFixed(1)}px ${FONT}`;
    path.forEach(([x,y],k)=>{if(k===path.length-1)return;cx.fillStyle=`rgba(255,138,61,${(0.85-k*0.06).toFixed(2)})`;cx.fillText('·',ox+(x+.5)*TS,oy+(y+.5)*TS)});
    if(path.length){const [x,y]=path[path.length-1],px=ox+x*TS,py=oy+y*TS,pulse=0.6+0.4*Math.sin(now*0.01);
      if(hit){cx.strokeStyle=`rgba(255,90,74,${pulse.toFixed(2)})`;cx.lineWidth=Math.max(1.5,TS/12);cx.strokeRect(px+2,py+2,TS-4,TS-4)}
      else{cx.fillStyle=`rgba(255,170,90,${pulse.toFixed(2)})`;cx.fillText('×',px+TS/2,py+TS/2)}}}
  for(const m of G.ents){if(!G.vis[idx(m.x,m.y)])continue;
    if(m.silhouette)cx.globalAlpha=0.55;
    big(m.ch,m.x,m.y,m.frozen?'#9fe8ff':m.para?'#c9a0ff':m.color,0.88,m.silhouette?0:TS*0.45);
    cx.globalAlpha=1;
    const px=ox+m.x*TS,py=oy+m.y*TS;
    if(m.para){cx.strokeStyle='#c9a0ff99';cx.setLineDash([3,3]);cx.strokeRect(px+TS*0.12,py+TS*0.08,TS*0.76,TS*0.84);cx.setLineDash([])}
    if(m.frozen){cx.strokeStyle='#9fe8ff88';cx.strokeRect(px+TS*0.12,py+TS*0.08,TS*0.76,TS*0.84)}
    if(m.panic){cx.font=`700 ${(TS*0.32).toFixed(1)}px ${FONT}`;cx.fillStyle='#ffe24a';cx.fillText('!',px+TS*0.85,py+TS*0.18)}
    if(m.face){const [fx,fy]=m.face,col=m.alert>0?'#ff5a4a':m.sus>0?'#ffe24a':'#aab4c2';
      cx.font=`700 ${(TS*0.36).toFixed(1)}px ${FONT}`;cx.fillStyle=col;cx.fillText(ARROWS[fx+','+fy],px+TS*(0.5+fx*0.44),py+TS*(0.5+fy*0.44));
      cx.font=`700 ${(TS*0.3).toFixed(1)}px ${FONT}`;if(m.alert>0){cx.fillStyle='#ff5a4a';cx.fillText('!',px+TS*0.15,py+TS*0.16)}else if(m.sus>0){cx.fillStyle='#ffe24a';cx.fillText('?',px+TS*0.15,py+TS*0.16)}else{cx.fillStyle='#6b7787';cx.fillText('z',px+TS*0.15,py+TS*0.16)}}
    if(m.hp<m.maxhp){cx.fillStyle='#2a0d0d';cx.fillRect(px+TS*0.15,py+TS*0.9,TS*0.7,TS*0.07);cx.fillStyle='#ff6a5a';cx.fillRect(px+TS*0.15,py+TS*0.9,TS*0.7*clamp(m.hp/m.maxhp,0,1),TS*0.07)}
    if(m.carry){cx.font=`700 ${(TS*0.32).toFixed(1)}px ${FONT}`;cx.fillStyle=ITEMS[m.carry.kind].color;cx.fillText(ITEMS[m.carry.kind].ch,px+TS*0.85,py+TS*0.18)}
  }
  if(G.npc&&G.vis[idx(G.npc.x,G.npc.y)]){big('&',G.npc.x,G.npc.y,'#ffb050',0.9,TS*0.6);cx.font=`700 ${(TS*0.3).toFixed(1)}px ${FONT}`;cx.fillStyle='#ffd84a';cx.fillText('$',ox+(G.npc.x+0.85)*TS,oy+(G.npc.y+0.18)*TS)}
  big('@',p.x,p.y,G.over?'#ff6a5a':'#ffffff',0.92,TS*0.6);
  {const [dx,dy]=p.face;cx.font=`700 ${(TS*0.34).toFixed(1)}px ${FONT}`;cx.fillStyle='#ff8a3d';
   cx.fillText(ARROWS[dx+','+dy]||'',ox+(p.x+.5+dx*0.42)*TS,oy+(p.y+.5+dy*0.42)*TS)}
  cx.font=`700 ${(TS*0.38).toFixed(1)}px ${FONT}`;
  for(const f of G.flies){if(!G.vis[idx(f.x,f.y)])continue;const jx=Math.sin(now*0.004+f.id)*TS*0.25,jy=Math.cos(now*0.005+f.id*2)*TS*0.25;
    cx.shadowColor='#f6ff8a';cx.shadowBlur=TS*0.5;cx.fillStyle=`rgba(246,255,138,${0.6+0.4*Math.sin(now*0.01+f.id)})`;cx.fillText('•',ox+(f.x+.5)*TS+jx,oy+(f.y+.5)*TS+jy)}
  cx.shadowBlur=0;
  const keep=[];
  for(const f of G.fx){const a=(now-f.t0)/f.dur;if(a>1)continue;keep.push(f);if(a<0)continue;
    const px=ox+(f.x+.5)*TS,py=oy+(f.y+.5)*TS;
    if(f.k==='g'){cx.globalAlpha=1-a*0.6;cx.font=`700 ${(TS*0.8).toFixed(1)}px ${FONT}`;cx.shadowColor=f.color;cx.shadowBlur=TS*0.6;cx.fillStyle=f.color;cx.fillText(f.ch,px,py)}
    else{cx.globalAlpha=1-a;cx.font=`700 ${(TS*0.42).toFixed(1)}px ${FONT}`;cx.shadowBlur=0;cx.fillStyle=f.color;cx.fillText(f.text,px,py-TS*0.3-a*TS*0.6)}
    cx.globalAlpha=1;cx.shadowBlur=0}
  G.fx=keep;
  if(G.storm&&G.storm.area){const [ax0,ay0,ax1,ay1]=G.storm.area,rx=ox+ax0*TS,ry=oy+ay0*TS,rw=(ax1-ax0+1)*TS,rh=(ay1-ay0+1)*TS;
    cx.save();cx.beginPath();cx.rect(rx,ry,rw,rh);cx.clip();cx.fillStyle='rgba(40,60,90,0.18)';cx.fillRect(rx,ry,rw,rh);
    cx.font=`${(TS*0.42).toFixed(1)}px ${FONT}`;cx.fillStyle='rgba(150,190,255,0.5)';const step=TS*0.55,t=now*0.6;
    for(let yy=ry-step;yy<ry+rh+step;yy+=step)for(let xx=rx;xx<rx+rw;xx+=step){const hsh=h01(Math.round(xx),Math.round(yy),3,9);if(hsh<0.55)continue;
      const fy=ry+((yy-ry+t*(0.8+hsh*0.4))%(rh+step));cx.fillText('/',xx+hsh*step,fy)}
    cx.restore()}
  if(G.flashT&&now-G.flashT<180){cx.fillStyle=`rgba(230,240,255,${(0.35*(1-(now-G.flashT)/180)).toFixed(2)})`;cx.fillRect(0,0,CW,CH)}
  cx.fillStyle=vign;cx.fillRect(0,0,CW,CH);
  if(lookMode&&lookCur){const px=ox+lookCur.x*TS,py=oy+lookCur.y*TS,a=TS*0.3,pulse=0.6+0.4*Math.sin(now*0.008),o=TS*0.04;
    cx.strokeStyle=`rgba(255,170,90,${pulse.toFixed(2)})`;cx.lineWidth=Math.max(1.5,TS/14);cx.beginPath();
    for(const [cx0,cy0,sx,sy] of [[px-o,py-o,1,1],[px+TS+o,py-o,-1,1],[px-o,py+TS+o,1,-1],[px+TS+o,py+TS+o,-1,-1]]){cx.moveTo(cx0+sx*a,cy0);cx.lineTo(cx0,cy0);cx.lineTo(cx0,cy0+sy*a)}
    cx.stroke()}
  drawMinimap(now);
}
// ---------------- minimap ----------------
let mmCanvas=null,mmBig=false,mmRect=null;
const MM_COL={[T_PIT]:[120,90,60],[T_TREE]:[40,110,50],[T_CAMP]:[255,176,70],[T_FLOOR]:[34,42,54],[T_GRASS]:[48,96,42],[T_WATER]:[30,84,140],[T_FIRE]:[255,123,46],[T_ASH]:[60,56,52],[T_OIL]:[96,60,140],[T_ICE]:[140,200,225],
  [T_STAIRS]:[190,246,255],[T_MUD]:[92,70,46],[T_DIRT]:[70,60,48],[T_VINE]:[40,120,60],[T_VINE_ICE]:[120,200,210],[T_GRATE]:[90,104,116],[T_SNOW]:[200,214,230],[T_SLICK]:[150,120,220]};
function buildMinimap(){
  if(!G||!G.tile)return;
  if(!mmCanvas){mmCanvas=document.createElement('canvas');mmCanvas.width=W;mmCanvas.height=H}
  const m=mmCanvas.getContext('2d'),img=m.createImageData(W,H),d=img.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!G.seen[i])continue;const t=G.tile[i];let c;
    if(t===T_WALL){let edge=false;for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(inb(nx,ny)&&G.tile[idx(nx,ny)]!==T_WALL&&G.seen[idx(nx,ny)]){edge=true;break}}if(!edge)continue;c=G.ore[i]===2?[120,220,255]:G.ore[i]===1?[210,130,80]:[120,140,165]}
    else c=MM_COL[t]||MM_COL[T_FLOOR];
    const o=i*4;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=G.vis[i]||t===T_STAIRS?255:170}
  m.putImageData(img,0,0);
}
function drawMinimap(now){
  if(!mmCanvas)buildMinimap();
  const k=mmBig?Math.max(3,Math.floor(Math.min((CW-24)/W,(CH-24)/H))):(CW>=360?3:2),w=W*k,h=H*k;
  const x0=mmBig?Math.round((CW-w)/2):CW-w-8,y0=mmBig?Math.round((CH-h)/2):8;
  mmRect=[x0-4,y0-4,w+8,h+8];
  cx.fillStyle=mmBig?'rgba(4,6,9,0.93)':'rgba(4,6,9,0.72)';cx.fillRect(...mmRect);
  cx.strokeStyle='#243041';cx.lineWidth=1;cx.strokeRect(mmRect[0]+0.5,mmRect[1]+0.5,mmRect[2]-1,mmRect[3]-1);
  cx.imageSmoothingEnabled=false;cx.drawImage(mmCanvas,x0,y0,w,h);cx.imageSmoothingEnabled=true;
  const dot=(x,y,col,s=1)=>{cx.fillStyle=col;const o=(k*(1-s))/2;cx.fillRect(x0+x*k+o,y0+y*k+o,k*s,k*s)};
  for(const f of G.floorItems)if(G.vis[idx(f.x,f.y)])dot(f.x,f.y,'#ffd84a',0.7);
  for(const e of G.ents)if(G.vis[idx(e.x,e.y)])dot(e.x,e.y,'#ff5a4a');
  if(G.npc&&G.seen[idx(G.npc.x,G.npc.y)])dot(G.npc.x,G.npc.y,'#ffb050');
  const p=G.player,blink=0.55+0.45*Math.sin(now*0.008);
  cx.fillStyle=`rgba(255,255,255,${blink.toFixed(2)})`;cx.fillRect(x0+p.x*k-1,y0+p.y*k-1,k+2,k+2);
  if(mmBig){cx.font=`700 11px ${FONT}`;cx.textAlign='left';cx.textBaseline='top';cx.fillStyle='#ff8a3d';cx.fillText(G.sandbox?'SANDBOX MAP':`B${G.depth}F MAP · tap to close`,x0,y0-18<0?y0+2:y0-18);cx.textAlign='center';cx.textBaseline='middle'}
}
function hitMinimap(e){if(!mmRect)return false;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  if(mmBig||(x>=mmRect[0]&&y>=mmRect[1]&&x<=mmRect[0]+mmRect[2]&&y<=mmRect[1]+mmRect[3])){mmBig=!mmBig;return true}return false}
function loop(now){render(now);requestAnimationFrame(loop)}

// ============================================================
//  UI
// ============================================================
const $=s=>document.querySelector(s);
function stateHash(){let h=2166136261;const mix=v=>{h^=v;h=Math.imul(h,16777619)};for(let i=0;i<G.tile.length;i++){mix(G.tile[i]);mix(Math.round(G.heat[i]*255))}for(const m of G.ents){mix(m.x);mix(m.y);mix(m.hp)}const p=G.player;mix(p.x);mix(p.y);mix(p.hp);return(h>>>0).toString(16).padStart(8,'0')}
function stealthTag(){const l=playerLightLevel(),pct=Math.round(Math.min(1,l)*100),[lab,col]=l<0.15?['HIDDEN','#9be070']:l<0.45?['shadowed','#f0c060']:['visible','#ff7a6a'];
  return `<span style="color:${col}">${G.torch===false?'◌':'◉'} ${lab} ${pct}%</span>`}
function updateHUD(){
  const p=G.player,i=idx(p.x,p.y),t=G.tile[i];
  if(SB){
    $('#hud').innerHTML=`<span class="t">SANDBOX</span><span>T<b>${G.turn}</b></span><span>✎ <b>${brushLabel(SB.brush)}</b> ·${SB.size}</span>${stealthTag()}`+
      `<span>${SB.running?'<b style="color:#9be070">▶ running</b>':'❚❚ paused'}</span><span class="dim">AI ${SB.ai?'on':'off'} · god ${SB.god?'on':'off'} · ${TNAME[t]} · ${Math.round(G.heat[i]*100)}°</span>`;
    return}
  const hpPct=Math.max(0,p.hp/p.maxhp*100);
  const wv=WIND[P.windDir],wa=P.windDir==='Calm'?'·':ARROWS[Math.round(wv[0])+','+Math.round(wv[1])];
  $('#hud').innerHTML=`<span class="t">GLYPHWANDER</span><span><b>B${G.depth}F</b>${G.night?' ☾':''}${G.lit?' ☀':''}${G.storm?` <span style="color:#8fb0ff">⛈${G.storm.turns}</span>`:''}</span><span>Lv<b>${p.lv}</b></span>`+
    `<span>HP <b>${p.hp}</b>/${p.maxhp}<span class="bar"><i style="width:${hpPct}%;background:${hpPct<30?'#ff6a5a':'#7fe07f'}"></i></span></span>`+
    `<span>Full <b style="color:${p.full<=20?'#f0c060':'#fff'}">${p.full}%</b></span>`+
    `${stealthTag()}<span>⚔ <b>${p.weapon?itemName(p.weapon):'fists'}</b> <span class="dim">(${atkOf(p)})</span></span><span style="color:#ffd84a">$${p.gold}</span>`+
    `<span class="dim">T${G.turn} · wind ${wa} · ${TNAME[t]} · ${Math.round(G.heat[i]*100)}°</span>`;
}
function renderLog(){const el=$('#log');if(!el)return;el.innerHTML=G.log.slice(-4).map((l,k,a)=>`<div class="${l.cls}" style="opacity:${0.45+0.55*(k+1)/a.length}">${l.msg}</div>`).join('')}
function setFace(on){faceMode=on;const b=$('#faceBtn');if(b)b.classList.toggle('on',on)}
function modalOpen(){return !$('#modal').hidden}
function closeModal(){$('#modal').hidden=true;G.aimPreview=false;G.aimSpec=null;const ae=document.activeElement;if(ae&&$('#sheet').contains(ae))ae.blur()}
function openModal(html,cls){$('#sheet').innerHTML=html;const m=$('#modal');m.className='modal'+(cls?' '+cls:'');m.hidden=false;$('#sheet').scrollTop=0;kbAfterRender()}
$('#modal').addEventListener('pointerdown',e=>{if(e.target.id==='modal'&&!G.over)closeModal()});
const OPKEYS={zap:'z',save:'s',load:'l',del:'x',export:'e',import:'i',copy:'c',go:'↵',merge:'m',use:'u',equip:'e',open:'o',put:'p',split:'s',throw:'t',drop:'d',cook:'c',cookall:'a',build:'b',take:'g',fire:'↵',hone:'h',pouch:'b'};
// Item screens use left-hand keys by position: the options in order are Q W E A S D R F Z V, BACK is X, CLOSE is C.
const POSKEYS=['q','w','e','a','s','d','r','f','z','v'];
function bindOps(map,positional){const sheet=$('#sheet');
  sheet.querySelectorAll('[data-op]').forEach(b=>{b.onclick=()=>{const f=map[b.dataset.op]||map['*'];f&&f(b.dataset.op,b)}});
  const tag=(el,k)=>{el.dataset.key=k;el.insertAdjacentHTML('afterbegin',`<span class="kh">${k.toUpperCase()}</span>`)};
  if(positional){let n=0;
    const opts=[...sheet.querySelectorAll('.row[data-op^="c"]'),...sheet.querySelectorAll('.btns button[data-op]')];
    for(const el of opts){const op=el.dataset.op;if(op==='close')tag(el,'c');else if(op==='back')tag(el,'x');else if(n<POSKEYS.length)tag(el,POSKEYS[n++])}}
  else sheet.querySelectorAll('[data-op]').forEach(b=>{const k=OPKEYS[b.dataset.op];if(k&&b.tagName==='BUTTON'&&!b.dataset.key)tag(b,k)});
  kbAfterRender()}
function choose(title,opts,back){
  openModal(`<h3>${title}</h3>`+opts.map((o,k)=>`<div class="row" tabindex="-1" data-op="c${k}"><span class="g" style="color:${o.color||'#cfd6e0'}">${o.ch||'›'}</span>${o.label}</div>`).join('')+`<div class="btns"><button data-op="back">BACK</button></div>`);
  const map={back:back||(()=>openInv())};opts.forEach((o,k)=>map['c'+k]=o.fn);bindOps(map,true);
}

// ---------------- cooking ----------------
const COOKS={meat:'cooked',rotten:'tainted',onigiri:'grilled'};
function cookSource(){const p=G.player;for(const [dx,dy] of [[0,0],...DIRS8]){const x=p.x+dx,y=p.y+dy;if(!inb(x,y))continue;const i=idx(x,y);
  if(G.tile[i]===T_CAMP)return 'the campfire';if(G.tile[i]===T_FIRE)return 'the flames';if(G.tile[i]===T_GRATE&&G.heat[i]>0.6)return 'the red-hot grate'}return null}
function rawFoods(){const out=[];for(const it of G.player.inv){if(COOKS[it.kind])out.push(it);if(isBag(it))for(const c of it.items)if(COOKS[c.kind])out.push(c)}return out}
function cookItems(list){const src=cookSource();if(!src||!list.length)return false;
  for(const it of list){it.kind=COOKS[it.kind];delete it.age}
  say(list.length===1?`You cook it over ${src}: ${ITEMS[list[0].kind].name}!`:`You cook ${list.length} items over ${src}.`,'fire');
  fxGlyph(G.player.x,G.player.y,'~','#ff8a3d',0,400);return true}
function cookHint(it){if(!COOKS[it.kind])return '';return cookSource()?` <span style="color:#ff9a4a">Fire is close — you can cook this.</span>`:' <span class="dim">Stand next to fire or a red-hot grate to cook it.</span>'}

// ---------------- aiming (confirm direction before a throw) ----------------
// Aim screen for throws and zaps: pick a direction, see exactly where it goes and what it will do, then confirm.
const THROW_MAX=10;
function throwDist(){return clamp(G.throwDist||THROW_MAX,1,THROW_MAX)}
function aimSpec(it){if(ITEMS[it.kind].staff){const k=STAFF_KIND[it.kind];return {zap:k,range:12,stop:k!=='gale'}}return {zap:null,range:throwDist(),stop:true}}
function zapPreview(kind,path,hit){
  const n=t=>path.filter(([x,y])=>t.includes(G.tile[idx(x,y)])).length,bits=[];
  if(kind==='fire'){const f=n([T_GRASS,T_OIL,T_VINE,T_TREE,T_SLICK]);if(f)bits.push(`ignites ${f} tile${f>1?'s':''} on the way`);const m=n([T_ICE,T_SNOW]);if(m)bits.push(`melts ${m}`)}
  if(kind==='ice'){const w=n([T_WATER]);if(w)bits.push(`freezes ${w} water tile${w>1?'s':''} into ice`);const f=n([T_FIRE]);if(f)bits.push(`puts out ${f} fire${f>1?'s':''}`);const o=n([T_OIL]);if(o)bits.push(`turns ${o} oil to slick ice`)}
  if(kind==='bolt'){if(n([T_WATER,T_GRATE])||(hit&&[T_WATER,T_GRATE].includes(G.tile[idx(hit.x,hit.y)])))bits.push('<b style="color:#ffe24a">touches water or metal — it will electrify all of it</b>')}
  if(kind==='gale'){const e=path.map(([x,y])=>entAt(x,y)).find(Boolean);if(e)bits.push(`hurls the ${e.name} back`);const f=n([T_FIRE]);if(f)bits.push(`pushes ${f} fire${f>1?'s':''} forward`)}
  return bits.length?' It '+bits.join(', ')+'.':''}
function openAim(it,onFire,back){
  const p=G.player,spec=aimSpec(it);G.aimPreview=true;G.aimSpec=spec;
  const DG=[[-1,-1],[0,-1],[1,-1],[-1,0],null,[1,0],[-1,1],[0,1],[1,1]];
  const {path,hit}=rayPath(spec.range,spec.stop);
  let info;
  if(spec.zap){
    if(it.charges<=0)info='<span style="color:#f0c060">The staff is spent — nothing will happen, and it still takes a turn.</span>';
    else if(hit)info=`<b style="color:#ff6a5a">Will hit the ${hit.name}</b> ${path.length} tile${path.length>1?'s':''} away.`+zapPreview(spec.zap,path,hit);
    else if(path.length)info=`Travels ${path.length} tile${path.length>1?'s':''}${spec.zap==='gale'?'':' and hits nothing'}.`+zapPreview(spec.zap,path,hit);
    else info='<span style="color:#f0c060">Blocked right in front of you.</span>';
  }else{
    if(hit)info=`<b style="color:#ff6a5a">Will hit the ${hit.name}</b> ${path.length} tile${path.length>1?'s':''} away.`;
    else if(path.length){const [lx,ly]=path[path.length-1],t=G.tile[idx(lx,ly)];info=`${path.length<throwDist()?'Something stops it early — it':'It'} lands ${path.length} tile${path.length>1?'s':''} away on ${TNAME[t]}${t===T_WATER&&!isBag(it)&&!['oilJar','miasma','seeds'].includes(it.kind)?' — and sinks':t===T_FIRE?' — right into the fire':''}.`}
    else info='<span style="color:#f0c060">Blocked right in front of you — it will drop at your feet.</span>';
  }
  // quick-aim: visible monsters that this throw or zap would actually reach
  const quick=[],saved=p.face;
  for(const m of G.ents){if(!G.vis[idx(m.x,m.y)])continue;const dx=m.x-p.x,dy=m.y-p.y;if(!(dx===0||dy===0||Math.abs(dx)===Math.abs(dy)))continue;
    p.face=[sgn(dx),sgn(dy)];const r=rayPath(spec.zap?spec.range:THROW_MAX,true);if(r.hit===m)quick.push([p.face,m,cheb(m.x,m.y,p.x,p.y)])}
  p.face=saved;
  const cur=p.face.join(','),verb=spec.zap?'ZAP':'THROW';
  openModal(`<h3>${verb} ${(spec.zap?itemName(it):qty(it)>1?'1 '+ITEMS[it.kind].name:itemName(it)).toUpperCase()} — AIM</h3>
    <div class="aim"><div class="aimgrid">${DG.map((d,k)=>d?`<button data-op="d${k}" class="${d.join(',')===cur?'on':''}">${ARROWS[d.join(',')]}</button>`:'<span>@</span>').join('')}</div>
    <div class="desc" style="margin:0;flex:1">Facing <b style="color:#ff8a3d">${ARROWS[cur]}</b>. ${info}<br><span class="dim">Check the line on the map, then confirm.</span></div></div>
    ${spec.zap?'':`<div class="dist"><span class="dim">Distance</span><button data-op="dm" ${throwDist()<=1?'disabled':''}>−</button><b>${throwDist()}</b><span class="dim">/ ${THROW_MAX}</span><button data-op="dp" ${throwDist()>=THROW_MAX?'disabled':''}>+</button><button data-op="dmax" ${throwDist()>=THROW_MAX?'disabled':''}>MAX</button><span class="dim kh2">Shift+← → or − +</span></div>`}
    ${quick.length?`<div class="chips">${quick.map(([f,m],k)=>`<button class="chip" data-op="q${k}" style="color:${m.color}">${k+1} · ${ARROWS[f.join(',')]} ${m.name}</button>`).join('')}</div>`:''}
    <div class="btns"><button data-op="fire" class="on">${verb} ${ARROWS[cur]}</button><button data-op="back">BACK</button></div>`,'clear');
  const map={fire:()=>{closeModal();G.aimSpec=null;onFire();endTurn()},back:()=>{G.aimPreview=true;back()}};
  DG.forEach((d,k)=>{if(d)map['d'+k]=()=>{p.face=d;updateHUD();openAim(it,onFire,back)}});
  quick.forEach(([f,,d],k)=>map['q'+k]=()=>{p.face=f;if(!spec.zap&&throwDist()<d)G.throwDist=d;updateHUD();openAim(it,onFire,back)});
  map.dm=()=>{G.throwDist=Math.max(1,throwDist()-1);openAim(it,onFire,back)};
  map.dp=()=>{G.throwDist=Math.min(THROW_MAX,throwDist()+1);openAim(it,onFire,back)};
  map.dmax=()=>{G.throwDist=THROW_MAX;openAim(it,onFire,back)};
  bindOps(map,true);
}

// ---------------- inventory with bags ----------------
let invSel=0,invBag=null,bagSel=0;
const FOOD=['onigiri','grilled','meat','cooked','rotten'];
function bagsIn(exclude){return G.player.inv.filter(x=>isBag(x)&&x!==exclude)}
function rowHtml(it,k,sel,eq){const d=ITEMS[it.kind];return `<div class="row selrow ${k===sel?'sel':''}" tabindex="-1" data-op="r${k}"><span class="g" style="color:${d.color}">${d.ch}</span>${itemName(it)}${eq?' <span style="color:#ff8a3d;margin-left:auto">E</span>':''}</div>`}
function act(fn){closeModal();if(fn()!==false)endTurn()}
function openInv(){
  if(G.over||paralyzed())return;const p=G.player,inv=p.inv;
  if(invBag&&!inv.includes(invBag))invBag=null;
  if(invBag)return openBagView();
  if(!inv.length){say('Your pack is empty.','dim');return}
  invSel=clamp(invSel,0,inv.length-1);G.aimPreview=true;
  const it=inv[invSel],d=ITEMS[it.kind],dir=ARROWS[p.face.join(',')],bags=bagsIn(it).filter(b=>bagRoomFor(b,it));
  let btns='';
  if(it.kind==='weapon')btns+=`<button data-op="equip">${it===p.weapon?'UNEQUIP':'EQUIP'}</button>`;
  else if(isBag(it))btns+=`<button data-op="open">OPEN</button>`;
  else if(d.use)btns+=`<button data-op="use">${d.staff?'ZAP '+dir:FOOD.includes(it.kind)?'EAT':'READ'}</button>`;
  if(it.kind==='lumber'||it.kind==='dryGrass')btns+=`<button data-op="build" ${findItem('lumber')&&findItem('dryGrass')?'':'disabled'}>BUILD FIRE ${dir}</button>`;
  const raw=rawFoods();if(COOKS[it.kind]&&cookSource())btns+=`<button data-op="cook">COOK</button>`;
  if(raw.length>1&&cookSource())btns+=`<button data-op="cookall">COOK ALL (${raw.length})</button>`;
  if(!isBag(it)&&bagsIn(it).length)btns+=`<button data-op="put" ${bags.length?'':'disabled'}>PUT IN BAG</button>`;
  if(qty(it)>1)btns+=`<button data-op="split" ${inv.length<12?'':'disabled'}>SPLIT</button>`;
  if(STACK[it.kind]&&inv.some(o=>o!==it&&o.kind===it.kind&&qty(o)<STACK[it.kind]))btns+=`<button data-op="merge">COMBINE</button>`;
  btns+=`<button data-op="throw">THROW ${dir}</button><button data-op="drop">DROP</button><button data-op="close">CLOSE</button>`;
  let extra=STACK[it.kind]?` Stacks up to ${STACK[it.kind]}.`:'';if(it.kind==='weapon'){const w=WEAPONS[it.w];extra=` Power ${w.atk}${it.plus?(it.plus>0?' +':' ')+it.plus:''}.${w.dig?' Bump walls to dig through them.':''}${it.seals.length?' Seals: '+it.seals.map(s=>SEALS[s].name).join(', ')+'.':''}`}
  if(isBag(it))extra=it.items.length?' Inside: '+it.items.map(itemName).join(', ')+'.':' Empty.';
  extra+=cookHint(it);
  openModal(`<h3>PACK ${inv.length}/12 · $${p.gold} · FACING ${dir}</h3>`+inv.map((x,k)=>rowHtml(x,k,invSel,x===p.weapon)).join('')+
    `<div class="desc">${d.desc}${extra}</div><div class="btns">${btns}</div>`);
  const map={close:closeModal,
    equip:()=>{p.weapon=it===p.weapon?null:it;say(p.weapon?`You equip the ${itemName(it)}.`:'You put your weapon away.');updateHUD();openInv()},
    open:()=>{invBag=it;bagSel=0;openInv()},
    put:()=>{if(bags.length===1)putIn(it,bags[0]);else choose('PUT INTO WHICH BAG?',bags.map(b=>({label:itemName(b),ch:'(',color:ITEMS[b.kind].color,fn:()=>putIn(it,b)})))},
    throw:()=>openAim(it,()=>throwItem(invSel),openInv),
    cook:()=>act(()=>cookItems([it])),
    split:()=>splitMenu(inv,it,12,openInv),
    merge:()=>{const left=mergeInto(inv,it);if(!left){inv.splice(inv.indexOf(it),1);invSel=Math.max(0,invSel-1)}say('You combine the stacks.');openInv()},
    build:()=>act(()=>buildCampfire()),
    cookall:()=>act(()=>cookItems(rawFoods())),
    drop:()=>act(()=>{dropItem(invSel)}),
    use:()=>{if(d.staff)return openAim(it,()=>zapStaff(it),openInv);
      const allBags=bagsIn(it);
      if(d.bagT&&allBags.length){const opts=allBags.map(b=>({label:'Onto '+itemName(b),ch:'(',color:ITEMS[b.kind].color,fn:()=>act(()=>useItem(invSel,b))}));
        if(!d.bagOnly)opts.unshift({label:d.seal||it.kind==='honing'?'Onto your equipped weapon':it.kind==='recharge'?'On your carried staffs':'Around yourself',ch:'@',fn:()=>act(()=>useItem(invSel))});
        choose(`READ ${d.name.toUpperCase()}…`,opts);return}
      act(()=>useItem(invSel))},
  };
  inv.forEach((x,k)=>map['r'+k]=()=>{invSel=k;openInv()});
  bindOps(map,true);
}
function bagRoomFor(b,it){return b.items.length<ITEMS[b.kind].bag||(STACK[it.kind]&&b.items.some(o=>o.kind===it.kind&&qty(o)<STACK[it.kind]))}
function putIn(it,bag){const p=G.player,bn=ITEMS[bag.kind].name,name=itemName(it),before=qty(it);
  if(!bagRoomFor(bag,it)){say('That bag is full.','dim');return openInv()}
  let left=mergeInto(bag.items,it);
  if(left&&bag.items.length<ITEMS[bag.kind].bag){bag.items.push(left);left=null}
  if(!left){p.inv.splice(p.inv.indexOf(it),1);if(it===p.weapon)p.weapon=null;say(`You put the ${name} in the ${bn}.`);invSel=Math.max(0,invSel-1)}
  else say(`You fit ${before-qty(it)} into the ${bn}; it's full. ${itemName(it)} stays in your pack.`,'warn');
  updateHUD();openInv()}
function splitMenu(list,it,cap,back){
  const n=qty(it);if(n<2){say('There is nothing to split.','dim');return back()}
  if(list.length>=cap){say('No free slot to split into.','warn');return back()}
  const amts=[...new Set([1,5,10,Math.floor(n/2)].filter(a=>a>=1&&a<n))].sort((a,b)=>a-b);
  choose(`SPLIT ${itemName(it).toUpperCase()}`,amts.map(a=>({label:`Split off ${a}${a===Math.floor(n/2)?' (half)':''} → ${n-a} + ${a}`,ch:ITEMS[it.kind].ch,color:ITEMS[it.kind].color,
    fn:()=>{it.n=n-a;list.splice(list.indexOf(it)+1,0,Object.assign({},it,{n:a}));say(`Split into ${n-a} and ${a}.`);back()}})),back)}
function openBagView(){
  const p=G.player,b=invBag,bd=ITEMS[b.kind],items=b.items;
  bagSel=clamp(bagSel,0,Math.max(0,items.length-1));
  const it=items[bagSel];
  openModal(`<h3>${bd.name.toUpperCase()} ${items.length}/${bd.bag}${bd.fireproof?' · FIREPROOF':''}</h3>`+
    (items.length?items.map((x,k)=>rowHtml(x,k,bagSel)).join(''):`<div class="desc">Empty. Select an item in your pack and choose PUT IN BAG.</div>`)+
    (it?`<div class="desc">${ITEMS[it.kind].desc}${cookHint(it)}</div>`:'')+
    `<div class="btns">${it?`<button data-op="take" ${p.inv.length>=12&&!(STACK[it.kind]&&p.inv.some(o=>o.kind===it.kind&&qty(o)<STACK[it.kind]))?'disabled':''}>TAKE OUT</button><button data-op="throw">THROW ${ARROWS[p.face.join(',')]}</button>`+(ITEMS[it.kind].staff?`<button data-op="zap">ZAP ${ARROWS[p.face.join(',')]}</button>`:'')+(COOKS[it.kind]&&cookSource()?`<button data-op="cook">COOK</button>`:'')+(qty(it)>1?`<button data-op="split" ${items.length<bd.bag?'':'disabled'}>SPLIT</button>`:''):''}<button data-op="back">BACK</button><button data-op="close">CLOSE</button></div>`);
  const map={close:()=>{invBag=null;closeModal()},back:()=>{invBag=null;openInv()},
    take:()=>{const k=items.indexOf(it),name=itemName(it);if(addToPack(it)){items.splice(k,1);say(`You take the ${name} out.`)}else say(`Your pack is full — ${itemName(it)} stays in the ${bd.name}.`,'warn');updateHUD();openInv()},
    split:()=>splitMenu(items,it,bd.bag,openBagView),
    zap:()=>openAim(it,()=>{say(`You raise the ${ITEMS[it.kind].name} from the ${bd.name}…`,'dim');zapStaff(it)},openBagView),
    throw:()=>openAim(it,()=>{const k=b.items.indexOf(it);if(k<0)return;const one=takeOne(b.items,k);say(`You pull the ${itemName(one)} from the ${bd.name}…`,'dim');throwIt(one)},openBagView),
    cook:()=>act(()=>cookItems([it]))};
  items.forEach((x,k)=>map['r'+k]=()=>{bagSel=k;openBagView()});
  bindOps(map,true);
}

// ---------------- blacksmith ----------------
const SEAL_COST=80,POUCH_COST=60,PICK_COST=40;
const honeCost=w=>25*(Math.max(0,w.plus)+1);
function countItem(kind){let n=0;for(const it of G.player.inv){if(it.kind===kind)n+=qty(it);if(isBag(it))for(const c of it.items)if(c.kind===kind)n+=qty(c)}return n}
function spendItem(kind,n){for(let k=0;k<n;k++){const f=findItem(kind);if(!f)return false;removeFound(f)}return true}
const SMELT=[['ironOre','ironBar',5],['mithrilOre','mithrilBar',15]];
const TRADES=[
  {id:'greatsword',label:'GREATSWORD (power 7)',cost:{ironBar:3},give:()=>mkWeapon('greatsword')},
  {id:'mithril',label:'MITHRIL EDGE (power 9)',cost:{mithrilBar:2,ironBar:1},give:()=>mkWeapon('mithril')},
  {id:'temper',label:'TEMPER YOUR WEAPON +2',cost:{ironBar:2},needsWeapon:true,apply:w=>{w.plus+=2}},
  {id:'runed',label:'RUNE-FORGE: ADD EVERY SEAL',cost:{mithrilBar:2},needsWeapon:true,apply:w=>{for(const s of Object.keys(SEALS))if(!w.seals.includes(s))w.seals.push(s)}},
  {id:'satchel',label:'SATCHEL',cost:{ironBar:2},give:()=>mkItem('satchel')},
  {id:'charge',label:'OVERCHARGE ALL STAFFS +3',cost:{mithrilBar:1},apply:()=>{for(const x of G.player.inv)if(ITEMS[x.kind].staff)x.charges+=3}},
];
const costText=c=>Object.entries(c).map(([k,n])=>`${n} ${ITEMS[k].name.toLowerCase()}${n>1?'s':''}`).join(' + ');
function openSmith(){
  const p=G.player,w=p.weapon;
  let h=`<h3>BLACKSMITH · $${p.gold}</h3><div class="desc">"${w?`A ${itemName(w)}. I can make that sing.`:'Bare-handed? I can still smelt and trade.'}"<br><span class="dim">You carry: ${['ironOre','mithrilOre','ironBar','mithrilBar'].map(k=>`${countItem(k)} ${ITEMS[k].name.toLowerCase()}`).join(' · ')}</span></div><div class="btns col">`;
  for(const [ore,bar,fee] of SMELT){const n=countItem(ore),k=Math.min(Math.floor(n/2),Math.floor(p.gold/fee));
    h+=`<button data-op="smelt:${ore}" ${k<1?'disabled':''}>SMELT ${ITEMS[ore].name.toUpperCase()} → BARS${k>0?` ×${k}`:''} — 2 ore + $${fee} each</button>`}
  for(const t of TRADES){const can=Object.entries(t.cost).every(([k,n])=>countItem(k)>=n)&&(!t.needsWeapon||w)&&(!t.give||p.inv.length<12);
    h+=`<button data-op="trade:${t.id}" ${can?'':'disabled'}>${t.label} — ${costText(t.cost)}</button>`}
  if(w){const hc=honeCost(w);h+=`<button data-op="hone" ${p.gold<hc?'disabled':''}>HONE TO +${w.plus+1} — $${hc}</button>`;
    for(const s of Object.keys(SEALS))if(!w.seals.includes(s))h+=`<button data-op="seal:${s}" ${p.gold<SEAL_COST?'disabled':''}>${SEALS[s].name.toUpperCase()} SEAL — $${SEAL_COST}</button>`}
  h+=`<button data-op="pick" ${p.gold<PICK_COST||p.inv.length>=12?'disabled':''}>BUY A PICKAXE — $${PICK_COST}</button>`;
  h+=`<button data-op="pouch" ${p.gold<POUCH_COST||p.inv.length>=12?'disabled':''}>BUY A POUCH — $${POUCH_COST}</button><button data-op="close">LEAVE</button></div>`;
  openModal(h);
  bindOps({close:closeModal,
    hone:()=>{const c=honeCost(w);p.gold-=c;w.plus++;say(`Clang! Your weapon is now ${itemName(w)}.`,'good');updateHUD();openSmith()},
    pouch:()=>{p.gold-=POUCH_COST;p.inv.push(mkItem('pouch'));say('You buy a pouch.','good');updateHUD();openSmith()},
    pick:()=>{p.gold-=PICK_COST;p.inv.push(mkWeapon('pickaxe'));say('You buy a pickaxe. Walls with ore veins are yours to mine.','good');updateHUD();openSmith()},
    '*':(op)=>{
      if(op.startsWith('seal:')){const s=op.slice(5);p.gold-=SEAL_COST;w.seals.push(s);say(`The smith hammers a ${SEALS[s].name} seal into your ${WEAPONS[w.w].name}.`,'good')}
      else if(op.startsWith('smelt:')){const [ore,bar,fee]=SMELT.find(x=>x[0]===op.slice(6));const k=Math.min(Math.floor(countItem(ore)/2),Math.floor(p.gold/fee));
        spendItem(ore,k*2);p.gold-=k*fee;const b=mkItem(bar);b.n=k;if(!addToPack(b))placeFloor(p.x,p.y,b);say(`The furnace roars. You get ${k} ${ITEMS[bar].name.toLowerCase()}${k>1?'s':''}.`,'good')}
      else if(op.startsWith('trade:')){const t=TRADES.find(x=>x.id===op.slice(6));for(const [k,n] of Object.entries(t.cost))spendItem(k,n);
        if(t.give){const it=t.give();p.inv.push(it);say(`The smith hands you a ${itemName(it)}.`,'good')}else{t.apply(w);say(w&&t.needsWeapon?`Done. Your weapon is now ${itemName(w)}.`:'Done. Your staffs crackle with power.','good')}}
      updateHUD();openSmith()}});
}

// ---------------- engine panel ----------------
function openParams(){
  let h=`<h3>ENGINE PARAMETERS</h3><div class="note">Changes apply live. Same seed + same inputs + same params = the same run, every time.</div>`;
  for(const d of PARAM_DEFS){
    if(d.h){h+=`<div class="ph">${d.h}</div>`;continue}
    if(d.select)h+=`<div class="prm"><label>${d.label}</label><select data-k="${d.k}">${d.select.map(o=>`<option ${o===P[d.k]?'selected':''}>${o}</option>`).join('')}</select><span></span></div>`;
    else h+=`<div class="prm"><label>${d.label}</label><input type="range" data-k="${d.k}" min="${d.min}" max="${d.max}" step="${d.step}" value="${P[d.k]}"><span>${P[d.k]}</span></div>`;
  }
  h+=`<div class="ph">RUN</div><div class="prm"><label>Seed</label><input type="number" id="seedIn" value="${P.seed}"><span></span></div>
  <div class="note">State hash: <b style="color:#fff">${stateHash()}</b> (turn ${G.turn})</div>
  <div class="btns"><button id="svl">SAVE / LOAD</button><button id="con">CONSOLE (~)</button><button id="sbx">${SB?'EXIT SANDBOX':'SANDBOX MODE'}</button><button id="rs">RESTART SEED</button><button id="rr">RANDOM SEED</button><button id="pc">CLOSE</button></div>`;
  openModal(h);
  $('#sheet').querySelectorAll('[data-k]').forEach(el=>el.oninput=()=>{const k=el.dataset.k;P[k]=el.tagName==='SELECT'?el.value:+el.value;
    if(el.nextElementSibling)el.nextElementSibling.textContent=el.value;if(k==='zoom')resize();if(k==='lightRadius')computeView();updateHUD()});
  $('#svl').onclick=()=>{closeModal();openSaves()};
  $('#con').onclick=()=>{closeModal();openConsole()};
  $('#sbx').onclick=()=>{closeModal();SB?exitSandbox():enterSandbox()};
  $('#rs').onclick=()=>{closeModal();if(SB)exitSandbox();G.log=[];newRun(+$('#seedIn').value||0)};
  $('#rr').onclick=()=>{closeModal();if(SB)exitSandbox();G.log=[];newRun((Math.random()*1e9)>>>0)};
  $('#pc').onclick=closeModal;
}
function showEnd(title,body){
  openModal(`<h3>${title}</h3><div class="desc">${body}<br>Seed ${P.seed}${G.cheated?' · <span style="color:#f0c060">console used</span>':''}</div><div class="btns"><button id="e1">SAME SEED</button><button id="e2">NEW SEED</button></div>`);
  $('#e1').onclick=()=>{closeModal();newRun(P.seed)};$('#e2').onclick=()=>{closeModal();newRun((Math.random()*1e9)>>>0)};
}

// ============================================================
//  SANDBOX
// ============================================================
const BRUSHES=[
  ['GROUND',[['t:1','floor'],['t:0','wall'],['t:2','grass'],['t:3','water'],['t:6','oil'],['t:7','ice'],['t:9','mud'],['t:10','dirt'],['t:11','vines'],['t:13','grate'],['t:14','snow'],['t:15','slick ice'],['t:5','ash'],['t:4','fire'],['t:16','campfire'],['t:17','tree'],['t:18','fire pit (out)'],['o:1','iron vein (on wall)'],['o:2','mithril vein (on wall)']]],
  ['AIR & ENERGY',[['a:smoke','smoke'],['a:pois','poison'],['a:hot','heat'],['a:cold','cold'],['a:zap','lightning']]],
  ['CREATURES',[...Object.keys(MON).map(k=>['m:'+k,MON[k].name]),['npc','blacksmith'],['erase','erase thing']]],
  ['ITEMS',Object.keys(ITEMS).map(k=>['i:'+k,ITEMS[k].name])],
];
const BRUSH_COL={'t:18':'#c08a50','o:1':'#d08a5a','o:2':'#9fe8ff','t:17':'#4fb060','t:16':'#ffb050','t:0':'#8a96a8','t:1':'#5a6575','t:2':'#7fd060','t:3':'#4aa8ff','t:4':'#ff7b2e','t:5':'#8a8078','t:6':'#b07cff','t:7':'#9fe8ff','t:9':'#a07848','t:10':'#b09a78','t:11':'#4fc060','t:13':'#9aa6b6','t:14':'#f0f6ff','t:15':'#c9a8ff',
  'a:smoke':'#9aa0a8','a:pois':'#c8f040','a:hot':'#ff6a3a','a:cold':'#7fb8ff','a:zap':'#fff27a',npc:'#ffb050',erase:'#ff6a5a'};
function brushLabel(b){for(const [,l] of BRUSHES)for(const [k,n] of l)if(k===b)return n;return b}
function brushColor(b){if(BRUSH_COL[b])return BRUSH_COL[b];if(b.startsWith('m:'))return MON[b.slice(2)].color;if(b.startsWith('i:'))return ITEMS[b.slice(2)].color;return '#cfd6e0'}
function enterSandbox(){
  if(SB)return;closeModal();setFace(false);stopExplore();exitLook();
  SB={saved:G,brush:'t:2',size:2,running:false,timer:null,ai:false,god:true};
  const p={x:W>>1,y:H>>1,ch:'@',name:'you',hp:40,maxhp:40,atk:2,def:1,lv:1,xp:0,full:100,face:[1,0],inv:[],isPlayer:true,stuck:0,gold:999,weapon:null};
  G={depth:1,turn:0,uid:0,over:false,log:[],fx:[],flies:[],sandbox:true,night:false,player:p,npc:null,cause:''};
  G.rng=mulberry32(hashU(P.seed,0x5A2D,1,1));
  buildArena();
  const kw=mkWeapon('katana');p.weapon=kw;
  p.inv.push(kw);for(const k of ['fireStaff','iceStaff','boltStaff','galeStaff']){const s=mkItem(k);s.charges=99;p.inv.push(s)}
  p.inv.push(mkItem('satchel'),mkItem('oilJar'),mkItem('miasma'),mkItem('honing'),mkItem('smelting'),Object.assign(mkItem('lumber'),{n:20}),Object.assign(mkItem('dryGrass'),{n:20}));
  camX=p.x;camY=p.y;
  say('SANDBOX — tap or drag on the map to paint. STEP = one turn, RUN = continuous. You are invulnerable; monster AI starts off.','warn');
  setActs();computeView();updateHUD();
}
function buildArena(){
  allocLayers();G.npc=null;G.flies=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=idx(x,y);G.tile[i]=x===0||y===0||x===W-1||y===H-1?T_WALL:T_FLOOR;G.roomIdx[i]=0}
  G.rooms=[{x:1,y:1,w:W-2,h:H-2,real:true,lit:false}];G.stairRoom=0;
}
function exitSandbox(){if(!SB)return;stopRun();closeModal();exitLook();G=SB.saved;SB=null;setActs();camX=G.player.x;camY=G.player.y;computeView();updateHUD();renderLog();resize()}
function stopRun(){if(SB&&SB.timer){clearInterval(SB.timer);SB.timer=null}if(SB)SB.running=false}
function toggleRun(){if(!SB)return;if(SB.running)stopRun();else{SB.running=true;SB.timer=setInterval(()=>{if(!modalOpen()&&!painting)endTurn()},220)}setActs();updateHUD()}
function openBrush(){
  let h=`<h3>BRUSH</h3><div class="ph">SIZE (ground & air)</div><div class="chips">${[1,2,3,4].map(n=>`<button class="chip ${SB.size===n?'on':''}" data-op="sz${n}">${n*2-1}×${n*2-1}</button>`).join('')}</div>`;
  for(const [g,list] of BRUSHES)h+=`<div class="ph">${g}</div><div class="chips">${list.map(([k,n])=>`<button class="chip ${SB.brush===k?'on':''}" data-op="b:${k}" style="color:${brushColor(k)}">${n}</button>`).join('')}</div>`;
  openModal(h+`<div class="btns"><button data-op="close">CLOSE</button></div>`);
  bindOps({close:closeModal,'*':(op)=>{if(op.startsWith('sz')){SB.size=+op.slice(2);openBrush()}else if(op.startsWith('b:')){SB.brush=op.slice(2);closeModal()}updateHUD();setActs()}});
}
function openSbMenu(){
  openModal(`<h3>SANDBOX</h3><div class="btns col">
    <button data-op="ai">MONSTER AI: ${SB.ai?'ON':'OFF'}</button><button data-op="god">INVULNERABLE: ${SB.god?'ON':'OFF'}</button>
    <button data-op="refill">REFILL STAFFS</button><button data-op="clear">CLEAR ARENA</button><button data-op="params">ENGINE PARAMETERS</button>
    <button data-op="exit">EXIT SANDBOX → BACK TO RUN</button><button data-op="close">CLOSE</button></div>
    <div class="note">Painting never advances time, and the sandbox uses the same simulation rules as the real game. Monster and item brushes place one at a time.</div>`);
  bindOps({close:closeModal,ai:()=>{SB.ai=!SB.ai;updateHUD();openSbMenu()},god:()=>{SB.god=!SB.god;updateHUD();openSbMenu()},
    refill:()=>{for(const x of G.player.inv)if(ITEMS[x.kind].staff)x.charges=99;G.player.hp=G.player.maxhp;say('Staffs refilled.','good');closeModal()},
    clear:()=>{const p=G.player;buildArena();p.x=W>>1;p.y=H>>1;G.turn=0;computeView();updateHUD();closeModal();say('Arena cleared.','dim')},
    params:openParams,exit:exitSandbox});
}
function applyBrush(x,y,stroke){
  if(!inb(x,y))return;const b=SB.brush,i=idx(x,y),border=x===0||y===0||x===W-1||y===H-1;
  if(b.startsWith('t:')){if(border)return;const t=+b.slice(2);if(!passTile(t)&&occupant(x,y))return;
    G.tile[i]=t;G.fuel[i]=0;G.src[i]=0;G.stored[i]=0;G.elec[i]=0;
    G.ore[i]=0;if(t===T_FIRE){G.fuel[i]=P.burnTime;G.src[i]=1;G.heat[i]=1}else if(t===T_CAMP){G.fuel[i]=120;G.heat[i]=0.95}else if(t===T_TREE){G.fuel[i]=3}else if(t===T_PIT){G.fuel[i]=120}else if(COLD(t))G.heat[i]=0.1;
    if(!passTile(t))G.floorItems=G.floorItems.filter(f=>!(f.x===x&&f.y===y));return}
  if(b==='o:1'||b==='o:2'){if(G.tile[i]===T_WALL&&!border)G.ore[i]=+b.slice(2);return}
  if(G.tile[i]===T_WALL)return;
  switch(b){
    case 'a:smoke':G.gas[i]=1;return;
    case 'a:pois':G.pois[i]=1;return;
    case 'a:hot':G.heat[i]=1;return;
    case 'a:cold':G.heat[i]=0;return;
    case 'a:zap':{if(G.tile[i]===T_WATER||G.tile[i]===T_GRATE){if(!stroke.zapped){stroke.zapped=true;electrify(x,y)}}else{fxGlyph(x,y,'ϟ','#fff27a');const e=occupant(x,y);if(e)hurt(e,8,'electrocution');G.heat[i]=Math.max(G.heat[i],0.9)}return}
    case 'npc':if(walkable(x,y)&&!occupant(x,y))G.npc={x,y,ch:'&',name:'blacksmith',npc:true};return;
    case 'erase':G.ents=G.ents.filter(m=>!(m.x===x&&m.y===y));G.floorItems=G.floorItems.filter(f=>!(f.x===x&&f.y===y));if(G.npc&&G.npc.x===x&&G.npc.y===y)G.npc=null;G.flies=G.flies.filter(f=>!(f.x===x&&f.y===y));return;
  }
  if(b.startsWith('m:')&&walkable(x,y)&&!occupant(x,y)){G.ents.push(mkMonster(b.slice(2),x,y));return}
  if(b.startsWith('i:')&&walkable(x,y)){const it=mkItem(b.slice(2));if(it.kind==='gold')it.amt=100;G.floorItems.push({x,y,it})}
}
let painting=false,stroke=null;
function paintAt(e){
  const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left-lastOx)/TS),y=Math.floor((e.clientY-r.top-lastOy)/TS);
  const single=/^(m:|i:|npc)/.test(SB.brush),rad=single?0:SB.size-1;
  for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){if(Math.hypot(dx,dy)>rad+0.5)continue;const k=(x+dx)+','+(y+dy);if(stroke.cells.has(k))continue;stroke.cells.add(k);applyBrush(x+dx,y+dy,stroke)}
  computeView();updateHUD();
}
cv.addEventListener('pointerdown',e=>{if(modalOpen())return;if(hitMinimap(e)){e.preventDefault();return}
  if(lookMode){const r=cv.getBoundingClientRect();lookCur={x:clamp(Math.floor((e.clientX-r.left-lastOx)/TS),0,W-1),y:clamp(Math.floor((e.clientY-r.top-lastOy)/TS),0,H-1)};updateLook();return}
  if(!SB)return;e.preventDefault();painting=true;stroke={cells:new Set()};try{cv.setPointerCapture(e.pointerId)}catch(_){}paintAt(e)});
cv.addEventListener('pointermove',e=>{if(painting&&SB)paintAt(e)});
['pointerup','pointercancel'].forEach(ev=>cv.addEventListener(ev,()=>{painting=false;stroke=null}));

// ---------------- LOOK ----------------
let lookMode=false,lookCur=null,lookIdx=0;
const TDESC={[T_WALL]:'Solid rock. A pickaxe can dig through it.',[T_FLOOR]:'Bare stone.',[T_GRASS]:'Flammable. Catches faster when hot and dry.',[T_WATER]:'Stops fire, conducts lightning, freezes into ice.',
  [T_FIRE]:'Burning! Hurts anything standing in it.',[T_ASH]:'Burnt ground. Regrows into grass; rain turns it to mud.',[T_OIL]:'Burns fast and chains to nearby oil. Freezes into slick ice.',
  [T_ICE]:'Walkable. Melts with heat — whoever stands on it drops into freezing water.',[T_STAIRS]:'Stairs leading down.',[T_MUD]:'Traps you for a turn. Bakes into dirt when hot.',
  [T_DIRT]:'Grass regrows quickly here.',[T_VINE]:'Blocks movement and sight. Hack through it or burn it fast.',[T_VINE_ICE]:'Frozen vines. They shatter if you walk into them.',
  [T_GRATE]:'Metal. Conducts lightning and heat; scalding when hot.',[T_SNOW]:'Shows footprints. Melts into puddles.',[T_PIT]:'A put-out campfire. Dark and cold, but it keeps its fuel. Walk into it to relight it or add lumber; nearby fire can relight it too.',[T_TREE]:'A tree. Blocks movement and sight — good cover. Chop it down for lumber (3 swings, noisy). Burns for a long time.',[T_CAMP]:'A contained fire: light, heat and somewhere to cook. You heal every turn beside it. Walk into it with lumber to add fuel. Rain or frost puts it out; its embers can catch nearby grass.',[T_SLICK]:'Frozen oil. You slide across it until you hit something.'};
MON.rat.desc='Scurries about; only fights when you come close.';MON.goblin.desc='Hunts you on sight.';MON.beetle.desc='Grazes on grass and chews through vines, leaving bare dirt.';
MON.slime.desc='Splits in two when hit. Heals and multiplies in water.';MON.ember.desc='Leaves fire wherever it walks through grass or oil. Drawn to fireflies; water hurts it.';
MON.toad.desc='Belches clouds of poison gas. Immune to poison.';MON.thief.desc='Steals an item and flees at double speed. Drops loot if it runs through fire.';
MON.ogre.desc='Slow but brutal. Panics near fire and tramples anything in its way.';MON.wraith.desc='Freezes the ground it walks on. Immune to cold, takes double damage from fire.';
function traits(m){const t=[];if(m.para)t.push(`paralyzed ${m.para}t`);if(m.fireImmune)t.push('fire-immune');if(m.poisonImmune)t.push('poison-immune');if(m.coldImmune)t.push('cold-immune');if(m.slow)t.push('slow');
  if(m.frozen)t.push(`frozen ${m.frozen}t`);if(m.stuck)t.push('stuck in mud');if(m.panic)t.push('panicking');if(m.fleeing)t.push('fleeing');if(m.carry)t.push(`carrying your ${itemName(m.carry)}`);
  return t}
function awareness(m){const f=m.face?ARROWS[m.face.join(',')]:'?';
  return m.alert>0?`<span style="color:#ff6a5a">ALERTED — hunting you</span> · facing ${f}`:m.search>0?`<span style="color:#ffe24a">searching the area</span> · facing ${f}`:m.sus>0?`<span style="color:#ffe24a">suspicious — investigating a noise</span> · facing ${f}`:`<span style="color:#9be070">unaware</span> · facing ${f}`}
function lookTargets(){const p=G.player,out=[];
  G.ents.filter(m=>G.vis[idx(m.x,m.y)]).sort((a,b)=>cheb(a.x,a.y,p.x,p.y)-cheb(b.x,b.y,p.x,p.y)).forEach(m=>out.push([m.x,m.y]));
  if(G.npc&&G.vis[idx(G.npc.x,G.npc.y)])out.push([G.npc.x,G.npc.y]);
  G.floorItems.filter(f=>G.vis[idx(f.x,f.y)]).sort((a,b)=>cheb(a.x,a.y,p.x,p.y)-cheb(b.x,b.y,p.x,p.y)).forEach(f=>{if(!out.some(o=>o[0]===f.x&&o[1]===f.y))out.push([f.x,f.y])});
  return out}
function enterLook(){setFace(false);lookMode=true;lookIdx=0;const t=lookTargets();lookCur=t.length?{x:t[0][0],y:t[0][1]}:{x:G.player.x,y:G.player.y};
  if(!t.length)say('Nothing of note in sight. Move the cursor or tap a tile.','dim');setActs();updateLook()}
function exitLook(){if(!lookMode)return;lookMode=false;lookCur=null;$('#lookCard').hidden=true;setActs()}
function lookNext(){const t=lookTargets();if(!t.length)return;lookIdx=(lookIdx+1)%t.length;lookCur={x:t[lookIdx][0],y:t[lookIdx][1]}}
function faceLookTarget(){
  const p=G.player,dx=lookCur.x-p.x,dy=lookCur.y-p.y;
  if(!dx&&!dy){say('That is you.','dim');return}
  const k=((Math.round(Math.atan2(dy,dx)/(Math.PI/4))%8)+8)%8,dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  p.face=dirs[k];
  const i=idx(lookCur.x,lookCur.y),m=G.vis[i]?entAt(lookCur.x,lookCur.y):null,f=G.vis[i]?G.floorItems.find(f=>f.x===lookCur.x&&f.y===lookCur.y):null;
  const what=m?`the ${m.name}`:G.npc&&G.npc.x===lookCur.x&&G.npc.y===lookCur.y?'the blacksmith':f?`the ${itemName(f.it)}`:'that spot';
  const straight=dx===0||dy===0||Math.abs(dx)===Math.abs(dy);
  let clear=straight;if(straight){const {path}=rayPath(Math.max(Math.abs(dx),Math.abs(dy)),false);clear=path.some(([x,y])=>x===lookCur.x&&y===lookCur.y)}
  say(`You turn ${ARROWS[p.face.join(',')]} to face ${what}.`+(!straight?' Not in a straight line — zaps and throws will miss.':!clear?' Something blocks the line of fire.':''),straight&&clear?'':'warn');
  exitLook();updateHUD();
  G.aimPreview=true;clearTimeout(G.aimT);G.aimT=setTimeout(()=>{if(!modalOpen())G.aimPreview=false},1500);
}
function dirInput(dx,dy){
  if(!lookMode&&paralyzed())return;
  if(lookMode){if(!dx&&!dy)lookNext();else lookCur={x:clamp(lookCur.x+dx,0,W-1),y:clamp(lookCur.y+dy,0,H-1)};updateLook();return}
  stopExplore();playerMove(dx,dy)}
function updateLook(){
  if(!lookMode||!lookCur)return;const {x,y}=lookCur,i=idx(x,y),p=G.player,card=$('#lookCard');card.hidden=false;
  const head=(ch,col,txt)=>`<div class="lh"><span style="color:${col}">${ch}</span> ${txt}</div>`;
  if(!G.seen[i]){card.innerHTML=head('?','#6b7787','Unexplored')+`<div class="dim">You haven't seen this place yet.</div>`;return}
  const t=G.tile[i];let h='';
  if(!G.vis[i]){card.innerHTML=head('·','#6b7787',`Remembered ${TNAME[t]}`)+`<div class="dim">${TDESC[t]} Out of sight — anything here may have changed.</div>`;return}
  const m=entAt(x,y);
  if(p.x===x&&p.y===y)h+=head('@','#fff',`You — HP ${p.hp}/${p.maxhp} · ATK ${atkOf(p)} · DEF ${p.def}`)+`<div>Wielding ${p.weapon?itemName(p.weapon):'nothing'}. ${p.stuck?'Stuck in mud. ':''}</div>`;
  if(m&&m.silhouette)h+=`<div class="dim">A shape in the dark — it's standing in shadow.</div>`;
  if(m){const d=MON[m.kind];h+=head(m.ch,m.frozen?'#9fe8ff':m.color,`${m.name[0].toUpperCase()+m.name.slice(1)} — HP ${m.hp}/${m.maxhp} · ATK ${m.atk} · DEF ${m.def}`)+`<div>${d.desc||''}</div>`;
    const tr=traits(m);h+=`<div>${awareness(m)}</div>`;if(tr.length)h+=`<div class="dim">${tr.join(' · ')}</div>`;
    if(!m.alert){const behind=facingDot(m,p.x,p.y)<-0.35;h+=`<div class="dim">${behind?'You are behind it — a strike now is a ×3 critical.':'Strike while it is unaware for ×2; from behind for ×3.'}</div>`}}
  if(G.npc&&G.npc.x===x&&G.npc.y===y)h+=head('&','#ffb050','Blacksmith')+`<div>Smelts ore into bars, trades bars for powerful gear, hones weapons and stamps seals. Walk into them to trade.</div>`;
  const its=G.floorItems.filter(f=>f.x===x&&f.y===y);
  for(const f of its.slice(0,2)){const d=ITEMS[f.it.kind];h+=head(d.ch,d.color,itemName(f.it))+`<div>${d.desc}${isBag(f.it)&&f.it.items.length?' Inside: '+f.it.items.map(itemName).join(', ')+'.':''}</div>`}
  if(its.length>2)h+=`<div class="dim">…and ${its.length-2} more item${its.length>3?'s':''}.</div>`;
  const env=[`${Math.round(G.heat[i]*100)}°`,`light ${Math.round(Math.min(1,G.env?G.env[i]:0)*100)}%`];if(G.gas[i]>0.05)env.push(`smoke ${Math.round(G.gas[i]*100)}%`);if(G.pois[i]>0.05)env.push(`<span style="color:#c8f040">poison ${Math.round(G.pois[i]*100)}%</span>`);
  if(G.elec[i])env.push('<span style="color:#ffe24a">electrified</span>');if(G.stored[i])env.push('<span style="color:#ff8a3d">fire trapped inside</span>');if(G.prints[i])env.push('fresh footprints');if(t===T_PIT)env.push(`<span style="color:#c08a50">${G.fuel[i]} turns of fuel, unlit</span>`);if(t===T_CAMP)env.push(`<span style="color:#ffb050">${G.fuel[i]} turns of fuel</span>`);if(inStorm(x,y))env.push('<span style="color:#8fb0ff">in the storm</span>');
  if(G.flies.some(f=>f.x===x&&f.y===y))env.push('fireflies');
  h+=`<div class="dim" style="margin-top:4px">Ground: <b style="color:#cfd6e0">${TNAME[t]}</b> · ${env.join(' · ')} — ${TDESC[t]}</div>`;
  card.innerHTML=h;
}

// ---------------- AUTO-EXPLORE ----------------
let exploring=false,expTimer=null,expHp=0,expStall=0;
function expCost(i){const t=G.tile[i];if(t===T_WALL||t===T_CAMP||t===T_TREE||t===T_PIT||!G.seen[i])return -1;
  if(t===T_FIRE||(G.elec[i]&&(t===T_WATER||t===T_GRATE))||G.pois[i]>0.2||(t===T_GRATE&&G.heat[i]>0.55)||G.heat[i]>0.8)return -1;
  return t===T_MUD?4:(t===T_VINE||t===T_VINE_ICE)?3:t===T_SLICK?8:1}
function pathField(){
  const N=W*H,dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),p=G.player,s=idx(p.x,p.y);dist[s]=0;
  const hp=[[0,s]];
  const push=v=>{hp.push(v);let k=hp.length-1;while(k>0){const q=(k-1)>>1;if(hp[q][0]<=hp[k][0])break;[hp[q],hp[k]]=[hp[k],hp[q]];k=q}};
  const pop=()=>{const top=hp[0],last=hp.pop();if(hp.length){hp[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<hp.length&&hp[l][0]<hp[m][0])m=l;if(r<hp.length&&hp[r][0]<hp[m][0])m=r;if(m===k)break;[hp[m],hp[k]]=[hp[k],hp[m]];k=m}}return top};
  while(hp.length){const [d,i]=pop();if(d>dist[i])continue;const x=i%W,y=(i/W)|0;
    for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(!inb(nx,ny)||!canDiag(x,y,dx,dy))continue;const j=idx(nx,ny),c=expCost(j);if(c<0)continue;
      if(entAt(nx,ny)||(G.npc&&G.npc.x===nx&&G.npc.y===ny))continue;
      const nd=d+c+(dx&&dy?0.01:0);if(nd<dist[j]){dist[j]=nd;prev[j]=i;push([nd,j])}}}
  return {dist,prev,s};
}
function frontier(i){const x=i%W,y=(i/W)|0;for(const [dx,dy] of DIRS8){const nx=x+dx,ny=y+dy;if(inb(nx,ny)&&!G.seen[idx(nx,ny)])return true}return false}
function startExplore(){
  if(G.sandbox){say('Everything in the sandbox is already visible.','dim');return}
  if(G.over)return;
  const mon=G.ents.find(threat);if(mon){say(`Not with a ${mon.name} in sight.`,'warn');return}
  if(G.expDepth!==G.depth){G.expDepth=G.depth;G.expIgnore=new Set();G.expDone=new Set()}
  exploring=true;expHp=G.player.hp;expStall=0;setActs();
  expTimer=setInterval(exploreTick,85);
}
function stopExplore(msg,cls='dim'){if(!exploring)return;exploring=false;clearInterval(expTimer);expTimer=null;if(msg)say(msg,cls);setActs()}
function exploreTick(){
  if(!exploring)return;
  if(modalOpen()||G.over||G.sandbox)return stopExplore();
  const p=G.player,here=idx(p.x,p.y);
  const mon=G.ents.find(threat);if(mon)return stopExplore(`You spot a ${mon.name}. Exploration stopped.`,'warn');
  if(p.hp<expHp)return stopExplore('You took damage — exploration stopped.','bad');
  if(p.full<=0)return stopExplore('You are starving! Eat something.','bad');
  expHp=p.hp;
  if(p.stuck>0){playerMove(p.face[0]||1,p.face[1]);return}
  for(const f of G.floorItems)if(f.x===p.x&&f.y===p.y)G.expIgnore.add(here);
  const {dist,prev,s}=pathField();
  let best=-1,bd=Infinity,why='';
  for(const f of G.floorItems){const i=idx(f.x,f.y);if(!G.seen[i]||G.expIgnore.has(i)||dist[i]>=bd||i===s)continue;if(p.inv.length>=12&&f.it.kind!=='gold')continue;best=i;bd=dist[i];why='item'}
  if(best<0){if(frontier(s))G.expDone.add(s);
    for(let i=0;i<W*H;i++){if(dist[i]>=bd||i===s||G.expDone.has(i)||G.tile[i]===T_WALL)continue;if(frontier(i)){best=i;bd=dist[i];why='frontier'}}}
  if(best<0){let st=-1;for(let i=0;i<W*H;i++)if(G.tile[i]===T_STAIRS&&G.seen[i]&&dist[i]<Infinity){st=i;break}
    if(G.tile[here]===T_STAIRS||st<0)return stopExplore(st<0&&G.tile[here]!==T_STAIRS?'Nothing left to explore that can be reached safely.':'Floor explored. You are standing on the stairs.','good');
    best=st;why='stairs'}
  let j=best;while(prev[j]!==s&&prev[j]>=0)j=prev[j];
  if(prev[j]<0&&j!==best)return stopExplore('No safe path. Exploration stopped.','warn');
  const dx=(j%W)-p.x,dy=((j/W)|0)-p.y,ox=p.x,oy=p.y,ot=G.tile[j];
  playerMove(dx,dy);
  if(why==='frontier'&&p.x===(best%W)&&p.y===((best/W)|0)&&frontier(best))G.expDone.add(best);
  if(p.x===ox&&p.y===oy&&G.tile[j]===ot){if(++expStall>3)return stopExplore('Exploration is stuck.','warn')}else expStall=0;
}

// ---------------- SAVE / LOAD ----------------
const SAVE_VERSION=1,SAVE_PREFIX='glyphwander-save-',SLOTS=['auto','1','2','3'];
const LAYERS=['tile','fuel','gas','pois','heat','elec','src','stored','prints','seen','roomIdx','ore'];
const TA={Uint8Array,Int8Array,Int16Array,Float32Array};
const SKIP=new Set(['rng','fx','vis','light','cone','env','expIgnore','expDone','paraT','aimT','aimPreview','flashT',...LAYERS]);
function b64(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)}
function unb64(str){const b=atob(str),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function serialize(){
  const g={};for(const k in G)if(!SKIP.has(k)&&typeof G[k]!=='function')g[k]=G[k];
  g.player=Object.assign({},G.player);delete g.player.weapon;g.weaponIdx=G.player.weapon?G.player.inv.indexOf(G.player.weapon):-1;
  const layers={};for(const k of LAYERS){const a=G[k];layers[k]=[a.constructor.name,b64(new Uint8Array(a.buffer,a.byteOffset,a.byteLength))]}
  return JSON.stringify({v:SAVE_VERSION,when:Date.now(),P:Object.assign({},P),rng:G.rng.get(),g,layers});
}
function deserialize(str){
  const o=JSON.parse(str);if(!o||o.v!==SAVE_VERSION||!o.g||!o.layers)throw new Error('not a Glyphwander save');
  stopExplore();exitLook();setFace(false);if(SB){stopRun();SB=null}
  Object.assign(P,o.P);
  const g=Object.assign({},o.g),wi=g.weaponIdx;delete g.weaponIdx;
  for(const k of LAYERS){const [t,d]=o.layers[k];const u=unb64(d);g[k]=new TA[t](u.buffer)}
  const N=W*H;g.vis=new Uint8Array(N);g.light=new Float32Array(N);g.fx=[];g.expIgnore=new Set();g.expDone=new Set();g.expDepth=-1;
  g.rng=mulberry32(0);g.rng.set(o.rng);
  g.player.weapon=wi>=0?g.player.inv[wi]:null;
  G=g;camX=G.player.x;camY=G.player.y;closeModal();setActs();resize();computeView();updateHUD();renderLog();
}
function store(){try{const k='__gw_test';localStorage.setItem(k,'1');localStorage.removeItem(k);return localStorage}catch(e){return null}}
function slotData(k){const ls=store();if(!ls)return null;try{const s=ls.getItem(SAVE_PREFIX+k);return s?JSON.parse(s):null}catch(e){return null}}
function canSave(){if(SB){say('Exit the sandbox to save your run.','dim');return false}if(G.over){say('This run is over — nothing to save.','dim');return false}return true}
function saveTo(k,quiet){const ls=store();if(!ls){if(!quiet)say('Browser storage is unavailable here — use EXPORT CODE instead.','warn');return false}
  try{ls.setItem(SAVE_PREFIX+k,serialize());if(!quiet)say(`Saved to ${k==='auto'?'the autosave':'slot '+k}.`,'good');return true}catch(e){if(!quiet)say('Could not save: '+e.message,'bad');return false}}
function autosave(){if(!G||G.sandbox||G.over)return;saveTo('auto',true)}
function loadFrom(k){const ls=store();const s=ls&&ls.getItem(SAVE_PREFIX+k);if(!s){say('That slot is empty.','dim');return}
  try{deserialize(s);say(`Loaded ${k==='auto'?'the autosave':'slot '+k}: B${G.depth}F, turn ${G.turn}.`,'good')}catch(e){say('That save could not be loaded: '+e.message,'bad')}}
function toCode(){return 'GW1:'+b64(new TextEncoder().encode(serialize()))}
function fromCode(code){code=code.trim();if(!code.startsWith('GW1:'))throw new Error('codes start with GW1:');deserialize(new TextDecoder().decode(unb64(code.slice(4))))}
let saveSel=1;
function openSaves(){
  const ls=store();saveSel=clamp(saveSel,0,SLOTS.length-1);const k=SLOTS[saveSel],d=slotData(k);
  const label=s=>s==='auto'?'Autosave':'Slot '+s;
  const info=o=>o?`B${o.g.depth}F · Lv${o.g.player.lv} · turn ${o.g.turn} · seed ${o.P.seed} · ${new Date(o.when).toLocaleString()}`:'<span class="dim">empty</span>';
  openModal(`<h3>SAVE / LOAD</h3>${ls?'':'<div class="desc" style="color:#f0c060">Browser storage is blocked in this view. Save slots won\'t work here, but EXPORT and IMPORT codes do.</div>'}`+
    SLOTS.map((s,i)=>`<div class="row selrow ${i===saveSel?'sel':''}" tabindex="-1" data-op="r${i}"><span class="g" style="color:${s==='auto'?'#9be070':'#ff8a3d'}">${s==='auto'?'↻':s}</span><span><b>${label(s)}</b><br><span style="font-size:11px">${info(slotData(s))}</span></span></div>`).join('')+
    `<div class="desc">${k==='auto'?'The autosave is written each time you reach a new floor.':'Saves are kept in this browser. Use a code to move a run between devices.'}</div>
    <div class="btns"><button data-op="save" ${k==='auto'||!ls||SB||G.over?'disabled':''}>SAVE HERE</button><button data-op="load" ${d?'':'disabled'}>LOAD</button><button data-op="del" ${d?'':'disabled'}>DELETE</button>
    <button data-op="export" ${SB||G.over?'disabled':''}>EXPORT CODE</button><button data-op="import">IMPORT CODE</button><button data-op="close">CLOSE</button></div>`);
  const map={close:closeModal,
    save:()=>{if(!canSave())return openSaves();if(d)return choose(`OVERWRITE ${label(k).toUpperCase()}?`,[{label:`Yes — replace B${d.g.depth}F turn ${d.g.turn}`,ch:'!',color:'#ff8a3d',fn:()=>{saveTo(k);openSaves()}}],openSaves);saveTo(k);openSaves()},
    load:()=>choose(`LOAD ${label(k).toUpperCase()}?`,[{label:'Yes — your current run will be replaced',ch:'↻',color:'#9be070',fn:()=>loadFrom(k)}],openSaves),
    del:()=>choose(`DELETE ${label(k).toUpperCase()}?`,[{label:'Yes — delete it',ch:'×',color:'#ff6a5a',fn:()=>{try{store().removeItem(SAVE_PREFIX+k)}catch(e){}say('Save deleted.','dim');openSaves()}}],openSaves),
    export:openExport,import:openImport};
  SLOTS.forEach((s,i)=>map['r'+i]=()=>{saveSel=i;openSaves()});
  bindOps(map);
}
function openExport(){if(!canSave())return;const code=toCode();
  openModal(`<h3>EXPORT CODE</h3><div class="desc">Copy this code to keep your run or move it to another device. Paste it into IMPORT CODE to continue.</div><textarea id="codeOut" readonly rows="6" style="width:100%;box-sizing:border-box;font:11px monospace;background:#0d1219;color:#cfd6e0;border:1px solid #243041;border-radius:6px">${code}</textarea><div class="note">${Math.round(code.length/1024)} KB · B${G.depth}F · turn ${G.turn}</div><div class="btns"><button data-op="copy">COPY</button><button data-op="back">BACK</button></div>`);
  bindOps({back:openSaves,copy:()=>{const t=$('#codeOut');t.select();(navigator.clipboard?navigator.clipboard.writeText(code):Promise.reject()).then(()=>say('Save code copied.','good'),()=>{try{document.execCommand('copy');say('Save code copied.','good')}catch(e){say('Select the code and copy it by hand.','dim')}})}})}
function openImport(){
  openModal(`<h3>IMPORT CODE</h3><div class="desc">Paste a code that starts with GW1: and load it. Your current run will be replaced.</div><textarea id="codeIn" rows="6" style="width:100%;box-sizing:border-box;font:11px monospace;background:#0d1219;color:#cfd6e0;border:1px solid #243041;border-radius:6px" placeholder="GW1:…"></textarea><div class="btns"><button data-op="go">LOAD CODE</button><button data-op="back">BACK</button></div>`);
  bindOps({back:openSaves,go:()=>{try{fromCode($('#codeIn').value);say(`Code loaded: B${G.depth}F, turn ${G.turn}.`,'good')}catch(e){say('That code could not be loaded: '+e.message,'bad')}}})}

// ---------------- CONSOLE (~) ----------------
let conOpen=false;const conHist=[];let conHi=0;
const esc=t=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function conPrint(t,cls=''){const o=$('#conOut');o.insertAdjacentHTML('beforeend',`<div class="${cls}">${esc(t)}</div>`);while(o.children.length>60)o.firstChild.remove();o.scrollTop=1e9}
function openConsole(){if(!G)return;stopExplore();conOpen=true;$('#console').hidden=false;const i=$('#conIn');i.value='';
  if(!$('#conOut').children.length)conPrint('Console — type help. Enter runs, ↑↓ history, Tab completes, ~ or Esc closes.','dim');setTimeout(()=>i.focus(),0)}
function closeConsole(){conOpen=false;$('#console').hidden=true;$('#conIn').blur()}
// names you can type: monsters, items and weapon types, by key or display name
const conMonsters=()=>Object.assign(Object.fromEntries(Object.entries(MON).map(([k,d])=>[k,d.name])),{blacksmith:'blacksmith'});
const conItems=()=>Object.assign(Object.fromEntries(Object.entries(ITEMS).filter(([k])=>k!=='weapon').map(([k,d])=>[k,d.name])),Object.fromEntries(Object.entries(WEAPONS).map(([k,w])=>['w:'+k,w.name])));
function resolveName(q,pool){const norm=t=>t.toLowerCase().replace(/^w:/,'').replace(/[^a-z0-9]/g,'');q=norm(q);if(!q)return null;
  const e=Object.entries(pool).map(([k,n])=>[k,norm(k),norm(n)]);
  for(const f of [x=>x[1]===q||x[2]===q,x=>x[1].startsWith(q)||x[2].startsWith(q),x=>x[1].includes(q)||x[2].includes(q)]){const m=e.filter(f);if(m.length===1)return m[0][0];if(m.length>1)return m.map(x=>x[0])}
  return null}
function spawnSpot(){const p=G.player,[fx,fy]=p.face;let best=null,bs=1e9;
  for(let r=1;r<=7;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=p.x+dx,y=p.y+dy;if(!walkable(x,y)||occupant(x,y))continue;
    const sc=r-0.4*(dx*fx+dy*fy)/Math.hypot(dx,dy);if(sc<bs){bs=sc;best=[x,y]}}
  return best}
// parse "katana +3 fire ice 2" → {name, count, plus, seals}
function conArgs(toks){const o={words:[],count:1,plus:0,seals:[]};for(const t of toks){if(/^\+\d+$/.test(t))o.plus=+t;else if(/^\d+$/.test(t))o.count=Math.min(99,+t);
  else{const sk=Object.keys(SEALS).find(k=>k===t.toLowerCase()||SEALS[k].name===t.toLowerCase());if(sk&&o.words.length)o.seals.push(sk);else o.words.push(t)}}return o}
function conMakeItems(key,a){const out=[];
  if(key.startsWith('w:')){for(let k=0;k<a.count;k++)out.push(mkWeapon(key.slice(2),a.plus,a.seals));return out}
  if(STACK[key]){let left=a.count;while(left>0){const it=mkItem(key);it.n=Math.min(STACK[key],left);left-=it.n;out.push(it)}return out}
  for(let k=0;k<a.count;k++){const it=mkItem(key);if(key==='gold')it.amt=100;out.push(it)}return out}
const CMDS={
  help:()=>['spawn <monster|item> [count] — place near you (e.g. spawn goblin 3, spawn katana +2 fire, spawn lumber 20)',
    'give <item> [count] — straight into your pack (overflow drops at your feet)',
    'gold <n> · heal · god (toggle no damage) · reveal · floor <n> · kill (everything in view)',
    'list monsters | items | weapons · clear · help'].forEach(l=>conPrint(l)),
  list:a=>{const w=(a[0]||'').toLowerCase();if(w.startsWith('m'))conPrint(Object.keys(conMonsters()).join(', '));else if(w.startsWith('w'))conPrint(Object.keys(WEAPONS).join(', ')+'  (seals: '+Object.values(SEALS).map(s=>s.name).join(', ')+')');else conPrint(Object.keys(ITEMS).filter(k=>k!=='weapon').join(', '))},
  clear:()=>{$('#conOut').innerHTML=''},
  spawn:(a,give)=>{const p=conArgs(a);if(!p.words.length)return conPrint('spawn what? try: list monsters','bad');const q=p.words.join(' ');
    const mon=resolveName(q,conMonsters()),it=resolveName(q,conItems());
    const pick=[mon,it].filter(x=>typeof x==='string');
    if(!give&&typeof mon==='string'&&!(typeof it==='string'&&it.replace(/^w:/,'')===q.toLowerCase())){let n=0;
      for(let k=0;k<p.count;k++){const sp=spawnSpot();if(!sp)break;if(mon==='blacksmith'){G.npc={x:sp[0],y:sp[1],ch:'&',name:'blacksmith',npc:true};n=1;break}
        const m=mkMonster(mon,sp[0],sp[1]);m.face=[sgn(G.player.x-sp[0]),sgn(G.player.y-sp[1])];G.ents.push(m);n++}
      G.cheated=true;conPrint(`spawned ${n} ${mon==='blacksmith'?'blacksmith':MON[mon].name}${n>1?'s':''}`,'good');return}
    if(typeof it==='string'){const items=conMakeItems(it,p);let put=0;
      for(const x of items){if(give&&addToPack(x)){put++;continue}const sp=give?[G.player.x,G.player.y]:(spawnSpot()||[G.player.x,G.player.y]);placeFloor(sp[0],sp[1],x)}
      G.cheated=true;const name=it.startsWith('w:')?itemName(items[0]):ITEMS[it].name;conPrint(give?`gave ${p.count} × ${name}${put<items.length?' (pack full — the rest is at your feet)':''}`:`spawned ${p.count} × ${name}`,'good');return}
    const amb=[mon,it].filter(Array.isArray).flat();
    conPrint(amb.length?`"${q}" could be: ${amb.slice(0,12).join(', ')}`:`nothing called "${q}" — try list monsters / list items`,'bad')},
  give:a=>CMDS.spawn(a,true),
  gold:a=>{const n=parseInt(a[0]||'100',10)||0;G.player.gold+=n;G.cheated=true;conPrint(`+${n} gold (now ${G.player.gold})`,'good')},
  heal:()=>{const p=G.player;p.hp=p.maxhp;p.full=100;p.para=0;p.stuck=0;G.cheated=true;conPrint('healed and fed','good')},
  god:()=>{G.god=!G.god;G.cheated=true;conPrint(`god mode ${G.god?'ON — you take no damage':'off'}`,'good')},
  reveal:()=>{G.lit=true;G.cheated=true;conPrint('floor revealed','good')},
  floor:a=>{const n=clamp(parseInt(a[0],10)||G.depth+1,1,FINAL_FLOOR);if(G.sandbox)return conPrint('not in the sandbox','bad');G.depth=n-1;G.cheated=true;nextFloor();conPrint(`now on B${G.depth}F`,'good')},
  kill:()=>{const before=G.ents.length;G.ents=G.ents.filter(m=>!G.vis[idx(m.x,m.y)]);G.cheated=true;conPrint(`removed ${before-G.ents.length} monster${before-G.ents.length===1?'':'s'}`,'good')},
};
function runConsole(line){line=line.trim();if(!line)return;conHist.push(line);conHi=conHist.length;conPrint('> '+line,'cmd');
  const [c,...a]=line.split(/\s+/),cmd=CMDS[c.toLowerCase()]||CMDS[Object.keys(CMDS).find(k=>k.startsWith(c.toLowerCase()))||''];
  if(!cmd){conPrint(`unknown command "${c}" — type help`,'bad');return}
  try{cmd(a)}catch(err){conPrint('error: '+err.message,'bad')}
  computeView();updateHUD();
}
function conComplete(inp){const v=inp.value,parts=v.split(/\s+/),last=parts[parts.length-1].toLowerCase();
  const pool=parts.length===1?Object.keys(CMDS):['spawn','give'].includes(parts[0].toLowerCase())?[...Object.keys(conMonsters()),...Object.keys(ITEMS).filter(k=>k!=='weapon'),...Object.keys(WEAPONS)]:parts[0].toLowerCase()==='list'?['monsters','items','weapons']:[];
  const m=pool.filter(k=>k.toLowerCase().startsWith(last));if(!m.length)return;
  let pre=m[0];for(const x of m)while(!x.toLowerCase().startsWith(pre.toLowerCase()))pre=pre.slice(0,-1);
  parts[parts.length-1]=m.length===1?m[0]+' ':pre;inp.value=parts.join(' ');if(m.length>1)conPrint(m.slice(0,24).join('  '),'dim')}
function conKey(e){const inp=$('#conIn'),k=e.key;
  if(k==='Escape'||e.code==='Backquote'){e.preventDefault();closeConsole();return}
  if(k==='Enter'){e.preventDefault();runConsole(inp.value);inp.value='';return}
  if(k==='ArrowUp'){e.preventDefault();if(conHi>0){conHi--;inp.value=conHist[conHi]}return}
  if(k==='ArrowDown'){e.preventDefault();if(conHi<conHist.length-1){conHi++;inp.value=conHist[conHi]}else{conHi=conHist.length;inp.value=''}return}
  if(k==='Tab'){e.preventDefault();conComplete(inp);return}
  if(document.activeElement!==inp)inp.focus();
}

// ---------------- KEYBOARD: every menu works from the keyboard ----------------
let kbMode=false;const kb={screen:'',btn:0,gi:0};
window.addEventListener('pointerdown',()=>{kbMode=false;document.querySelectorAll('.kbf').forEach(e=>e.classList.remove('kbf'))},true);
function kbScreen(){const h=$('#sheet h3');return h?h.textContent.split(/[ ·0-9]/)[0]:''}
function kbFocusables(){return [...$('#sheet').querySelectorAll('button:not(:disabled), select, input, textarea, .row')]}
function kbAfterRender(){
  if($('#modal').hidden)return;const sc=kbScreen();if(sc!==kb.screen){kb.screen=sc;kb.btn=0;kb.gi=0}
  if(!kbMode)return;
  const sheet=$('#sheet');
  if(sheet.querySelector('.selrow')||sheet.querySelector('.aimgrid')){markKb();return}
  const f=kbFocusables();if(f.length){const el=f[clamp(kb.gi,0,f.length-1)];el.focus({preventScroll:false});el.scrollIntoView({block:'nearest'})}
}
function kbButtons(){return [...$('#sheet').querySelectorAll('.btns button:not(:disabled)')]}
function markKb(){document.querySelectorAll('.kbf').forEach(e=>e.classList.remove('kbf'));if(!kbMode)return;const b=kbButtons();if(!b.length)return;kb.btn=clamp(kb.btn,0,b.length-1);b[kb.btn].classList.add('kbf');
  const sel=$('#sheet .row.sel');if(sel)sel.scrollIntoView({block:'nearest'})}
function keyDir(e){const key=e.key.length===1?e.key.toLowerCase():e.key;return KEYS[key]||KEYS[e.code&&e.code.startsWith('Numpad')?e.code.slice(6):'']}
function modalKey(e){
  const sheet=$('#sheet'),k=e.key,ae=document.activeElement,typing=ae&&((ae.tagName==='INPUT'&&ae.type!=='range')||ae.tagName==='TEXTAREA');
  if(k==='Escape'){e.preventDefault();if(G.over)return;const b=sheet.querySelector('[data-op="back"]')||sheet.querySelector('#pc')||sheet.querySelector('[data-op="close"]');if(b)b.click();else closeModal();return}
  // aim screen: direction keys turn you, Enter throws, 1-9 picks a target
  if(sheet.querySelector('.aimgrid')){
    if(/^[a-z]$/i.test(k)&&!e.ctrlKey&&!e.metaKey){const hk=sheet.querySelector(`[data-key="${k.toLowerCase()}"]:not(:disabled)`);if(hk){e.preventDefault();hk.click()}return}
    // Shift+←/→ (and Shift+numpad 4/6) set the throw distance. With NumLock on, Shift+numpad 4/6 arrives as an arrow key,
    // sometimes without shiftKey, so a numpad arrow while NumLock is on counts as shifted too.
    const numLR=e.code==='Numpad4'||e.code==='Numpad6',numLock=e.getModifierState&&e.getModifierState('NumLock');
    if(sheet.querySelector('[data-op="dm"]')&&(((k==='ArrowLeft'||k==='ArrowRight')&&(e.shiftKey||(numLR&&numLock)))||(numLR&&e.shiftKey))){
      e.preventDefault();const less=k==='ArrowLeft'||e.code==='Numpad4';const b=sheet.querySelector(`[data-op="${less?'dm':'dp'}"]:not(:disabled)`);if(b)b.click();return}
    if(k==='-'||k==='_'){e.preventDefault();const b=sheet.querySelector('[data-op="dm"]:not(:disabled)');if(b)b.click();return}
    if(k==='+'||k==='='){e.preventDefault();const b=sheet.querySelector('[data-op="dp"]:not(:disabled)');if(b)b.click();return}
    if(/^[1-9]$/.test(k)&&!e.code.startsWith('Numpad')){const q=sheet.querySelector(`[data-op="q${+k-1}"]`);if(q){e.preventDefault();q.click()}return}
    const d=keyDir(e);if(d&&(d[0]||d[1])){e.preventDefault();const b=sheet.querySelector(`[data-op="d${(d[1]+1)*3+d[0]+1}"]`);if(b)b.click();return}
    if(k==='Enter'||(d&&!d[0]&&!d[1])){e.preventDefault();sheet.querySelector('[data-op="fire"]').click()}return}
  // Tab toggles the pack: in the pack or a bag view it closes it
  if(k==='Tab'&&!e.shiftKey&&!typing&&(sheet.querySelector('.selrow')&&/^PACK/.test(kbScreen())||invBag)){e.preventDefault();invBag=null;closeModal();return}
  // letter hotkeys on buttons
  if(k.length===1&&!typing&&!e.ctrlKey&&!e.metaKey){const hk=sheet.querySelector(`[data-key="${k.toLowerCase()}"]:not(:disabled)`);if(hk){e.preventDefault();hk.click();return}}
  // lists with a selection (pack, bags): up/down select, left/right pick a button, Enter does it
  const rows=[...sheet.querySelectorAll('.selrow')];
  if(rows.length){
    const cur=Math.max(0,rows.findIndex(r=>r.classList.contains('sel')));
    if(k==='ArrowUp'||k==='ArrowDown'||k==='8'||k==='2'){e.preventDefault();const up=k==='ArrowUp'||k==='8';rows[(cur+(up?-1:1)+rows.length)%rows.length].click();return}
    const b=kbButtons();
    if(k==='ArrowLeft'||k==='ArrowRight'||k==='4'||k==='6'||k==='Tab'){e.preventDefault();const back=k==='ArrowLeft'||k==='4'||(k==='Tab'&&e.shiftKey);kb.btn=(kb.btn+(back?-1:1)+b.length)%b.length;markKb();return}
    if(k==='Enter'||k===' '){e.preventDefault();if(b.length)b[clamp(kb.btn,0,b.length-1)].click()}return}
  // everything else: a vertical list of controls
  const f=kbFocusables();if(!f.length)return;let i=f.indexOf(ae);
  if(ae&&ae.type==='range'&&(k==='ArrowLeft'||k==='ArrowRight'))return;      // the slider moves natively
  if(ae&&ae.tagName==='SELECT'&&(k==='ArrowLeft'||k==='ArrowRight')){e.preventDefault();ae.selectedIndex=(ae.selectedIndex+(k==='ArrowRight'?1:-1)+ae.options.length)%ae.options.length;ae.dispatchEvent(new Event('input'));return}
  if(typing&&!['ArrowUp','ArrowDown','Enter','Tab'].includes(k))return;
  if(ae&&ae.tagName==='TEXTAREA'&&(k==='ArrowUp'||k==='ArrowDown'))return;
  const next=['ArrowDown','ArrowRight','2','6'].includes(k)||(k==='Tab'&&!e.shiftKey),prev=['ArrowUp','ArrowLeft','8','4'].includes(k)||(k==='Tab'&&e.shiftKey);
  if(next||prev){e.preventDefault();i=i<0?(next?0:f.length-1):(i+(next?1:-1)+f.length)%f.length;kb.gi=i;f[i].focus();f[i].scrollIntoView({block:'nearest'});return}
  if(k==='Enter'||k===' '){e.preventDefault();if(i<0){kb.gi=0;f[0].focus();return}if(ae.tagName==='BUTTON'||ae.classList.contains('row')){kb.gi=i;ae.click()}else if(typing&&ae.tagName!=='TEXTAREA'){const go=sheet.querySelector('#rs');if(go)go.click()}else if(ae.tagName==='TEXTAREA'&&k==='Enter'&&!e.shiftKey){const go=sheet.querySelector('[data-op="go"]');if(go){e.preventDefault();go.click()}}}
}
function openHelp(){
  const L=[['Move / attack','arrow keys · numpad (7 9 1 3 for diagonals)'],['Wait a turn','. · 5 · space'],['Turn without moving','Shift + direction, or F then a direction'],
    ['Items (pack)','Tab or I (Tab again closes) — ↑↓ select an item, then Q W E A S D… pick its options in order, X back, C close'],['Item screens','the buttons are lettered in order Q W E / A S D / R F Z V — your left hand never moves; X is BACK, C is CLOSE'],
    ['Aim a throw or zap','direction keys turn, Shift+← → (or Shift+numpad 4 / 6, or − +) set throw distance, 1–9 picks a visible enemy, Enter confirms, Esc back'],['Look','Q (or L) — move the cursor, . cycles targets, F faces the target'],
    ['Explore','O or numpad 0'],['Save / load','K — slots, autosave, export/import codes'],['Torch','W (or T)'],['Stairs','D (or > / Enter)'],['Map','M (Esc closes the big map)'],['Engine panel','P — ↑↓ move, ←→ change a slider or choice'],
    ['Sandbox','X toggle · B brush · G paint the tile you face · R run/pause · . step · , sandbox menu'],['Console','~ (backtick) — spawn monsters and items, give gear, gold, heal… type help'],['Any menu','↑↓ ←→ move · Enter select · Esc back/close']];
  openModal(`<h3>KEYBOARD</h3>`+L.map(([a,b])=>`<div class="prm" style="grid-template-columns:150px 1fr"><b style="color:#fff">${a}</b><span style="text-align:left;color:#9aa6b6">${b}</span></div>`).join('')+`<div class="btns"><button data-op="close">CLOSE</button></div>`);
  bindOps({close:closeModal})}
function paintFacing(){if(!SB)return;const p=G.player,x=p.x+p.face[0],y=p.y+p.face[1],single=/^(m:|i:|npc)/.test(SB.brush),rad=single?0:SB.size-1,st={cells:new Set()};
  for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++)if(Math.hypot(dx,dy)<=rad+0.5)applyBrush(x+dx,y+dy,st);computeView();updateHUD()}

// ---------------- controls ----------------
function setActs(){
  const a=$('#acts');
  const torchB=`<button data-a="torch" class="${G.torch===false?'':'on'}">${G.torch===false?'◌ TORCH':'◉ TORCH'}</button>`;
  const look=`<button data-a="look" class="${lookMode?'on':''}">LOOK</button>`,face=`<button data-a="face" id="faceBtn" class="${faceMode?'on':''}">FACE</button>`;
  if(SB){a.className='nine';a.innerHTML=`<button data-a="brush" style="color:${brushColor(SB.brush)}">✎ ${brushLabel(SB.brush).toUpperCase()}</button><button data-a="step">STEP</button><button data-a="run" class="${SB.running?'on':''}">${SB.running?'❚❚ PAUSE':'▶ RUN'}</button>`+
    `${face}<button data-a="items">ITEMS</button>${look}${torchB}<button data-a="menu">MENU</button>`}
  else{a.className='nine';a.innerHTML=`${face}<button data-a="items">ITEMS</button>${look}<button data-a="explore" class="${exploring?'on':''}">${exploring?'■ STOP':'EXPLORE'}</button>${torchB}<button data-a="stairs">&gt; STAIRS</button><button data-a="save">SAVE</button><button data-a="params">⚙ ENGINE</button>`}
}
function doAction(a){
  if(modalOpen())return;
  if(['items','explore','stairs','face'].includes(a)&&paralyzed())return;
  if(a!=='explore')stopExplore();
  if(lookMode&&a==='face'){faceLookTarget();return}
  if(lookMode&&a!=='look')exitLook();
  switch(a){
    case 'look':lookMode?exitLook():enterLook();break;
    case 'save':openSaves();break;
    case 'torch':G.torch=G.torch===false;say(G.torch?'You light your torch.':'You douse your torch. Stick to the shadows…',G.torch?'':'dim');computeView();updateHUD();setActs();break;
    case 'explore':exploring?stopExplore('Exploration stopped.'):startExplore();break;
    case 'face':setFace(!faceMode);break;
    case 'items':openInv();break;
    case 'stairs':descend();break;
    case 'params':openParams();break;
    case 'brush':openBrush();break;
    case 'menu':openSbMenu();break;
    case 'step':endTurn();break;
    case 'run':toggleRun();break;
  }
}
$('#acts').addEventListener('click',e=>{const b=e.target.closest('button');if(b){b.blur();doAction(b.dataset.a)}});
let rep=null;
function threat(m){const p=G.player;return G.vis[idx(m.x,m.y)]&&cheb(m.x,m.y,p.x,p.y)<=10&&los(p.x,p.y,m.x,m.y)}
function anyMonsterVisible(){return !G.sandbox&&G.ents.some(threat)}
document.querySelectorAll('#dpad button').forEach(b=>{
  const [dx,dy]=b.dataset.d.split(',').map(Number);
  const stop=()=>{clearTimeout(rep);clearInterval(rep);rep=null};
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(modalOpen())return;stop();dirInput(dx,dy);
    if(dx||dy)rep=setTimeout(()=>{rep=setInterval(()=>{if(modalOpen()||G.over||(!lookMode&&anyMonsterVisible())||faceMode){stop();return}dirInput(dx,dy)},lookMode?90:110)},320)});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
});
const KEYS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
  '8':[0,-1],'2':[0,1],'4':[-1,0],'6':[1,0],'7':[-1,-1],'9':[1,-1],'1':[-1,1],'3':[1,1],'5':[0,0],'.':[0,0],' ':[0,0]};
window.addEventListener('keydown',e=>{
  kbMode=true;
  if(conOpen){conKey(e);return}
  if((e.code==='Backquote'||e.key==='~'||e.key==='`')&&!(document.activeElement&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName))){e.preventDefault();if(modalOpen())closeModal();openConsole();return}
  if(modalOpen()){modalKey(e);return}
  if(e.key==='Escape'){setFace(false);exitLook();stopExplore();mmBig=false;return}
  if(e.target.tagName==='INPUT')return;
  if(e.key==='?'){e.preventDefault();openHelp();return}
  if(SB&&e.key==='g'){e.preventDefault();paintFacing();return}
  if(SB&&e.key===','){e.preventDefault();openSbMenu();return}
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(e.code==='Numpad0'||(e.key==='0'&&e.location===3)){e.preventDefault();if(!SB)doAction('explore');return}
  const d=KEYS[key]||KEYS[e.code&&e.code.startsWith('Numpad')?e.code.slice(6):''];
  if(d){e.preventDefault();if(e.shiftKey&&(d[0]||d[1])&&!lookMode){G.player.face=[d[0],d[1]];updateHUD();return}dirInput(d[0],d[1]);return}
  if(key==='q'||key==='l'||key==='v'){doAction('look');return}if(key==='w'){doAction('torch');return}if(key==='d'){e.preventDefault();doAction('stairs');return}if(key==='k'){doAction('save');return}if(key==='t'){doAction('torch');return}if(key==='o'&&!SB){doAction('explore');return}
  if(key==='f'){doAction('face');return}
  stopExplore();if(lookMode)exitLook();
  if(e.key==='Tab'){e.preventDefault();openInv();return}
  if(key==='m'){e.preventDefault();mmBig=!mmBig;return}
  if(key==='i'){e.preventDefault();openInv()}else if(key==='f')doAction('face');else if(key==='>'||key==='Enter'){e.preventDefault();descend()}else if(key==='p')openParams();
  else if(key==='x')SB?exitSandbox():enterSandbox();else if(key==='r'&&SB)toggleRun();else if(key==='b'&&SB)openBrush();
});
window.addEventListener('resize',resize);

newRun(P.seed);
setActs();
resize();
const start=()=>{resize();requestAnimationFrame(loop)};
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(start,start);
