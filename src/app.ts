// @ts-nocheck
/**
 * App: Oberfläche, Spielablauf und Statistik.
 *
 * Diese Datei ist 1:1 der Stand der spielbaren Vorschau (Artifact) und deshalb noch npm install --save-dev prettieruntypisiert
 * (@ts-nocheck). Die Spiellogik liegt typisiert und getestet in engine.ts. Wenn du hier etwas
 * änderst und es typisieren möchtest: @ts-nocheck entfernen und die Meldungen von `npm run check`
 * Abschnitt für Abschnitt abarbeiten.
 *
 * Abschnitte (Suche nach „// =====“):
 *   UI ............ Konstanten, Einstellungen (Namen/Farben), Geometrie des Bretts, Austeilen, Spielablauf,
 *                   Bedienung (Antippen und Werfen), Anzeige
 *   Statistik ..... Aufzeichnung und Diagramme
 *   init() ........ Start, Menü, Dialoge inkl. Einstellungen (ganz unten)
 */
import { ALLV, OPT, SIZES, aiChoose, aiGive, applyAll, applySeg, cloneMs, ctrlColor, initMarbles, legalMoves, makeDeck, sevenOptions, startOf, teamOf, teamWon } from './engine';

// ===== UI =====
const NAMES=['Du','Rot','Grün','Gelb'];
const COLNAME=['Blau','Rot','Grün','Gelb'];
const MCOL=[['#7fa6ff','#2b5fd9','#173a8f'],['#ff8c84','#d23b33','#7e1a15'],['#7fe0ad','#1e9a5a','#0d5531'],['#ffe17a','#e2a908','#8a6200']];
// ===== Einstellungen: Namen und Farben der vier Plätze (0 = du unten, 1 = Gegner rechts, 2 = Partner oben, 3 = Gegner links)
// Die Spiellogik arbeitet mit Platz-Nummern; Name und Farbe sind nur Anzeige. Gespeichert in localStorage.
const SEATS_KEY='aendi-dog-seats';
const PALETTE={ // m: Murmel (Glanz, Mitte, Schatten) · ui: Schrift/Ringe hell · dark: im Dunkelmodus
  blau:{label:'Blau',m:['#7fa6ff','#2b5fd9','#173a8f'],ui:'#2b5fd9',dark:'#5b8cff'},
  rot:{label:'Rot',m:['#ff8c84','#d23b33','#7e1a15'],ui:'#d23b33',dark:'#ff6b62'},
  gruen:{label:'Grün',m:['#7fe0ad','#1e9a5a','#0d5531'],ui:'#1e9a5a',dark:'#3fcf86'},
  gelb:{label:'Gelb',m:['#ffe17a','#e2a908','#8a6200'],ui:'#d49a00',dark:'#f2c230'},
  pink:{label:'Pink',m:['#ffa6d5','#e0408f','#83174f'],ui:'#d63384',dark:'#ff79b8'},
  lila:{label:'Lila',m:['#c9b0ff','#7b4fe0','#3c1f8a'],ui:'#7b4fe0',dark:'#a98bff'},
  orange:{label:'Orange',m:['#ffc48f','#f07a1a','#8a3a05'],ui:'#dd6a0f',dark:'#ff9a45'},
  tuerkis:{label:'Türkis',m:['#8be9e3','#17a39d','#0a5754'],ui:'#12908a',dark:'#3fd3cb'},
  schwarz:{label:'Schwarz',m:['#8a908d','#2c3330','#0b0e0d'],ui:'#2c3330',dark:'#b9c4bf'}};
const SEAT_DEF=[{name:'Du',col:'blau'},{name:'Rot',col:'rot'},{name:'Grün',col:'gruen'},{name:'Gelb',col:'gelb'}];
// Ein Name, der nur ein Farbname ist (wie die Standardnamen „Rot“, „Grün“, „Gelb“), gilt als automatisch und wechselt mit der Farbe mit
const COLOR_LABELS=new Set(Object.values(PALETTE).map(c=>c.label));
const autoName=(n,p,col)=>{n=(n||'').trim().slice(0,12);if(p===0)return n||'Du';return (!n||COLOR_LABELS.has(n))?PALETTE[col].label:n};
function loadSeats(){
  try{const s=JSON.parse(localStorage.getItem(SEATS_KEY));
    if(Array.isArray(s)&&s.length===4&&s.every(x=>x&&PALETTE[x.col]&&typeof x.name==='string')&&new Set(s.map(x=>x.col)).size===4)
      return s.map((x,p)=>({name:autoName(x.name,p,x.col),col:x.col}))}catch(e){}
  return SEAT_DEF.map(x=>({...x}));
}
let SEATS=loadSeats();
function applySeats(){
  SEATS.forEach((s,p)=>{const c=PALETTE[s.col];NAMES[p]=s.name;COLNAME[p]=c.label;MCOL[p]=c.m});
  const v=k=>SEATS.map((s,p)=>`--c${p}:${PALETTE[s.col][k]};`).join('');
  let st=document.getElementById('seatCss');
  if(!st){st=document.createElement('style');st.id='seatCss';document.head.appendChild(st)}
  st.textContent=`:root{${v('ui')}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${v('dark')}}}:root[data-theme="dark"]{${v('dark')}}`;
}
// Zusätzlich direkt am Dokument setzen: wirkt auch dort, wo das eingefügte Stylesheet nicht greift (Ringe und Namen blieben sonst in den Standardfarben)
function seatVars(){
  const r=document.documentElement,t=r.dataset.theme,dark=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
  SEATS.forEach((s,p)=>r.style.setProperty('--c'+p,PALETTE[s.col][dark?'dark':'ui']));
}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',seatVars)}catch(e){}
applySeats();seatVars();
const meName=()=>NAMES[0]==='Du'?'du':NAMES[0];
const withCol=p=>NAMES[p]+(NAMES[p]!==COLNAME[p]?` (${COLNAME[p]})`:'');
const VLABEL_FR={A:'Ass',B:'Bube',D:'Dame',K:'König',JO:'Joker'};
const VLABEL_CH={A:'Ass',B:'Under',D:'Ober',K:'König',JO:'Joker'};
const SUIT_CH={'♠':'s-sil','♥':'s-ros','♦':'s-sch','♣':'s-eic'};
const isCH=()=>!!(S&&S.deckStyle==='ch');
const VLABEL=new Proxy({},{get:(t,k)=>(isCH()?VLABEL_CH:VLABEL_FR)[k]});
const rankLabel=r=>r==='JO'?'Joker':isCH()?(r==='B'?'U':r==='D'?'O':r):(r==='B'?'J':r);
function suitHTML(c){if(c.r==='JO')return '★';if(!isCH())return c.s;return `<svg class="si" viewBox="0 0 24 24" aria-hidden="true"><use href="#${SUIT_CH[c.s]}"/></svg>`}
const SYMS=`<symbol id="s-sch" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" fill="none" stroke="#7a5200" stroke-width="1.2"/><circle cx="12" cy="13.5" r="7.5" fill="#e8b417" stroke="#7a5200" stroke-width="1.2"/><path d="M4.8 11.5h14.4" stroke="#c0392b" stroke-width="2.4"/><circle cx="12" cy="16.5" r="1.6" fill="#7a5200"/><path d="M12 17v3.5" stroke="#7a5200" stroke-width="1.3"/></symbol><symbol id="s-ros" viewBox="0 0 24 24"><g fill="#c0392b" stroke="#6e1a12" stroke-width=".8"><circle cx="12" cy="5.5" r="4"/><circle cx="18.5" cy="12" r="4"/><circle cx="12" cy="18.5" r="4"/><circle cx="5.5" cy="12" r="4"/></g><circle cx="12" cy="12" r="5" fill="#e8b417" stroke="#6e1a12" stroke-width=".8"/><circle cx="12" cy="12" r="1.7" fill="#2e7d32"/></symbol><symbol id="s-sil" viewBox="0 0 24 24"><path d="M4 3h16v8c0 5.5-3.6 8.8-8 10.5C7.6 19.8 4 16.5 4 11z" fill="#e8b417" stroke="#333" stroke-width="1.2"/><path d="M4.6 3.6h14.8v5.4H4.6z" fill="#222"/><path d="M12 9v12" stroke="#c0392b" stroke-width="3"/></symbol><symbol id="s-eic" viewBox="0 0 24 24"><path d="M12 1.5v4" stroke="#4e342e" stroke-width="1.6"/><ellipse cx="12" cy="15" rx="5.5" ry="7" fill="#e0a526" stroke="#6d4c1f" stroke-width="1"/><path d="M5.5 10.5c0-3.5 2.8-5.5 6.5-5.5s6.5 2 6.5 5.5c-2 1.2-4.2 1.6-6.5 1.6s-4.5-.4-6.5-1.6z" fill="#6d4c1f"/><path d="M8 8.2h8M6.8 9.9h10.4" stroke="#3e2723" stroke-width=".7"/></symbol>`;
// Reihenfolge der Karten in der Hand und in der Jokerauswahl wie in der Schweiz: von links nach rechts aufsteigend,
// das Ass höher als der König, der Joker ganz rechts. (ALLV bleibt wie es ist, es gehört zur Spiellogik.)
const RORDER=['2','3','4','5','6','7','8','9','10','B','D','K','A','JO'];
const SUITORD=['♠','♥','♣','♦','★'];
const handCmp=(a,b)=>RORDER.indexOf(a.r)-RORDER.indexOf(b.r)||SUITORD.indexOf(a.s)-SUITORD.indexOf(b.s)||a.id-b.id;
const SAVE_KEY='braendi-dog-v2';
const C=200,NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
// Pausierbare Timer: Solange das Menü oder ein Dialog offen ist, steht das Spiel still
// (Züge, Murmeln, fliegende Karten, Töne) und läuft danach genau dort weiter.
const TIMERS=new Set();let PAUSED=false,PAUSED_ANIMS=[];
function armTimer(t){t.t0=performance.now();t.id=setTimeout(()=>{TIMERS.delete(t);t.fn()},t.left)}
function later(fn,ms){const t={fn,left:Math.max(0,ms||0),t0:0,id:0};TIMERS.add(t);if(!PAUSED)armTimer(t);return t}
const sleep=ms=>new Promise(r=>later(r,ms));
function setPaused(on){
  if(on===PAUSED)return;PAUSED=on;
  if(on){
    const now=performance.now();for(const t of TIMERS){clearTimeout(t.id);t.left=Math.max(0,t.left-(now-t.t0))}
    // Animationen im Menü und in Dialogen selbst laufen weiter, alles andere hält an
    PAUSED_ANIMS=document.getAnimations().filter(a=>{const e=a.effect&&a.effect.target;return a.playState==='running'&&!(e&&e.closest&&e.closest('.top,dialog'))});
    for(const a of PAUSED_ANIMS)a.pause();
    if(SND.ctx&&SND.ctx.state==='running')SND.ctx.suspend();
  }else{
    for(const t of TIMERS)armTimer(t);
    for(const a of PAUSED_ANIMS)try{a.play()}catch(e){}
    PAUSED_ANIMS=[];
    if(SND.ctx&&SND.ctx.state==='suspended'&&SND.on)SND.ctx.resume();
  }
}
// Erst nach dem aktuellen Klick prüfen: Ein Menüpunkt schliesst das Menü und öffnet gleich danach einen Dialog.
const syncPause=()=>setTimeout(()=>setPaused(!$('menu').hidden||!!document.querySelector('dialog[open]')),0);
let S=null,UI=freshUI(),busy=false,TP=[];
function freshUI(k){return {card:null,val:null,cand:null,k:0,temp:null,sel:null,pend:null,applied:[],give:null,recv:k&&UI?UI.recv:null}}
function delay(){return {slow:1000,normal:450,fast:200}[S.speed]||450}
function stepMs(){return {slow:200,normal:120,fast:72}[S.speed]||120}
function rot(p,dx,dy){return p===0?[dx,dy]:p===1?[dy,-dx]:p===2?[-dx,-dy]:[-dy,dx]}
// Geometrie nach dem Originalbrett (Vorlage: oberes Viertel, Start an der Spitze)
const F=0.31;
const TT=[[350,-73],[330,-136],[378,-188],[425,-233],[472,-283],[525,-333],[482,-388],[435,-441],[382,-486],[326,-527],[277,-475],[228,-426],[182,-380],[132,-331],[65,-353],[-3,-356]];
const GT=[[338,-420],[348,-351],[297,-301],[247,-250]];
const KT=[[205,-527],[135,-527],[65,-527],[-5,-527]];
function P(p,v){const [a,b]=rot(p,-v[0]*F,-v[1]*F);return [C+a,C+b]}
function goalPt(c,i){return P(c,GT[i])}
function kennelPt(c,j){return P(c,KT[j])}
function locPt(key){if(key[0]==='T')return TP[+key.slice(1)];const [c,i]=key.slice(1).split('_').map(Number);return goalPt(c,i)}
function marblePt(ms,m){
  if(m.loc==='T')return TP[m.pos];
  if(m.loc==='G')return goalPt(m.color,m.pos);
  let j=0;for(let i=m.color*4;i<m.id;i++)if(ms[i].loc==='K')j++;
  return kennelPt(m.color,j);
}
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
const cardLabel=c=>VLABEL[c.r]||c.r;
const isRed=c=>!isCH()&&(c.s==='♥'||c.s==='♦');
const pts=a=>a.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');

function buildBoard(){
  const svg=$('board');svg.innerHTML='';
  const defs=el('defs',{},svg);
  MCOL.forEach((c,i)=>{const g=el('radialGradient',{id:'mg'+i,cx:'35%',cy:'30%',r:'75%'},defs);
    el('stop',{offset:'0%','stop-color':'#fff','stop-opacity':'.9'},g);el('stop',{offset:'22%','stop-color':c[0]},g);
    el('stop',{offset:'60%','stop-color':c[1]},g);el('stop',{offset:'100%','stop-color':c[2]},g)});
  defs.insertAdjacentHTML('beforeend',SYMS);
  // weicher Murmelschatten als Farbverlauf statt CSS-Filter
  defs.insertAdjacentHTML('beforeend','<radialGradient id="msh"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".55" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>');
  TP=new Array(64);
  for(let p=0;p<4;p++)for(let j=0;j<16;j++)TP[(16*p-9+j+64)%64]=P(p,TT[j]);
  el('polygon',{points:'100 5 300 5 395 100 395 300 300 395 100 395 5 300 5 100',class:'octa'},svg);
  el('circle',{cx:C,cy:C,r:280*F,class:'mid'},svg);
  for(let p=0;p<4;p++){
    const q=v=>P(p,v).map(n=>n.toFixed(1)).join(' ');
    el('path',{class:'seam',d:`M ${q([-40,-280])} L ${q([-40,-410])} Q ${q([-72,-421])} ${q([-40,-432])} Q ${q([-8,-443])} ${q([-40,-454])} L ${q([-40,-632])}`},svg);
  }
  el('polygon',{points:pts(TP),class:'groove'},svg);
  const holes=el('g',{},svg);
  for(let c=0;c<4;c++){
    el('polyline',{points:pts([TP[c*16],...GT.map(v=>P(c,v))]),class:'ggroove',style:`stroke:var(--c${c})`},holes);
    const [k0,k3]=[kennelPt(c,0),kennelPt(c,3)];
    el('line',{x1:k0[0],y1:k0[1],x2:k3[0],y2:k3[1],class:'kgroove'},holes);
    el('line',{x1:k0[0],y1:k0[1],x2:k3[0],y2:k3[1],class:'kcaps',style:`stroke:var(--c${c})`},holes);
  }
  TP.forEach(([x,y],i)=>{
    if(i%16===0){const c=i/16;el('circle',{cx:x,cy:y,r:10.5,class:'startring',style:`stroke:var(--c${c})`},holes)}
    el('circle',{cx:x,cy:y,r:6.2,class:'hole'},holes);
  });
  for(let c=0;c<4;c++){
    const [ax,ay]=TP[(c*16+2)%64],[bx,by]=TP[(c*16+1)%64];
    const ang=Math.atan2(ay-by,ax-bx)*180/Math.PI;
    el('path',{d:'M -2.5 -3.5 L 2.5 0 L -2.5 3.5',class:'chev',style:`stroke:var(--c${c})`,transform:`translate(${(ax+bx)/2} ${(ay+by)/2}) rotate(${ang})`},holes);
    for(let i=0;i<4;i++){const [x,y]=goalPt(c,i);el('circle',{cx:x,cy:y,r:6.6,class:'goal',style:`stroke:var(--c${c})`},holes)}
    for(let j=0;j<4;j++){const [x,y]=kennelPt(c,j);el('circle',{cx:x,cy:y,r:6.2,class:'hole'},holes)}
    const [lx,ly]=rot(c,0,66);
    el('text',{x:C+lx,y:C+ly-4,id:'lab'+c,class:'lab','text-anchor':'middle'},svg);
  }
  el('g',{id:'center'},svg);
  el('g',{id:'mshadows'},svg);
  for(let i=0;i<16;i++)el('circle',{r:9.6,cx:.7,cy:1.7,class:'mshadow',id:'ms'+i},$('mshadows'));
  el('g',{id:'marbles'},svg);
  for(let i=0;i<16;i++)el('circle',{r:8,cx:0,cy:0,class:'marble',id:'m'+i,fill:`url(#mg${i>>2})`},$('marbles'));
  el('g',{id:'hl'},svg);
  el('g',{id:'drag'},svg);
  svg.addEventListener('click',onBoardClick);
  svg.addEventListener('pointerdown',onBoardDown);svg.addEventListener('pointermove',onBoardMove);
  svg.addEventListener('pointerup',onBoardUp);svg.addEventListener('pointercancel',onBoardUp);
}

// ---------- Game flow ----------
let UNDO=null; // Spielstand vor deinem letzten Zug (nur ein Schritt)
let GAME=0; // wird bei jedem neuen Spiel erhöht; laufende Animationen des alten Spiels brechen dann ab
// Beginn einer neuen Partie: Wer in der letzten beendeten Partie den letzten (gewinnenden) Zug gespielt hat, gibt aus,
// und der Nächste in der Reihenfolge beginnt (nach dir kommt Rot). Gibt es noch keine beendete Partie, beginnst du.
const LASTFIN_KEY='aendi-dog-lastfin';
function firstStart(){
  try{const f=localStorage.getItem(LASTFIN_KEY);if(f!==null){const n=+f;if(Number.isInteger(n)&&n>=0&&n<4)return (n+1)%4}}catch(e){}
  return 0;
}
function newGame(){
  GAME++;UNDO=null;PLAYMS=0;PLAY_LAST=performance.now();UNDOS=0;
  const keep=S?{level:S.level,speed:S.speed,deckStyle:'fr',spdV2:1}:{level:$('lvl').value,speed:$('spd').value,deckStyle:'fr',spdV2:1};
  S={opts:{canadian:OPT.canadian,jokerNo8:OPT.jokerNo8},marbles:initMarbles(),hands:[[],[],[],[]],deck:[],cycle:0,nextStart:firstStart(),roundStart:0,turn:0,phase:'exchange',gives:[null,null,null,null],last:null,log:[],winner:null,t0:Date.now(),...keep};
  UI=freshUI();UI.recv=null;busy=false;WINFX.stop(true);
  startRound();
}
// Zieht Spieler p in dieser Runde vor seinem Partner?
const playsFirst=p=>((p-S.roundStart+4)%4)<(((p+2)%4-S.roundStart+4)%4);
// Neue Runde: Der Geber (rechts vor dem Startspieler) teilt im Gegenuhrzeigersinn aus, in Päckchen:
// 6 = 3+3, 5 = 3+2, 4 = 3+1, 3 = 3, 2 = 2. Gemischt wird nur, wenn der Stapel nicht mehr für die ganze
// Runde reicht – dann alle 110 Karten (wie am Tisch: der Reststapel wird weiterverwendet).
// ===== Töne: mit Web Audio im Browser erzeugt, ohne Tondateien. Ein und Aus unter Einstellungen → Töne. =====
// Mischen (Riffeln), Austeilen (Karte rutscht), Murmel hinstellen (Klack mit Glasklang), Murmel ziehen (ein Ticken je Feld).
const SND_KEY='aendi-dog-sound';
const SND={on:false,ctx:null,out:null,noise:null,gestureAt:-1e9,quiet:false};
// Relative Lautstärke je Tonart (wurde am gerenderten Ton nachgemessen, damit alles ungefähr gleich laut wirkt)
// Lautstärke je Tonart (am gerenderten Ton nachgemessen und angeglichen; die Töne sind die Auswahl aus dem Soundlabor)
const SNDG={shuffle:1.94,deal:.58,slide:.40,lay:.65,set:.35,step:.41,kill:.38};   // Mischen: Laborwert 1,21 × 1,6 (so gewählt)
// Geschwindigkeit je Tonart (1 = wie im Labor gebaut, 2 = doppelt so schnell): Alle Zeitabstände und Dauern des Klangs werden durch den Wert
// geteilt, die Tonhöhe bleibt. Die Werte sind die Auswahl aus dem Soundlabor.
const SNDS={shuffle:.40,deal:1.8,slide:1,lay:1,set:1,step:1.32,kill:1};
// Liefert den Audio-Kontext, wenn Töne an sind und der Browser sie abspielen darf (erst nach der ersten Berührung), sonst null.
function audio(){
  if(!SND.on||SND.quiet)return null;
  try{
    if(!SND.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
      const c=new AC(),comp=c.createDynamicsCompressor(),vol=c.createGain();vol.gain.value=.9;
      comp.threshold.value=-12;comp.knee.value=12;comp.ratio.value=5;comp.attack.value=.002;comp.release.value=.12;comp.connect(vol);vol.connect(c.destination);
      const buf=c.createBuffer(1,c.sampleRate,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      SND.ctx=c;SND.out=comp;SND.noise=buf;
    }
    if(SND.ctx.state==='running')return SND.ctx;
    SND.ctx.resume();
    // Kurz nach einer Berührung ist die Freigabe des Browsers unterwegs: der Ton wird eingeplant und startet, sobald sie da ist.
    // Sonst (z. B. beim Laden der Seite, ganz ohne Berührung) bleibt es stumm.
    return performance.now()-SND.gestureAt<500?SND.ctx:null;
  }catch(e){return null}
}
for(const ev of ['pointerdown','pointerup','click','touchend','keydown'])addEventListener(ev,()=>{if(SND.on){SND.quiet=false;SND.gestureAt=performance.now();audio()}},{capture:true,passive:true});
// Rauschstöße (Papier, Holz): Filter + kurze Hüllkurve
function nz(t,o){
  const c=SND.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=SND.noise;f.type=o.type||'bandpass';f.frequency.setValueAtTime(o.f,t);if(o.to)f.frequency.exponentialRampToValueAtTime(o.to,t+o.dur);f.Q.value=o.q||1;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,o.v),t+Math.min(o.att||.003,o.dur*.6));g.gain.exponentialRampToValueAtTime(.0001,t+o.dur);   // att = Anstiegszeit (weiches Anschwellen)
  s.connect(f);f.connect(g);g.connect(SND.out);s.start(t,Math.random()*.5,o.dur+.03);
}
// Töne (Holz, Glas): Sinus mit schnellem Abklingen
function tone(t,o){
  const c=SND.ctx,os=c.createOscillator(),g=c.createGain();
  os.type=o.type||'sine';os.frequency.setValueAtTime(o.f,t);if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+o.dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,o.v),t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+o.dur);
  os.connect(g);g.connect(SND.out);os.start(t);os.stop(t+o.dur+.02);
}
// Zeitskalierte Bausteine: sx(t0,s) streckt (s<1) oder staucht (s>1) alles, was relativ zum Start t0 passiert
function sx(t0,s){return {nz:(t,o)=>nz(t0+(t-t0)/s,{...o,dur:o.dur/s,att:o.att?o.att/s:undefined}),tone:(t,o)=>tone(t0+(t-t0)/s,{...o,dur:o.dur/s})}}
// Klopfen: dumpfer Körperton, Holzblock-Oberton und kurzer Anschlag; k = Tonhöhe, m = Lautstärke
function tockAt(P,t,k,m){const r=.95+.1*Math.random();P.tone(t,{f:230*k*r,to:150*k*r,dur:.09,v:.55*m});P.tone(t,{f:640*k*r,to:430*k*r,dur:.05,v:.26*m});P.nz(t,{f:1500*k,q:2.5,dur:.014,v:.55*m});P.nz(t,{f:3500,type:'highpass',q:.7,dur:.006,v:.12*m})}
function knockAt(P,t,v){P.tone(t,{f:190,to:95,dur:.09,v:.26*v});P.nz(t,{f:900,type:'lowpass',q:.7,dur:.07,v:.22*v})}
function patAt(P,t,m){const r=.93+.14*Math.random();P.tone(t,{f:250*r,to:170*r,dur:.04,v:.3*m});P.nz(t,{f:1500*r,q:1.6,dur:.016,v:.45*m})}
// Mischen: „Abheben, langsamer“ – drei Päckchen rutschen nacheinander durch die Finger, am Ende wird einmal auf den Tisch geklopft.
// Grundlänge 1,5 s, durch die Geschwindigkeit (SNDS.shuffle) und das Spieltempo gestreckt: Normal etwa 3,8 s, Zügig etwa 1,7 s, höchstens etwa 5,5 s.
function shuffleSpeed(){return Math.max(.27,SNDS.shuffle*450/delay())}
function shuffleMs(){return Math.round(1500/shuffleSpeed())}
// Gibt true zurück, wenn tatsächlich ein Ton gestartet wurde.
function sndShuffle(){
  const c=audio();if(!c)return false;
  const t0=c.currentTime+.03,P=sx(t0,shuffleSpeed()),G=SNDG.shuffle;
  for(let g=0;g<3;g++)for(let i=0;i<6;i++)P.nz(t0+g*.46+i*.04+Math.random()*.005,{f:1800+Math.random()*2400,q:1,dur:.035,v:.26*G});
  knockAt(P,t0+1.42,.6*G);
  return true;
}
// Austeilen: „Rutschen“ – tieferes, kurzes Gleiten beim Losfliegen einer Karte
function sndDeal(){
  const c=audio();if(!c)return;
  const t=c.currentTime+.004,P=sx(t,SNDS.deal),r=.92+.16*Math.random();
  P.nz(t,{f:1900*r,to:650*r,q:.8,dur:.12,v:.9*SNDG.deal,att:.02});
}
// Karte tauschen: „Schieben“ – weiches Gleiten über den Tisch beim Losfliegen, ein Tippen beim Ankommen
function sndSlide(){
  const c=audio();if(!c)return;
  const t=c.currentTime+.004,P=sx(t,SNDS.slide),r=.92+.16*Math.random();
  P.nz(t,{f:1500*r,to:900*r,q:.8,dur:.28,v:.8*SNDG.slide,att:.09});
}
function sndPat(m=1){const c=audio();if(!c)return;const t=c.currentTime+.003;patAt(sx(t,SNDS.slide),t,m)}
// Karte ablegen: „Papier“ – kurzes Rascheln, dann ein Tippen
function sndLay(){
  const c=audio();if(!c)return;
  const t=c.currentTime+.003,P=sx(t,SNDS.lay);
  P.nz(t,{f:2400,to:900,q:.8,dur:.09,v:.6*SNDG.lay,att:.02});patAt(P,t+.08,1.2*SNDG.lay);
}
// Flug einer Karte: go beim Start, land kurz vor der Landung (flyCard ruft sie auf)
const SNDF={card:{go:()=>sndSlide(),land:()=>sndPat(1.6*SNDG.slide)},deal:{go:()=>sndDeal()},lay:{land:()=>sndLay()}};
// Murmel hinstellen: „Tief klopfen“ – wie mit dem Knöchel auf den Tisch, tief und gedämpft
function sndSet(){
  const c=audio();if(!c)return;
  const t=c.currentTime+.004,P=sx(t,SNDS.set),r=.92+.16*Math.random(),G=SNDG.set;
  P.tone(t,{f:165*r,to:110*r,dur:.12,v:.7*G});P.tone(t,{f:430*r,to:300*r,dur:.06,v:.2*G});P.nz(t,{f:850,q:1.5,dur:.02,v:.5*G});
}
// Murmel ziehen: „Weiches Tippen“ – tief und leise, das letzte Feld etwas kräftiger
function sndStep(last){
  const c=audio();if(!c)return;
  const t=c.currentTime+.003,P=sx(t,SNDS.step),r=.92+.16*Math.random(),G=SNDG.step;
  P.tone(t,{f:(last?170:190)*r,to:(last?110:140)*r,dur:last?.07:.05,v:(last?.55:.35)*G});
  P.nz(t,{f:800*r,q:1,dur:.015,v:(last?.4:.25)*G});
}
// Murmel heimschicken: „Fallen“ – ein Ton, der nach unten fällt, dann der Aufschlag im Zwinger (dauert etwa 0,25 s)
function sndKill(){
  const c=audio();if(!c)return;
  const t=c.currentTime+.004,P=sx(t,SNDS.kill),G=SNDG.kill;
  P.tone(t,{f:520,to:110,dur:.17,v:.4*G});tockAt(P,t+.15,.75,1.5*G);
}
async function startRound(){
  const g=GAME;
  const n=SIZES[S.cycle%5];S.cycle++;S.roundN=n;   // Karten dieser Runde (für die Falle auf dem Startfeld)
  S.roundStart=S.nextStart;S.nextStart=(S.nextStart+1)%4;
  const dealer=(S.roundStart+3)%4,order=[1,2,3,4].map(i=>(dealer+i)%4),packs=n===6?[3,3]:n===5?[3,2]:n===4?[3,1]:[n];
  let shuffled=false;
  if(!S.deck||S.deck.length<n*4){S.deck=makeDeck();S.last=null;S.under=[];shuffled=true}
  for(const k of packs)for(const p of order)for(let i=0;i<k;i++)S.hands[p].push(S.deck.pop());
  countDeal();S.stuckAdd=null;
  S.phase='exchange';S.gives=[null,null,null,null];
  for(let p=1;p<4;p++)S.gives[p]=aiGive(S.marbles,p,S.hands[p],null,p===2||S.level==='hard',playsFirst(p),S.level==='hard').id;
  UI=freshUI();UI.recv=null;
  const who=dealer===0?'Du':NAMES[dealer];
  if(shuffled)addLog(`${who} ${dealer===0?'mischst':'mischt'} alle 110 Karten neu.`,'round');
  addLog(`Neue Runde mit ${n} Karten. ${who} ${dealer===0?'gibst':'gibt'}, ${S.roundStart===0?'du beginnst':NAMES[S.roundStart]+' beginnt'}. Im Stapel: ${S.deck.length} Karten.`,'round');
  save();
  // Nach dem Mischen kurz warten, damit man es hört, bevor ausgeteilt wird (nur mit Ton; Dauer hängt vom Tempo ab)
  if(shuffled&&SND.on){const ms=shuffleMs();if(sndShuffle()){UI.dealt=[0,0,0,0];busy=true;render();await sleep(ms+100);if(g!==GAME)return}}
  await dealAnim(packs,order,dealer,g);
  if(g!==GAME)return;
  render();
}
// Austeilen sichtbar machen: verdeckte Karten fliegen vom Geber zu den Spielern; deine drehen sich in der Hand auf
async function dealAnim(packs,order,dealer,g){
  UI.dealt=[0,0,0,0];busy=true;render();
  const dur={slow:400,normal:230,fast:132}[S.speed]||230,from=deckScreenPt(),fs=pileScale()*DECK_SCALE,jobs=[],cw=cardW();
  for(const k of packs)for(const p of order){
    const base=UI.dealt[p]+jobs.filter(j=>j.p===p&&!j.done).length,hr=$('hand').getBoundingClientRect();
    for(let i=0;i<k;i++){
      const to=p===0?[hr.left+(base+i)*(cw+7)+cw/2,hr.top+hr.height/2,1,0]:[...seatPt(p),.5,(i-(k-1)/2)*9];
      const job={p,done:false};
      job.pr=flyCard('','back',[...from,fs,deckPos().a],to,dur,i*60,undefined,SNDF.deal).then(()=>{job.done=true;if(g!==GAME)return;UI.dealt[p]++;render()});
      jobs.push(job);
    }
    await sleep(dur*.55);if(g!==GAME)return;
  }
  await Promise.all(jobs.map(j=>j.pr));
  if(g!==GAME)return;
  // Die Karten liegen in der Reihenfolge, in der sie ausgeteilt wurden. Jetzt sortiert sie das Spiel: Sie gleiten an ihren Platz.
  const k={slow:1.4,normal:1,fast:.6}[S.speed]||1,old=handRects();
  UI.dealt=null;render();flipHand(old,450*k,350*k);
  await sleep((350+450)*k+60);if(g!==GAME)return;
  busy=false;
}
async function doExchange(){
  if(UI.give==null||busy)return;
  {const {legal,...r}=S;UNDO=JSON.stringify(r)} // Tauschkarten der Computer stecken schon in S.gives und bleiben beim Undo gleich
  busy=true;$('actBtn').disabled=true;
  const g=GAME,giveId=UI.give,old=handRects(),dur={slow:1150,normal:650,fast:367}[S.speed]||650;
  const gb=document.querySelector(`#hand .card[data-id="${giveId}"]`);
  const gHtml=gb?gb.innerHTML.replace(/<span class="tag">.*?<\/span>/,''):'',gCls=gb?'card'+(gb.classList.contains('red')?' red':'')+(gb.classList.contains('joker')?' joker':''):'card';
  // Tausch sofort ausführen; die erhaltene Karte bleibt unsichtbar, bis sie gelandet ist
  S.gives[0]=giveId;
  const moving=S.gives.map((id,p)=>S.hands[p].find(c=>c.id===id));
  for(let p=0;p<4;p++)S.hands[p]=S.hands[p].filter(c=>c.id!==S.gives[p]);
  for(let p=0;p<4;p++)S.hands[(p+2)%4].push(moving[p]);
  UI=freshUI();UI.recv=moving[2].id;UI.hide=moving[2].id;
  render();
  flipHand(old,dur*.55,dur*.08,UI.hide);   // übrige Karten rücken zusammen und machen Platz
  const jobs=[],o=old.get(giveId);
  if(o)jobs.push(flyCard(gHtml,gCls,[o.left+o.width/2,o.top+o.height/2,1],[...seatPt(2),0.55,-10],dur,0,undefined,SNDF.card));
  const tb=document.querySelector(`#hand .card[data-id="${UI.hide}"]`),tr=tb&&tb.getBoundingClientRect();
  const hr=$('hand').getBoundingClientRect();
  jobs.push(flyCard('','back',[...seatPt(2),0.55,8],tr?[tr.left+tr.width/2,tr.top+tr.height/2,1,0]:[hr.right-34,hr.top+46,1,0],dur,140,undefined,SNDF.card));
  jobs.push(flyCard('','back',[...seatPt(1),0.55,90],[...seatPt(3),0.55,270],dur,70,undefined,SNDF.card));
  jobs.push(flyCard('','back',[...seatPt(3),0.55,-90],[...seatPt(1),0.55,90],dur,210,undefined,SNDF.card));
  await Promise.all(jobs);
  if(g!==GAME)return render();
  UI.hide=null;
  const nb=document.querySelector(`#hand .card[data-id="${moving[2].id}"]`);if(nb){nb.style.visibility='';nb.classList.add('pop')}
  busy=false;
  S.phase='play';S.turn=S.roundStart;
  countStuck();
  addLog(`Karten getauscht. Du hast ${NAMES[2]} ${artikel(moving[0])} gegeben, ${NAMES[2]} dir ${artikel(moving[2])}.`);
  proceed();
}
// Positionen der Handkarten (für Animationen)
function handRects(){const m=new Map();document.querySelectorAll('#hand .card').forEach(b=>m.set(+b.dataset.id,b.getBoundingClientRect()));return m}
// Karten gleiten von ihrer alten Position an die neue (FLIP)
function flipHand(old,dur,wait,skip){
  document.querySelectorAll('#hand .card').forEach(b=>{const id=+b.dataset.id,o=old.get(id);if(!o||id===skip)return;const n=b.getBoundingClientRect(),dx=o.left-n.left,dy=o.top-n.top;
    if(Math.abs(dx)+Math.abs(dy)>.5)b.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:dur,delay:wait||0,easing:'cubic-bezier(.4,0,.2,1)',fill:'backwards'})});
}
// Bildschirmpunkt des Ablagestapels in der Brettmitte (2D und 3D)
// Kartenstapel liegt beim Geber (rechts vor dem Startspieler), im Mittelkreis auf seiner Seite
// Der Nachziehstapel liegt immer beim Geber (S.roundStart ist der Spieler, der beginnt; der Geber sitzt rechts davor).
// Für den Geber unten (du) liegt er am linken Brettrand links neben dem Zieleinlauf, unterhalb der Murmeln des linken Gegners; für die
// anderen Geber ist genau diese Lage um 90° je Platz gedreht (das Brett ist vierfach symmetrisch, der Platz ist also überall frei).
// Immer schräg (45°, parallel zu den Feldern des Zieleinlaufs und der Lochreihe daneben) und rund 14 % kleiner als die Karten auf dem Ablagestapel (DECK_SCALE).
// Koordinaten in SVG-Einheiten (400 × 400, Mitte = C); a = Drehung im Uhrzeigersinn in Grad. Die Lage ist so gewählt, dass der Stapel
// mit allen vier Schichten mindestens 5 Einheiten Abstand zu Murmeln, Löchern und Brettrand hält.
const DECK_SCALE=0.855;
const DECK_LOCAL={dx:-155,dy:48.5,a:45}; // Abstand von der Brettmitte aus Sicht des Gebers unten, und Drehung
function deckPos(){
  const d=(((S&&S.roundStart)||0)+3)%4,[x,y]=rot(d,DECK_LOCAL.dx,DECK_LOCAL.dy);
  return {d,a:DECK_LOCAL.a-90*d,x:C+x,y:C+y};
}
function deckScreenPt(){
  const {x,y,d}=deckPos();
  try{if(window.__v3&&__v3.mode!=='2d'){const s=__v3.scr(x,y,3),bx=document.querySelector('.boardBox').getBoundingClientRect();
    return s&&s[0]>bx.left&&s[0]<bx.right&&s[1]>bx.top&&s[1]<bx.bottom?s:seatPt(d)}}catch(e){}
  const svg=$('board'),pt=svg.createSVGPoint();pt.x=x;pt.y=y;const r=pt.matrixTransform(svg.getScreenCTM());return [r.x,r.y];
}
function drawDeck2D(g){
  if(!S.deck||!S.deck.length||S.phase==='over')return;
  const {a,x,y}=deckPos(),k=Math.max(1,Math.min(4,Math.ceil(S.deck.length/28)));
  const dg=el('g',{transform:`translate(${x} ${y}) rotate(${a})`},g);
  const cw0=60*PS*DECK_SCALE,ch0=86*PS*DECK_SCALE;                  // gleiche Grösse wie die abgelegten Karten
  for(let i=k-1;i>=0;i--)el('rect',{x:-cw0/2+i*.7,y:-ch0/2+i*.9,width:cw0,height:ch0,rx:9*PS*DECK_SCALE,class:'deckc'},dg);
  // Kartenrückseite auf der obersten Karte: feine Diagonalstreifen und ein heller Innenrand (wie in der 3D-Ansicht)
  dg.insertAdjacentHTML('afterbegin','<defs><pattern id="deckPat" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="#fff" fill-opacity=".16"/></pattern></defs>');
  el('rect',{x:-cw0/2,y:-ch0/2,width:cw0,height:ch0,rx:9*PS*DECK_SCALE,fill:'url(#deckPat)'},dg);
  el('rect',{x:-cw0/2+3.2,y:-ch0/2+3.2,width:cw0-6.4,height:ch0-6.4,rx:6,fill:'none',stroke:'rgba(255,255,255,.75)','stroke-width':1.1},dg);
}
function pilePt(){
  try{if(window.__v3&&__v3.mode!=='2d'){const bx=document.querySelector('.boardBox').getBoundingClientRect();const s=__v3.scr(C,C-6,3);
    if(s&&s[0]>bx.left&&s[0]<bx.right&&s[1]>bx.top&&s[1]<bx.bottom)return s;return [bx.left+bx.width/2,bx.top+bx.height/2]}}catch(e){}
  const svg=$('board'),pt=svg.createSVGPoint();pt.x=C;pt.y=C-6;const r=pt.matrixTransform(svg.getScreenCTM());return [r.x,r.y];
}
// Eine Kartengestaltung für Hand, Flug und Stapel (Masse in Handkarten-Pixeln, 60×86)
const PS=0.78; // Grösse der abgelegten Karte auf dem Brett (SVG-Einheiten pro Handkarten-Pixel)
const pileRot=c=>(((c.id*37)%17)-8)*1.1;
const cardW=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cw'))||60;
function drawCardSVG(g,card){
  const jo=card.r==='JO',red=isRed(card);
  el('rect',{x:-30,y:-43,width:60,height:86,rx:9,class:'ccard'},g);
  const t=el('text',{x:-23,y:jo?-24.5:-21.5,class:'crank'+(red?' red':'')+(jo?' jo':'')},g);t.textContent=rankLabel(card.r);
  if(!jo&&isCH())el('use',{href:'#'+SUIT_CH[card.s],x:-5,y:8,width:28,height:28},g);
  else{const u=el('text',{x:23,y:31,'text-anchor':'end',class:'csuit'+(red?' red':'')+(jo?' jo':'')},g);u.textContent=jo?'★':card.s}
}
// Stapel: oberste Karte (S.last) und die zwei darunter (S.under), jede mit ihrer eigenen Drehung
function setLast(x){if(S.last)S.under=[S.last,...(S.under||[])].slice(0,2);S.last=x}
const pileCards=()=>S&&S.last?[S.last,...(S.under||[])]:[];
// Schatten im Flug und abgelegt (Handkarten-Pixel; beim Landen geht der eine in den anderen über)
const SH_FLY='0 10px 18px -6px rgba(0,0,0,.45),0 2px 0 rgba(0,0,0,.12)',SH_PILE='0 3px 3px -1px rgba(0,0,0,.25),0 2px 0 rgba(0,0,0,.12)';
// Bildschirm-Skalierung, mit der eine Handkarte genau so gross wird wie die Karte auf dem Stapel
function pileScale(){
  const cw=cardW();
  try{if(window.__v3&&__v3.mode!=='2d'){const a=__v3.scr(C-30*PS,C-6,3),b=__v3.scr(C+30*PS,C-6,3);if(a&&b)return Math.hypot(a[0]-b[0],a[1]-b[1])/cw}}catch(e){}
  return 60*PS*$('board').getScreenCTM().a/cw;
}
function renderCardDemo(){
  const d=$('cardDemo');if(!d)return;const c={id:3,r:'A',s:'♥'};
  d.innerHTML=`<figure><div class="${cardCls(c)}">${cardHTML(c)}</div><figcaption>auf der Hand</figcaption></figure><figure><div class="${cardCls(c)} fly">${cardHTML(c)}</div><figcaption>im Flug</figcaption></figure><figure><svg viewBox="-36 -48 72 96" aria-hidden="true"></svg><figcaption>abgelegt</figcaption></figure>`;
  const g=el('g',{transform:`rotate(${pileRot(c)})`},d.querySelector('svg'));drawCardSVG(g,c);
}
const cardHTML=c=>`<span class="r">${rankLabel(c.r)}</span><span class="s">${suitHTML(c)}</span>`;
const cardCls=c=>'card'+(isRed(c)?' red':'')+(c.r==='JO'?' joker':'');
// Karten fliegen auf den Stapel: offen (gespielt) oder verdeckt (abgelegt). rects: Startpositionen aus der Hand
// In 3D liegt die Karte perspektivisch verzerrt auf dem Stapel. Damit sie genau so landet, wie sie danach liegt,
// endet der Flug mit einer Projektion (matrix3d), die die vier Kartenecken auf die vier Ecken auf dem Stapel abbildet.
function pileLandTf(c){
  try{
    if(!window.__v3||__v3.mode==='2d')return null;
    const cw=cardW(),hw=cw/2,hh=cw*86/60/2,th=pileRot(c)*Math.PI/180,co=Math.cos(th),si=Math.sin(th);
    const pn=pileCount(),h=Math.max(.5,Math.min(110,pn)*.12)+.15+Math.min(pileCards().length,3)*.3;
    const src=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]],dst=[];
    for(const [lx,ly] of [[-30,-43],[30,-43],[30,43],[-30,43]]){
      const x=lx*PS,y=ly*PS,s=__v3.scr(C+x*co-y*si,C-6+x*si+y*co,h);if(!s)return null;dst.push([s[0]-hw,s[1]-hh]);
    }
    // Homographie aus 4 Punktpaaren (8 Gleichungen)
    const A=[],B=[];
    for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v)}
    for(let i=0;i<8;i++){let m=i;for(let r=i+1;r<8;r++)if(Math.abs(A[r][i])>Math.abs(A[m][i]))m=r;[A[i],A[m]]=[A[m],A[i]];[B[i],B[m]]=[B[m],B[i]];
      for(let r=0;r<8;r++)if(r!==i){const f=A[r][i]/A[i][i];for(let k=i;k<8;k++)A[r][k]-=f*A[i][k];B[r]-=f*B[i]}}
    const [a,b,cc,d,e,f,g,hh2]=B.map((v,i)=>v/A[i][i]);
    return {tf:`matrix3d(${a},${d},0,${g},${b},${e},0,${hh2},0,0,1,0,${cc},${f},0,1)`};
  }catch(e){return null}
}
function flyToPile(cards,p,faceUp,rects){
  const dur={slow:680,normal:400,fast:235}[S.speed]||400,to=pilePt(),ps=pileScale();
  return Promise.all(cards.map((c,i)=>{
    const r=rects&&rects[i],fr=r?[r.left+r.width/2,r.top+r.height/2,1,0]:[...seatPt(p),.55,0],rot=pileRot(c);
    return faceUp?flyCard(cardHTML(c),cardCls(c),fr,pileLandTf(c)||[...to,ps,rot],dur,i*90,[SH_FLY,SH_PILE],SNDF.lay):flyCard('','back',fr,[...to,ps,rot+(i%2?6:-6)],dur,i*90,undefined,SNDF.lay);
  }));
}
function seatPt(p){const svg=$('board');const pt=svg.createSVGPoint();const [a,b]=rot(p,0,150);pt.x=C+a;pt.y=C+b;const r=pt.matrixTransform(svg.getScreenCTM());return [r.x,r.y]}
function flyCard(html,cls,from,to,dur,wait,sh,snd){
  const e=document.createElement('div');e.className='flycard '+cls;e.innerHTML=html;document.body.appendChild(e);
  const hw=e.offsetWidth/2,hh=e.offsetHeight/2;
  const T=q=>q.tf||`translate(${q[0]-hw}px,${q[1]-hh}px) scale(${q[2]||1}) rotate(${q[3]||0}deg)`;
  const k0={transform:T(from)},k1={transform:T(to)};if(sh){k0.boxShadow=sh[0];k1.boxShadow=sh[1]}
  const a=e.animate([k0,k1],{duration:dur,delay:wait||0,easing:'cubic-bezier(.5,.05,.3,1)',fill:'both'});
  if(snd){if(snd.go)later(snd.go,wait||0);if(snd.land)later(snd.land,(wait||0)+dur*.93)}
  return a.finished.then(()=>e.remove(),()=>e.remove());
}
function artikel(c){return c.r==='JO'?'einen Joker':c.r==='A'?'ein Ass':c.r==='B'?(isCH()?'einen Under':'einen Buben'):c.r==='D'?(isCH()?'einen Ober':'eine Dame'):c.r==='K'?'einen König':'eine '+c.r}
function proceed(){
  if(S.phase==='over')return;
  let p=-1;for(let i=0;i<4;i++){const q=(S.turn+i)%4;if(S.hands[q].length){p=q;break}}
  if(p<0){startRound();return}
  S.turn=p;save();
  if(p===0){
    S.legal=legalMoves(S.marbles,0,S.hands[0],false);
    if(!S.legal.length){
      busy=true;render('Keine deiner Karten ist spielbar. Du legst alle ab und setzt diese Runde aus.');
      {const g=GAME;later(async()=>{if(g!==GAME)return;const old=handRects(),cs=S.hands[0];S.hands[0]=[];render();
        await foldToPile(cs,0,cs.map(c=>old.get(c.id)));if(g!==GAME)return render();
        S.hands[0]=cs;fold(0);busy=false;S.turn=1;proceed()},1900*(delay()/700));}
      return;
    }
    busy=false;
    // auto-select a single playable card? no: let the player choose
    render();
  }else aiTurn(p);
}
function fold(p){
  if(p===0)st().folds++;
  S.hands[p]=[];
  addLog(`${p===0?'Du kannst':NAMES[p]+' kann'} nicht ziehen und ${p===0?'legst':'legt'} alle Karten ab.`,'fold');
}
async function aiTurn(p){
  const g=GAME;busy=true;render();
  await sleep(delay());
  if(g!==GAME||S.phase==='over')return;
  const mv=aiChoose(S.marbles,p,S.hands[p],S.level,null,{n:S.roundN||0,cnt:S.hands.map(h=>h.length)});
  if(!mv){const cs=S.hands[p];S.hands[p]=[];render();await foldToPile(cs,p);if(g!==GAME)return render();S.hands[p]=cs;fold(p);render();await sleep(delay()*0.3)}
  else{
    S.hands[p]=S.hands[p].filter(c=>c.id!==mv.card.id);render();
    await flyToPile([mv.card],p,true);if(g!==GAME)return render();
    setLast({p,card:mv.card,val:mv.val});render();
    const before=cloneMs(S.marbles);let killed=[];
    for(const seg of mv.segs){await animateSeg(S.marbles,seg);if(g!==GAME)return render();killed=killed.concat(applySeg(S.marbles,seg));render();await sleep(delay()*0.3);if(g!==GAME)return render()}
    countKills(p,killed);addLog(describe(p,mv,killed,before),killed.some(id=>teamOf(id>>2)===0)?'bad':killed.length?'good':'');
  }
  if(g!==GAME)return render();
  busy=false;afterMove(p);
}
function afterMove(p){
  if(teamWon(S.marbles,teamOf(p))){S.phase='over';S.winner=teamOf(p);try{recordGame()}catch(e){console.error(e)}save();render();winEnd();return}
  S.turn=(p+1)%4;proceed();
}
async function animateSeg(ms,seg){
  const w=cloneMs(ms),m=w[seg.m];
  const toTop=id=>{const e=$('m'+id);e.parentNode.appendChild(e);e.getBoundingClientRect()};
  if(seg.t==='sw')toTop(seg.o);toTop(m.id);
  const place=(x,dur,lift)=>{const e=$('m'+x.id),sh=$('ms'+x.id);e.style.transitionDuration=sh.style.transitionDuration=dur+'ms';const [px,py]=marblePt(w,x);e.style.transform=sh.style.transform=`translate(${px}px,${py}px)`+(lift?' scale(1.2)':'')};
  if(seg.t==='sw'){const o=w[seg.o];const l=m.loc,p=m.pos;m.loc=o.loc;m.pos=o.pos;o.loc=l;o.pos=p;place(m,750,true);place(o,750,true);later(()=>{sndStep(true);later(()=>sndStep(true),110)},690);await sleep(770);place(m,150);place(o,150);await sleep(160);for(const x of w){$('m'+x.id).style.transitionDuration='';$('ms'+x.id).style.transitionDuration=''}return}
  const steps=[];
  if(seg.t==='out')steps.push({loc:'T',pos:startOf(m.color),kill:true});
  else if(m.loc==='G'){for(let i=m.pos+1;i<=seg.end.pos;i++)steps.push({loc:'G',pos:i})}
  else{seg.tp.forEach((q,i)=>steps.push({loc:'T',pos:q,kill:seg.seven||(i===seg.tp.length-1&&seg.end.loc==='T')}));
    if(seg.end.loc==='G')for(let i=0;i<=seg.end.pos;i++)steps.push({loc:'G',pos:i})}
  const dur=seg.t==='out'?stepMs()*3:stepMs();
  $('m'+m.id).classList.add('moving');
  for(const st of steps){
    m.loc=st.loc;m.pos=st.pos;
    let killedHere=false;if(st.kill){const o=w.find(x=>x!==m&&x.loc==='T'&&x.pos===st.pos);if(o){o.loc='K';o.pos=0;killedHere=true}}
    for(const x of w)if(x!==m)place(x,650);
    place(m,dur,true);
    if(seg.t==='out')later(()=>sndSet(),dur*.85);else later(()=>sndStep(st===steps[steps.length-1]),dur*.8);
    if(killedHere)later(sndKill,450);
    await sleep(dur);
  }
  $('m'+m.id).classList.remove('moving');
  place(m,140);await sleep(150);
  for(const x of w){$('m'+x.id).style.transitionDuration='';$('ms'+x.id).style.transitionDuration=''}
}
function describe(p,mv,killed,before){
  const who=p===0?'Du':NAMES[p];
  let lab=cardLabel(mv.card);if(mv.card.r==='JO')lab+=` als ${VLABEL[mv.val]||mv.val}`;
  const s0=mv.segs[0];
  if(!s0)return `${who}: ${VLABEL.B} – ${p===0?'spielst':'spielt'} ihn ohne Wirkung.`;
  const mc=before[s0.m].color;
  // Murmeln anderer Spieler beim Namen nennen (nicht nach der Farbe)
  const fm=mc!==p?(mc===0?' mit deiner Murmel':` mit der Murmel von ${NAMES[mc]}`):'';
  const others=[...new Set(mv.segs.filter(s=>s.t==='mv').map(s=>before[s.m].color))].filter(c=>c!==p);
  const foreign7=others.length?' (mit '+others.map(c=>c===0?'deinen Murmeln':`Murmeln von ${NAMES[c]}`).join(' und ')+')':'';
  let what;
  if(s0.t==='out')what=(p===0?'bringst':'bringt')+(mc!==p?(mc===0?' eine deiner Murmeln':` eine Murmel von ${NAMES[mc]}`):' eine Murmel')+' auf den Start';
  else if(s0.t==='sw'){const q=before[s0.o].color;what=(p===0?'tauschst':'tauscht')+(mc!==p?(mc===0?' deine Murmel':` eine Murmel von ${NAMES[mc]}`):'')+' mit '+(q===0?'dir':NAMES[q])}
  else if(mv.val==='7'){const goals=mv.segs.filter(s=>s.end.loc==='G'&&before[s.m].loc!=='G').length;what=(p===0?'teilst':'teilt')+' die Sieben'+(new Set(mv.segs.map(s=>s.m)).size>1?` auf ${new Set(mv.segs.map(s=>s.m)).size} Murmeln`:'')+foreign7+(goals?`, ${goals} ins Ziel`:'')}
  else if(s0.n<0)what=(p===0?'fährst':'fährt')+' 4 zurück'+fm;
  else what=(p===0?'fährst':'fährt')+' '+s0.n+(s0.end.loc==='G'&&before[s0.m].loc!=='G'?' ins Ziel':'')+fm;
  let txt=`${who}: ${lab} – ${what}.`;
  if(killed.length){
    const by=new Map();for(const id of killed){const o=id>>2;by.set(o,(by.get(o)||0)+1)}
    const NUM=['','eine','zwei','drei','vier'];
    const parts=[...by].map(([o,n])=>o===0?(n>1?`${NUM[n]} deiner Murmeln`:'deine Murmel'):(n>1?`${NUM[n]} Murmeln von ${NAMES[o]}`:NAMES[o]));
    let s=parts.join(' und ');const [o0,n0]=[...by][0];if(o0===0||n0>1)s=s[0].toUpperCase()+s.slice(1); // Namen nicht verändern
    txt+=' '+s+(killed.length>1?' müssen':' muss')+' zurück in den Zwinger.';
  }
  return txt;
}
function addLog(t,cls){S.log.unshift({t,cls:cls||''});if(S.log.length>60)S.log.pop()}

// ---------- Human interaction ----------
function cardHasMoves(id){return S.legal&&S.legal.some(m=>m.card.id===id)}
// Karte ziehen: Wer sie Richtung Brettmitte wirft (weit genug oder schnell genug), spielt sie wie mit Antippen –
// beim Kartentausch wie zweimal Antippen. Danach laufen dieselben Animationen wie sonst.
let dragSuppress=0;
// Kartentausch: zweiter Tipp muss innerhalb von DBL_MS kommen, sonst sinkt die Karte wieder zurück (0 = ohne Limit). Einstellbar.
const DBL_KEY='aendi-dog-dbltap';
let DBL_MS=500,GIVE_T=0;
function cardDragStart(e,b,id){
  if(b.disabled||(e.button!=null&&e.button>0))return;
  const st={x0:e.clientX,y0:e.clientY,pid:e.pointerId,moved:false,trail:[[e.clientX,e.clientY,performance.now()]]};
  const move=ev=>{
    if(ev.pointerId!==st.pid)return;
    const dx=ev.clientX-st.x0,dy=ev.clientY-st.y0;
    if(!st.moved){if(Math.hypot(dx,dy)<8)return;st.moved=true;b.classList.add('drag');try{b.setPointerCapture(st.pid)}catch(_){}}
    st.trail.push([ev.clientX,ev.clientY,performance.now()]);if(st.trail.length>6)st.trail.shift();
    b.style.transform=`translate(${dx}px,${dy}px) rotate(${(dx*.06).toFixed(1)}deg)`;ev.preventDefault();
  };
  const up=ev=>{
    if(ev.pointerId!==st.pid)return;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
    if(!st.moved)return;                       // nur angetippt: das normale click übernimmt
    dragSuppress=performance.now()+350;
    const [tx,ty]=pilePt(),len=Math.hypot(tx-st.x0,ty-st.y0)||1,ux=(tx-st.x0)/len,uy=(ty-st.y0)/len;
    const dist=(ev.clientX-st.x0)*ux+(ev.clientY-st.y0)*uy;   // Strecke Richtung Brettmitte
    const a=st.trail[0],z=st.trail[st.trail.length-1],dt=Math.max(1,z[2]-a[2]);
    const speed=((z[0]-a[0])*ux+(z[1]-a[1])*uy)/dt;           // px/ms Richtung Brettmitte
    const thrown=ev.type==='pointerup'&&(dist>70||(dist>25&&speed>.45));
    b.classList.remove('drag');
    if(thrown){b.style.transform='';throwCard(id)}
    else{b.style.transition='transform .18s';b.style.transform='';setTimeout(()=>{b.style.transition=''},200)}
  };
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
}
function throwCard(id){
  if(busy)return;
  if(S.phase==='exchange'){clearTimeout(GIVE_T);UI.give=id;render();doExchange();return}
  if(S.phase!=='play'||S.turn!==0)return;
  if(UI.card&&UI.card.id===id)return;          // schon gewählt: nicht wieder abwählen
  onCard(id);
}
function onCard(id){
  if(busy)return;
  if(S.phase==='exchange'){
    clearTimeout(GIVE_T);
    if(UI.give===id){doExchange();return}
    UI.give=id;render();
    if(DBL_MS>0){const g=GAME;GIVE_T=setTimeout(()=>{if(g===GAME&&S.phase==='exchange'&&UI.give===id&&!busy){UI.give=null;render()}},DBL_MS)}
    return}
  if(S.phase!=='play'||S.turn!==0)return;
  if(UI.card&&UI.card.id===id&&!UI.applied.length){UI=freshUI(true);render();return}
  if(!cardHasMoves(id))return;
  const card=S.hands[0].find(c=>c.id===id);
  UI=freshUI(true);UI.card=card;
  if(card.r==='JO'){render();return}
  selectVal(card.r);
}
function selectVal(v){
  UI.val=v;UI.k=0;UI.temp=cloneMs(S.marbles);UI.applied=[];UI.sel=null;UI.pend=null;
  if(v==='7'){UI.cand=sevenCands();autoSel();render();return} // Sieben: Schritt für Schritt, die Murmeln dürfen sich beliebig abwechseln
  UI.cand=S.legal.filter(m=>m.card.id===UI.card.id&&m.val===v);
  if(UI.cand.some(c=>!c.segs.length)){commitHuman();return}
  autoSel();render();
}
// Mögliche nächste Teilschritte der Sieben als Kandidaten (die Oberfläche filtert sie wie bei jeder anderen Karte)
function sevenCands(){
  const rem=7-UI.applied.reduce((a,s)=>a+s.n,0);
  return sevenOptions(UI.temp,0,rem).map(seg=>({card:UI.card,val:'7',segs:[...UI.applied,seg]}));
}
function segMatchMarble(seg,id){
  const t=UI.temp;
  return seg.t==='out'?(t[id].loc==='K'&&t[id].color===t[seg.m].color):seg.m===id;
}
function selectableIds(){
  const s=new Set();
  for(const c of UI.cand){const seg=c.segs[UI.k];if(!seg)continue;
    if(seg.t==='out'){for(const m of UI.temp)if(m.loc==='K'&&m.color===UI.temp[seg.m].color)s.add(m.id)}else s.add(seg.m)}
  return s;
}
function autoSel(){
  const groups=new Map();
  for(const c of UI.cand){const seg=c.segs[UI.k];if(!seg)continue;const g=seg.t==='out'?'o':'m'+seg.m;if(!groups.has(g))groups.set(g,seg.m)}
  UI.sel=groups.size===1?[...groups.values()][0]:null;
}
function targetsFor(id){
  const s=new Set();for(const c of UI.cand){const seg=c.segs[UI.k];if(seg&&segMatchMarble(seg,id))s.add(seg.to)}return s;
}
// Alle Zielfelder des nächsten Teilschritts, egal mit welcher Murmel
function allTargets(){
  const s=new Set();for(const c of UI.cand){const seg=c.segs[UI.k];if(seg)s.add(seg.to)}return s;
}
// Welche Murmeln können auf das Feld „to“? Gruppen wie bei autoSel: alle Murmeln im Zwinger zählen als eine.
function reachGroups(to){
  const g=new Map();for(const c of UI.cand){const seg=c.segs[UI.k];if(seg&&seg.to===to)g.set(seg.t==='out'?'o':'m'+seg.m,seg.m)}return [...g.values()];
}
function reachIds(to){
  const s=new Set();for(const c of UI.cand){const seg=c.segs[UI.k];if(!seg||seg.to!==to)continue;for(const m of UI.temp)if(segMatchMarble(seg,m.id))s.add(m.id)}return s;
}
// Direkt ein Zielfeld antippen ist möglich, ausser bei der Sieben (dort wären es zu viele Felder auf einmal)
const directTargets=()=>UI.sel==null&&UI.pend==null&&UI.val!=='7';
// Auf kleinen Screens sind die Löcher nur wenige Pixel gross: Statt exakt treffen zu müssen,
// gewinnt die nächstgelegene gültige Murmel bzw. das nächste Zielfeld im Umkreis.
// Der Umkreis ist der halbe Abstand zwischen zwei Nachbarlöchern, aber nie kleiner als eine
// Trefferfläche von 48 dp Durchmesser (Mindestgrösse für Touch-Ziele nach den Android-/Material-Richtlinien).
const MIN_TOUCH=48;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function holeGap(){
  let g=Infinity;
  for(let i=0;i<64;i++)g=Math.min(g,dist(TP[i],TP[(i+1)%64]));
  for(let c=0;c<4;c++)for(let i=0;i<3;i++)g=Math.min(g,dist(goalPt(c,i),goalPt(c,i+1)));
  return g;
}
function nearestHit(cx,cy){
  const svg=$('board'),m=svg.getScreenCTM();if(!m)return null;
  const s=Math.hypot(m.a,m.b);let best=null,bd=Math.max(MIN_TOUCH/2,holeGap()/2*s);
  for(const h of $('hl').querySelectorAll('.hit')){
    const x=+h.getAttribute('cx'),y=+h.getAttribute('cy'),px=m.a*x+m.c*y+m.e,py=m.b*x+m.d*y+m.f;
    const d=Math.hypot(px-cx,py-cy);if(d<bd){bd=d;best=h}
  }
  return best;
}
function onBoardClick(e){
  if(busy||!UI.cand||performance.now()<NOCLICK)return;
  const t=e.clientX!=null&&e.detail!==0?nearestHit(e.clientX,e.clientY):e.target.closest('[data-to],[data-mid]');if(!t)return;
  if(t.dataset.to){
    const to=t.dataset.to;
    if(UI.sel!=null){chooseTarget(to);return}
    if(UI.pend===to){UI.pend=null;render();return} // nochmals antippen: zurück zur Auswahl
    const ids=reachGroups(to);
    if(ids.length===1){UI.sel=ids[0];chooseTarget(to);return}
    UI.pend=to;render();return; // mehrere Murmeln kommen dorthin: welche?
  }
  const id=+t.dataset.mid;
  if(UI.pend!=null){const to=UI.pend;UI.pend=null;UI.sel=id;chooseTarget(to);return}
  UI.sel=UI.sel===id&&selectableIds().size>1?null:id;render();
}
// Murmel aufs Zielfeld ziehen: Sie rastet auf dem nächsten gültigen Feld ein, Loslassen zieht.
let DRAG=null,NOCLICK=0;
const DRAG_PX=8;
function svgPt(cx,cy){const svg=$('board'),p=svg.createSVGPoint();p.x=cx;p.y=cy;const q=p.matrixTransform(svg.getScreenCTM().inverse());return [q.x,q.y]}
function onBoardDown(e){
  DRAG=null;
  if(busy||!UI.cand||e.button>0||!e.isPrimary)return;
  const h=nearestHit(e.clientX,e.clientY);if(!h||h.dataset.mid==null)return;
  DRAG={id:+h.dataset.mid,x0:e.clientX,y0:e.clientY,pid:e.pointerId,on:false,to:null,ghost:null};
}
function onBoardMove(e){
  const d=DRAG;if(!d||e.pointerId!==d.pid)return;
  if(!d.on){
    if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<DRAG_PX)return;
    if(busy||!UI.cand){DRAG=null;return}
    d.on=true;try{$('board').setPointerCapture(e.pointerId)}catch(err){}
    if(UI.sel!==d.id){UI.sel=d.id;UI.pend=null;render()}
    $('m'+d.id).classList.add('lifted');
    d.ghost=el('circle',{r:8,class:'ghost',fill:`url(#mg${d.id>>2})`},$('drag'));
  }
  const h=nearestHit(e.clientX,e.clientY);d.to=h&&h.dataset.to||null;
  const [x,y]=d.to?locPt(d.to):svgPt(e.clientX,e.clientY);
  d.ghost.setAttribute('cx',x.toFixed(1));d.ghost.setAttribute('cy',y.toFixed(1));
  d.ghost.classList.toggle('snap',!!d.to);
}
function onBoardUp(e){
  const d=DRAG;if(!d||e.pointerId!==d.pid)return;
  DRAG=null;if(!d.on)return;
  NOCLICK=performance.now()+400; // der Klick nach dem Loslassen soll die Auswahl nicht wieder aufheben
  $('drag').innerHTML='';$('m'+d.id).classList.remove('lifted');
  if(e.type==='pointerup'&&d.to&&!busy&&UI.sel===d.id)chooseTarget(d.to);
}
async function chooseTarget(to){
  const sel=UI.sel;if(sel==null)return;
  const match=UI.cand.filter(c=>{const s=c.segs[UI.k];return s&&segMatchMarble(s,sel)&&s.to===to});
  if(!match.length)return;
  const seg={...match[0].segs[UI.k]};if(seg.t==='out')seg.m=sel;
  UI.cand=match;UI.k++;UI.applied.push(seg);UI.sel=null;UI.pend=null;
  const g=GAME;busy=true;$('hl').innerHTML='';
  // Beim ersten Teilschritt fliegt die Karte zuerst auf den Stapel, danach ziehen die Murmeln
  if(UI.applied.length===1){
    const cb=document.querySelector(`#hand .card[data-id="${UI.card.id}"]`),cr=cb&&cb.getBoundingClientRect();
    UI.prevLast={last:S.last,under:S.under};UI.hide=UI.card.id;renderHand();
    await flyToPile([UI.card],0,true,cr?[cr]:null);if(g!==GAME)return render();
    setLast({p:0,card:UI.card,val:UI.val});renderCenter();
  }
  await animateSeg(UI.temp,seg);if(g!==GAME)return render();busy=false;
  applySeg(UI.temp,seg);
  if(UI.val==='7'){
    if(UI.applied.reduce((a,s)=>a+s.n,0)>=7){await commitHuman();return}
    UI.cand=sevenCands();
  }else if(UI.cand.some(c=>c.segs.length===UI.k)){await commitHuman();return}
  autoSel();render();
}
async function commitHuman(){
  const flown=!!UI.prevLast;
  {const {legal,...r}=S;if(flown){r.last=UI.prevLast.last;r.under=UI.prevLast.under}UNDO=JSON.stringify(r)}
  const old=handRects(),pc=UI.card;
  busy=true;render();
  const before=cloneMs(S.marbles);
  const r=applyAll(S.marbles,UI.applied);
  const mv={card:UI.card,val:UI.val,segs:UI.applied};
  S.marbles=r.ms;S.hands[0]=S.hands[0].filter(c=>c.id!==UI.card.id);
  const lastPlay={p:0,card:UI.card,val:UI.val};
  countKills(0,r.killed);addLog(describe(0,mv,r.killed,before),r.killed.some(id=>teamOf(id>>2)===0)?'bad':r.killed.length?'good':'');
  UI=freshUI();UI.recv=null;S.legal=null;render();
  flipHand(old,320);
  {const g=GAME;if(!flown)await flyToPile([pc],0,true,[old.get(pc.id)]);if(g!==GAME)return render();}
  if(!flown)setLast(lastPlay);render();
  {const g=GAME;await sleep(250);if(g!==GAME)return render();}busy=false;afterMove(0);
}
function cancelMove(){if(busy)return;if(UI.prevLast){S.last=UI.prevLast.last;S.under=UI.prevLast.under}UI=freshUI(true);render()}
// ===== Statistik =====
// Jede beendete Partie wird mit ein paar Kennzahlen gespeichert (auf dem Gerät, max. 300 Partien).
const STATS_KEY='aendi-dog-stats';
let STATS={games:[]};
function loadStats(){try{const s=JSON.parse(localStorage.getItem(STATS_KEY)||'null');if(s&&Array.isArray(s.games))STATS=s}catch(e){}}
function saveStats(){try{localStorage.setItem(STATS_KEY,JSON.stringify(STATS))}catch(e){}}
// Zähler der laufenden Partie (steckt im Spielstand, übersteht also Neuladen und Zurücknehmen)
function st(){if(!S.stat)S.stat={us:0,them:0,folds:0};return S.stat}
function countKills(p,killed){const s=st();for(const id of killed){const mt=teamOf(p);if(teamOf(id>>2)===mt)continue;if(mt===0)s.us++;else s.them++}}
// Spielzeit der laufenden Partie: nur aktive Zeit (Seite sichtbar, kein Dialog offen, Partie nicht beendet).
// Der Zähler liegt bewusst ausserhalb von S, damit „Zurücknehmen“ ihn nicht zurücksetzt; gesichert wird er im Spielstand (S.pms).
let PLAYMS=0,PLAY_LAST=performance.now();
let UNDOS=0;   // wie oft in dieser Partie „Zurücknehmen“ benutzt wurde (steht im Spielstand als S.und und in der Statistik als undo; wird bewusst nicht angezeigt)
function playTick(){
  const now=performance.now(),dt=now-PLAY_LAST;PLAY_LAST=now;
  if(!S||S.winner!==null||document.hidden||document.querySelector('dialog[open]'))return;
  if(dt>0&&dt<3000)PLAYMS+=dt;           // lange Lücken (Ruhezustand) zählen nicht
}
setInterval(playTick,1000);
document.addEventListener('visibilitychange',()=>{PLAY_LAST=performance.now();if(document.hidden&&S)save()});
window.addEventListener('pagehide',()=>{if(S)save()});
// Dauer als Text: 45 s, 23 min, 1 h 05 min
function fmtDur(sec,short){if(!(sec>0))return '–';sec=Math.round(sec);if(sec<60)return sec+'\u202fs';const m=Math.round(sec/60);if(m<60)return m+'\u202fmin';return Math.floor(m/60)+'\u202fh\u202f'+String(m%60).padStart(2,'0')+(short?'':'\u202fmin')}
// ===== Gewinnanimation: „Großes Finale“ (Feuerwerk, Konfetti-Kanonen, am Ende Konfettiregen) =====
// Wird nur gespielt, wenn dein Team gewinnt. Sie läuft über dem ganzen Bildschirm, das Brett bleibt dahinter sichtbar (leicht abgedunkelt),
// ohne Ton und ohne Textfenster. Ein Tippen beendet sie. Bei „Bewegung reduzieren“ im System oder mit der Einstellung „Gewinnanimation: Aus“ gibt es sie nicht.
// Farben: die vier Spielerfarben (so wie eingestellt), dazu Weiss und Lila.
const FX_KEY='aendi-dog-fx';let FX_ON=true;
const WINFX=(()=>{
  const cv=$('winFx'),cx=cv.getContext('2d'),scrim=$('winScrim');
  let S=null,raf=0,W=0,H=0,last=0;
  const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
  const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const isDark=()=>{const t=document.documentElement.dataset.theme;return t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)};
  const palette=()=>[0,1,2,3].map(i=>hex((PALETTE[SEATS[i].col]||PALETTE.blau).dark)).concat([hex('#ffffff'),hex('#b46bff')]);
  const col=()=>pick(S.pal);
  function resize(){const d=Math.min(2,window.devicePixelRatio||1);W=window.innerWidth;H=window.innerHeight;cv.width=Math.round(W*d);cv.height=Math.round(H*d);cx.setTransform(d,0,0,d,0,0)}
  const at=(t,fn)=>{S.ev.push({t,fn,done:false});S.end=Math.max(S.end,t)};
  const flash=(x,y,r,c)=>S.P.push({k:'flash',x,y,r,c,life:.3,max:.3});
  function burst(x,y,o={}){
    const type=o.type||pick(['sphere','sphere','ring','willow','double']),n=Math.round(o.count||rnd(90,140)),c1=col(),c2=col(),sp=(o.speed||rnd(5.2,7.4))*S.k;
    const mk=(cnt,speed,c,life,grav,ring)=>{for(let i=0;i<cnt;i++){const a=ring?Math.PI*2*i/cnt:Math.random()*Math.PI*2,s=ring?speed:speed*Math.sqrt(Math.random());
      S.P.push({k:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:life*rnd(.75,1.1),max:life,c:Math.random()<.25?c2:c,g:grav,h:[]})}};
    if(type==='willow')mk(n,sp*.85,hex('#ffd45a'),2.3,.06,false);
    else if(type==='ring')mk(n,sp,c1,1.5,.045,true);
    else if(type==='double'){mk(Math.round(n*.6),sp,c1,1.5,.045,false);mk(Math.round(n*.4),sp*.5,c2,1.3,.045,true)}
    else mk(n,sp,c1,1.5,.045,false);
    flash(x,y,64*S.k,c1);
  }
  const rocket=(x,ty)=>S.P.push({k:'rocket',x,y:H+10,vx:rnd(-.5,.5),vy:-rnd(9.5,12.5)*S.k,ty,o:{}});
  function confetti(x,y,o={}){
    const w=rnd(6,11)*Math.min(1.4,S.k),life=o.life||rnd(4,7);
    S.P.push({k:'conf',x,y,vx:o.vx||0,vy:o.vy||0,rot:rnd(0,6.28),vr:rnd(-.25,.25),fl:rnd(0,6.28),vf:rnd(.12,.3),w,h:w*rnd(1.2,2),c:col(),round:Math.random()<.2,g:o.g??.22,drag:o.drag??.985,term:o.term??2.6,sway:rnd(0,6.28),life,max:life});
  }
  function cannon(x,dir,count){
    flash(x,H-10,70,hex('#ffffff'));
    for(let i=0;i<count;i++){const a=(dir>0?-rnd(52,82):-(180-rnd(52,82)))*Math.PI/180,s=rnd(12,24)*S.k;confetti(x,H-10,{vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(4.2,6.5)})}
  }
  function update(dt){
    const k=dt*60;S.t+=dt;
    for(const e of S.ev)if(!e.done&&S.t>=e.t){e.done=true;e.fn()}
    if(S.rate){S.acc+=S.rate*dt;while(S.acc>=1){S.acc--;if(S.t>S.until){S.rate=0;break}confetti(rnd(0,W),-14,{vy:rnd(1,3),g:.02,term:rnd(1.6,3),drag:.99,life:rnd(7,10)})}}
    const out=[];
    for(const p of S.P){
      if(p.k==='rocket'){p.x+=p.vx*k;p.y+=p.vy*k;p.vy*=Math.pow(.985,k);
        if(Math.random()<.9)S.P.push({k:'spark',x:p.x,y:p.y,vx:rnd(-.3,.3),vy:rnd(.2,1),life:.45,max:.45,c:hex('#ffe9b0'),g:.02,h:[],tiny:true});
        if(p.y<=p.ty||p.vy>-2.2){burst(p.x,p.y,p.o);continue}out.push(p);continue}
      if(p.k==='spark'){p.h.push(p.x,p.y);if(p.h.length>12)p.h.splice(0,2);const d=Math.pow(.985,k);p.vx*=d;p.vy=p.vy*d+p.g*k;p.x+=p.vx*k;p.y+=p.vy*k;p.life-=dt;if(p.life>0)out.push(p);continue}
      if(p.k==='flash'){p.life-=dt;if(p.life>0)out.push(p);continue}
      if(p.k==='conf'){p.vx*=Math.pow(p.drag,k);p.vy=Math.min(p.term,p.vy*Math.pow(p.drag,k)+p.g*k);p.sway+=.06*k;p.x+=(p.vx+Math.sin(p.sway)*.6)*k;p.y+=p.vy*k;p.rot+=p.vr*k;p.fl+=p.vf*k;p.life-=dt;if(p.life>0&&p.y<H+30)out.push(p)}
    }
    S.P=out;
    if(!S.fade&&S.t>8.8){S.fade=true;scrim.style.opacity=0}       // die Hauptshow ist vorbei: das Brett wird wieder hell, das letzte Konfetti fällt noch aus
    if(S.t>S.end+.2&&S.P.length===0&&!S.rate)S.done=true;
  }
  function draw(){
    cx.clearRect(0,0,W,H);
    for(const p of S.P){
      if(p.k==='flash'){const a=p.life/p.max;cx.globalCompositeOperation='lighter';const g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*(1.3-.3*a));g.addColorStop(0,rgba(p.c,.4*a));g.addColorStop(.35,rgba(p.c,.12*a));g.addColorStop(1,rgba(p.c,0));cx.fillStyle=g;cx.beginPath();cx.arc(p.x,p.y,p.r*1.3,0,7);cx.fill();continue}
      if(p.k==='spark'){const a=Math.max(0,Math.min(1,p.life/p.max*(p.tiny?1:1.4)));cx.globalCompositeOperation='lighter';cx.lineCap='round';
        if(p.h.length>=4){cx.strokeStyle=rgba(p.c,a*.7);cx.lineWidth=p.tiny?1:2;cx.beginPath();cx.moveTo(p.h[0],p.h[1]);for(let i=2;i<p.h.length;i+=2)cx.lineTo(p.h[i],p.h[i+1]);cx.lineTo(p.x,p.y);cx.stroke()}
        cx.fillStyle=rgba(p.c,a);cx.beginPath();cx.arc(p.x,p.y,p.tiny?1.2:2.3,0,7);cx.fill();continue}
      if(p.k==='rocket'){cx.globalCompositeOperation='lighter';cx.fillStyle='rgba(255,240,200,.95)';cx.beginPath();cx.arc(p.x,p.y,2.4,0,7);cx.fill();continue}
      if(p.k==='conf'){cx.globalCompositeOperation='source-over';const a=Math.min(1,p.life/(p.max*.25));cx.save();cx.globalAlpha=a;cx.translate(p.x,p.y);cx.rotate(p.rot);cx.scale(1,Math.cos(p.fl));cx.fillStyle=rgba(p.c,1);
        if(p.round){cx.beginPath();cx.arc(0,0,p.w*.45,0,7);cx.fill()}else cx.fillRect(-p.w/2,-p.h/2,p.w,p.h);cx.restore()}
    }
    cx.globalCompositeOperation='source-over';
  }
  function frame(now){
    if(!S)return;const dt=Math.min(.05,(now-last)/1000||.016);last=now;update(dt);draw();
    if(S.done){stop(false);return}
    raf=requestAnimationFrame(frame);
  }
  // now = true: sofort aufräumen (neues Spiel, Zurücknehmen); false: das Brett wird sanft wieder hell (Tippen, Ende)
  function stop(now){
    if(!S&&!raf&&!scrim.style.opacity)return;
    if(raf)cancelAnimationFrame(raf);raf=0;S=null;cx.clearRect(0,0,W,H);
    if(now){scrim.style.transition='none';scrim.style.opacity=0;void scrim.offsetWidth;scrim.style.transition=''}else scrim.style.opacity=0;
  }
  function start(){
    stop(true);
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    resize();S={t:0,ev:[],P:[],acc:0,pal:palette(),end:0,done:false,rate:0,until:0,k:Math.min(1.7,Math.max(1,Math.min(W,H)/430))};
    for(let i=0;i<9;i++)at(.2+i*3.6/9,()=>rocket(rnd(W*.12,W*.88),rnd(H*.14,H*.42)));
    at(3.9,()=>{cannon(W*.04,1,100);cannon(W*.96,-1,100)});
    at(4.5,()=>{burst(W*.5,H*.3,{type:'ring',count:110});burst(W*.25,H*.25,{count:90});burst(W*.75,H*.25,{count:90})});
    at(5.5,()=>{S.rate=45;S.until=7.5});S.end=7.5;
    scrim.style.transition='';scrim.style.opacity=isDark()?.22:.42;   // Brett abdunkeln, damit Funken auf dem Holz leuchten
    last=performance.now();raf=requestAnimationFrame(frame);
  }
  window.addEventListener('resize',()=>{if(S)resize()});
  return {start,stop,get active(){return !!S}};
})();
function winEnd(){if(S.winner===0&&FX_ON)WINFX.start()}
function recordGame(){
  const s=st();
  // Murmeln des unterlegenen Teams am Spielende: K = daheim (Zwinger), T = unterwegs, G = im Ziel
  const lt=1-S.winner,lose={K:0,T:0,G:0};for(const m of S.marbles)if(teamOf(m.color)===lt)lose[m.loc]++;
  const dur=Math.round((PLAYMS+(document.hidden?0:Math.min(2500,performance.now()-PLAY_LAST)))/1000);   // Spielzeit in Sekunden
  try{if(S.last&&S.last.p>=0&&S.last.p<4)localStorage.setItem(LASTFIN_KEY,String(S.last.p))}catch(e){}   // wer den letzten Zug gespielt hat, gibt in der nächsten Partie aus
  STATS.games.push({t:Date.now(),win:S.winner===0,level:S.level,rounds:S.cycle,us:s.us,them:s.them,folds:s.folds,lose,dur,start:S.t0,undo:UNDOS,
    fin:S.last&&S.last.card?S.last.card.r:undefined,finVal:S.last&&S.last.card?S.last.val:undefined,finBy:S.last?S.last.p:undefined});   // fin = Karte, mit der die 8. Murmel ins Ziel kam (finVal: als welcher Wert der Joker zählte, finBy: wer sie gespielt hat)
  if(STATS.games.length>300)STATS.games.shift();
  saveStats();
}
function openStats(){renderStats();$('stats').showModal()}
// Wie knapp war es? Wo standen die acht Murmeln des unterlegenen Teams am Spielende?
function marginStats(G){
  const D=G.filter(g=>g.lose);
  let h='<h3>Wie knapp war es?</h3>';
  if(!D.length)return h+'<p class="muted">Noch keine Daten.</p>';
  const avg=(a,k)=>(a.reduce((s,g)=>s+g.lose[k],0)/a.length).toFixed(1).replace('.',',');
  const row=(lab,a)=>a.length?`<tr><td>${lab}<br><small class="muted">${a.length} ${a.length===1?'Partie':'Partien'}</small></td><td>${avg(a,'K')}</td><td>${avg(a,'T')}</td><td>${avg(a,'G')}</td></tr>`:'';
  const W=D.filter(g=>g.win),L=D.filter(g=>!g.win);
  h+='<p class="muted">Ø Murmeln des Verlierers am Spielende</p>'+
    `<div class="tw"><table class="cmp tight"><tr><th>Verlierer</th><th>daheim</th><th>unterwegs</th><th>im Ziel</th></tr>${row(`${NAMES[3]} + ${NAMES[1]}`,W)}${row(`ihr (${meName()} + ${NAMES[2]})`,L)}</table></div>`;
  const last=D.slice(-10).reverse(),rh=17,W2=320,lw=40,bw=W2-lw-50,u=bw/8,H=last.length*rh+2;
  let s=`<svg viewBox="0 0 ${W2} ${H}" class="chart" role="img" aria-label="Murmeln des unterlegenen Teams je Partie">`;
  last.forEach((g,i)=>{
    const d=new Date(g.t),y=1+i*rh;let x=lw;
    s+=`<text x="0" y="${y+12}" class="lab">${d.getDate()}.${d.getMonth()+1}.</text>`;
    for(const [k,c] of [['K','lk'],['T','lt'],['G','lg']]){
      const n=g.lose[k]||0,w=n*u;if(!n)continue;
      s+=`<rect x="${x.toFixed(1)}" y="${y+2}" width="${(w-1.5).toFixed(1)}" height="12" rx="3" class="${c}"/><text x="${(x+w/2-.75).toFixed(1)}" y="${y+11.5}" class="cnt" text-anchor="middle">${n}</text>`;x+=w;
    }
    s+=`<text x="${lw+bw+6}" y="${y+12}" class="lab2">${g.win?'Gegner':'ihr'}</text>`;
  });
  s+='</svg>';
  return h+'<p class="legend"><span class="dot lk"></span>daheim<span class="dot lt"></span>unterwegs<span class="dot lg"></span>im Ziel</p>'+s;
}
// Taktik der Computerspieler (von dir vorgegeben): dokumentiert im Code bei den jeweiligen Funktionen
// (winGive, ruleGive, killGive, feats/Blockaden, partnerBackPen, partnerUsePen) und in RULES.md des Projekts.
// Kartenverteilung: bei jedem Austeilen zählen, welche Kartenwerte jedes Team bekommt (über alle Spiele).
// Der Tausch findet innerhalb des Teams statt und ändert die Team-Summen nicht.
let NO_DEAL_STATS=false;
const DEAL_RANKS=['JO','A','K','D','B','10','9','8','7','6','5','4','3','2'];
function countDeal(){
  if(NO_DEAL_STATS)return;
  if(!STATS.deal)STATS.deal={n:0,t:[{},{}]};
  const d=STATS.deal;d.n++;
  for(let p=0;p<4;p++)for(const c of S.hands[p]){const t=d.t[teamOf(p)];t[c.r]=(t[c.r]||0)+1}
  saveStats();
}
// Fehlstart: Ein Spieler kann gleich nach dem Kartentausch keinen einzigen Zug machen. Gezählt je Spieler und Runde, aufs Team gerechnet.
// S.stuckAdd merkt sich, was diese Runde dazugekommen ist, damit das Zurücknehmen des Tauschs es wieder abziehen kann.
const hasMove=(ms,p,hand)=>legalMoves(ms,p,hand,false).length>0;
function countStuck(){
  if(NO_DEAL_STATS||!STATS.deal)return;
  const a=[0,0];for(let p=0;p<4;p++)if(!hasMove(S.marbles,p,S.hands[p]))a[teamOf(p)]++;
  const d=STATS.deal;if(!d.m)d.m=[0,0];d.m[0]+=a[0];d.m[1]+=a[1];S.stuckAdd=a;saveStats();
}
function uncountStuck(){
  const a=S.stuckAdd,d=STATS.deal;if(!a||!d||!d.m)return;
  d.m[0]-=a[0];d.m[1]-=a[1];S.stuckAdd=null;saveStats();
}
function dealStats(){
  const d=STATS.deal;
  if(!d||!d.n)return '<h3>Kartenverteilung</h3><p class="muted">Noch keine Runde.</p>';
  const W=320,rh=19,lw=54,bw=W-lw-44,H=DEAL_RANKS.length*rh+4,zOf=(a,n)=>n?(a-n/2)/Math.sqrt(n/4):0;
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Kartenverteilung pro Team">`;
  DEAL_RANKS.forEach((r,i)=>{
    const a=d.t[0][r]||0,b=d.t[1][r]||0,n=a+b,y=2+i*rh,f=n?a/n:.5,z=zOf(a,n);
    s+=`<text x="0" y="${y+13}" class="lab">${VLABEL[r]||r}</text>`;
    s+=`<rect x="${lw}" y="${y+3}" width="${(bw*f).toFixed(1)}" height="12" rx="3" class="tA"/><rect x="${(lw+bw*f).toFixed(1)}" y="${y+3}" width="${(bw*(1-f)).toFixed(1)}" height="12" rx="3" class="tB"/>`;
    s+=`<text x="${lw+4}" y="${y+13}" class="cnt">${a}</text><text x="${lw+bw-4}" y="${y+13}" class="cnt" text-anchor="end">${b}</text>`;
    if(n>=12&&Math.abs(z)>=2)s+=`<text x="${lw+bw+5}" y="${y+13}" class="flag">${z>0?'▲ ihr':'▼ ihr'}</text>`;
  });
  s+=`<line x1="${lw+bw/2}" x2="${lw+bw/2}" y1="0" y2="${H}" class="zero"/></svg>`;
  const sum=(t,rs)=>rs.reduce((x,r)=>x+(d.t[t][r]||0),0);
  const a=sum(0,['A','K','JO']),b=sum(1,['A','K','JO']),z=zOf(a,a+b);
  return `<h3>Kartenverteilung</h3><p class="legend"><span class="dot tA"></span>ihr (${meName()} + ${NAMES[2]})<span class="dot tB"></span>${NAMES[3]} + ${NAMES[1]} · Mitte = gleich viele</p>`+s+
    `<p class="muted">${d.n} Runden. Startkarten (Ass, König, Joker): ihr ${a}, Gegner ${b} – ${a+b<12?'noch zu wenige für eine Aussage':Math.abs(z)<2?'im Rahmen des Zufalls':(z>0?'ihr habt auffällig mehr bekommen':'ihr habt auffällig weniger bekommen')}.<br>Fehlstarts: ihr ${(d.m||[0,0])[0]}, Gegner ${(d.m||[0,0])[1]}</p>`;
}
const pctTxt=(a,b)=>b?Math.round(100*a/b)+'\u202f%':'–';
function chartHistory(arr){
  const W=320,H=132,pl=34,pr=8,pt=8,pb=30,n=arr.length,off=STATS.games.length-n;
  let w=STATS.games.slice(0,off).filter(g=>g.win).length;
  const X=i=>pl+(n===1?(W-pl-pr)/2:i*(W-pl-pr)/(n-1)),Y=v=>pt+(1-v)*(H-pt-pb);
  const pts=arr.map((g,i)=>{if(g.win)w++;return [X(i),Y(w/(off+i+1)),g]});
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Siegquote über die letzten Partien">`;
  for(const v of [0,.5,1])s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="grid${v===.5?' mid':''}"/><text x="${pl-5}" y="${Y(v)+3}" class="ax" text-anchor="end">${v*100}\u202f%</text>`;
  if(n>1)s+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" class="line"/>`;
  for(const [x,y,g] of pts){s+=`<circle cx="${x}" cy="${y}" r="2.2" class="pt"/><circle cx="${x}" cy="${H-11}" r="4.6" class="${g.win?'win':'loss'}"/>`}
  return s+'</svg><p class="legend"><span class="dot win"></span>Sieg<span class="dot loss"></span>Niederlage · Linie: Siegquote insgesamt</p>';
}
// Spielzeiten: Durchschnitt, kürzeste, längste und Gesamtzeit (nur Partien mit Zeitangabe, ältere haben keine)
function timeStats(G){
  const D=G.filter(g=>g.dur>0).map(g=>g.dur);if(!D.length)return '';
  const sum=D.reduce((a,b)=>a+b,0);
  return `<div class="tiles t3"><div><b>${fmtDur(sum/D.length)}</b><span>Ø pro Partie</span></div><div><b>${fmtDur(Math.min(...D))}</b><span>kürzeste</span></div><div><b>${fmtDur(Math.max(...D))}</b><span>längste</span></div></div><p class="muted">Gesamte Spielzeit: ${fmtDur(sum)}</p>`;
}
// Die achte Murmel: Mit welcher Karte kam die letzte Murmel des Siegerteams ins Ziel? Vor allem: wie oft mit dem Joker?
// Zählt nur Partien mit Angabe (ältere haben keine).
function finStats(G){
  const F=G.filter(g=>g.fin);
  if(!F.length)return '<h3>Die achte Murmel</h3><p class="muted">Noch keine Partie mit dieser Angabe.</p>';
  const jo=F.filter(g=>g.fin==='JO'),mine=jo.filter(g=>g.win).length;
  return `<h3>Die achte Murmel</h3>
    <div class="tiles t3"><div><b>${jo.length}\u202f×</b><span>mit dem Joker</span></div><div><b>${mine}\u202f×</b><span>euer Team</span></div><div><b>${jo.length-mine}\u202f×</b><span>Gegner</span></div></div>`;
}
function renderStats(){
  const G=STATS.games,n=G.length,wins=G.filter(g=>g.win).length;
  let run=0,best=0;for(const g of G){run=g.win?run+1:0;best=Math.max(best,run)}
  let h=`<div class="tiles"><div><b>${n}</b><span>Partien</span></div><div><b>${wins}</b><span>Siege</span></div><div><b>${pctTxt(wins,n)}</b><span>Siegquote</span></div><div><b>${best}</b><span>längste Serie</span></div></div>`;
  if(!n)h+='<p class="muted">Noch keine beendete Partie.</p>';
  else{
    h+=timeStats(G);
    h+='<h3>Verlauf</h3>'+chartHistory(G.slice(-30));
    const lv={easy:'Leicht',medium:'Mittel',hard:'Stark'};
    h+='<h3>Letzte Partien</h3><div class="tw"><table class="cmp tight"><tr><th>Start</th><th>Ergebnis</th><th>Gegner</th><th>Schläge</th><th>Dauer</th></tr>'+G.slice(-8).reverse().map(g=>{const d=new Date(g.start||g.t);return `<tr><td>${d.getDate()}.${d.getMonth()+1}.<span class="tm">${g.start?'':'bis '}${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span></td><td class="${g.win?'w':'l'}">${g.win?'Sieg':'Niederlage'}</td><td>${lv[g.level]||g.level}</td><td>${g.us}\u202f:\u202f${g.them}</td><td>${fmtDur(g.dur,true)}</td></tr>`}).join('')+'</table></div>';
  }
  if(n)h+=marginStats(G);
  if(n)h+=finStats(G);
  h+=dealStats();
  $('statsBody').innerHTML=h;
}
// Pfeile der Joker-Leiste nur zeigen, wenn es in diese Richtung noch weitere Werte gibt
function updJkArrows(){
  const j=$('jokerPick'),L=$('jkL'),R=$('jkR');if(!L)return;
  const on=!j.hidden&&j.scrollWidth>j.clientWidth+2;
  L.hidden=!on||j.scrollLeft<4;R.hidden=!on||j.scrollLeft+j.clientWidth>=j.scrollWidth-4;
}
function undoMove(){
  if(!UNDO)return;
  UNDOS++;   // für die Statistik mitzählen
  GAME++; // laufende Computerzüge und Animationen abbrechen
  document.querySelectorAll('.flycard').forEach(e=>e.remove());
  {const N=JSON.parse(UNDO);if(N.phase==='exchange')uncountStuck();S=N;UNDO=null;}UI=freshUI();busy=false;WINFX.stop(true);
  if(S.phase==='exchange'){addLog('Du nimmst den Kartentausch zurück.','round');save();render();return}
  addLog('Du nimmst deinen letzten Zug zurück.','round');
  proceed();
}

// ---------- Rendering ----------
function render(msg){
  const ms=UI.temp||S.marbles;
  ms.forEach(m=>{const [x,y]=marblePt(ms,m);const t=`translate(${x}px,${y}px)`;$('m'+m.id).style.transform=t;$('ms'+m.id).style.transform=t});
  for(let p=0;p<4;p++){
    const l=$('lab'+p);const n=UI.dealt?UI.dealt[p]:S.hands[p].length;
    const starter=S.phase==='exchange'&&S.roundStart===p;
    const active=(S.phase==='play'&&S.turn===p)||starter;
    l.innerHTML='';l.setAttribute('class','lab'+(active?' active':''));
    const a=el('tspan',{class:'nm',style:`fill:var(--c${p})`},l);a.textContent=(active?'● ':'')+NAMES[p];
    const b=el('tspan',{x:l.getAttribute('x'),dy:'12',class:'cnt'},l);b.textContent=starter?(p===0?'beginnst':'beginnt'):(n===1?'1 Karte':n+' Karten');
  }
  renderCenter();renderHL();renderHand();renderStatus(msg);renderLog();
}
// Abgelegte Karten seit dem letzten Mischen (Stapel in der Mitte)
function pileCount(){if(!S||!S.deck)return 0;let h=0;for(const x of S.hands)h+=x.length;return Math.max(0,110-S.deck.length-h)}
function renderCenter(){
  const g=$('center');g.innerHTML='';drawDeck2D(g);if(!S.last)return;
  const {p,card,val}=S.last;
  const r=el('g',{transform:`translate(${C} ${C-6})`},g);
  const sg=el('g',{transform:`scale(${PS})`},r);
  {const k=Math.min(7,Math.ceil(pileCount()/10));for(let i=k;i>=1;i--)el('rect',{x:-30+i*1.2,y:-43+i*1.4,width:60,height:86,rx:9,class:'cstack'},sg)}
  for(const x of pileCards().reverse())drawCardSVG(el('g',{transform:`rotate(${pileRot(x.card)})`},sg),x.card);
  const t3=el('text',{x:0,y:48,'text-anchor':'middle',class:'cwho',style:`fill:var(--c${p})`},r);t3.textContent=(p===0?'du':NAMES[p])+(card.r==='JO'&&val?' · als '+rankLabel(val):'')+(S.last.fold?' · abgelegt':'');
}
// Aussetzen: die echten Karten fliegen offen nacheinander auf den Stapel und bleiben dort liegen
async function foldToPile(cards,p,rects){
  const g=GAME,gap={slow:300,normal:180,fast:110}[S.speed]||180,jobs=[];
  for(let i=0;i<cards.length;i++){
    const c=cards[i];
    jobs.push(flyToPile([c],p,true,rects&&rects[i]?[rects[i]]:null).then(()=>{if(g!==GAME)return;setLast({p,card:c,val:null,fold:true});renderCenter()}));
    if(i<cards.length-1)await sleep(gap);
    if(g!==GAME)return false;
  }
  await Promise.all(jobs);
  return g===GAME;
}
function renderHL(){
  const g=$('hl');g.innerHTML='';
  if(!UI.cand||busy)return;
  const ms=UI.temp;
  if(UI.sel!=null){
    const [x,y]=marblePt(ms,ms[UI.sel]);el('circle',{cx:x,cy:y,r:10.5,class:'selring'},g);
    for(const to of targetsFor(UI.sel)){const [tx,ty]=locPt(to);
      el('circle',{cx:tx,cy:ty,r:10,class:'target'},g);
      el('circle',{cx:tx,cy:ty,r:12,class:'hit','data-to':to},g)}
  }else if(UI.pend!=null){
    // Zielfeld gewählt, aber mehrere Murmeln kommen dorthin: nur diese zur Auswahl anbieten
    const [tx,ty]=locPt(UI.pend);el('circle',{cx:tx,cy:ty,r:10,class:'target'},g);
    for(const id of reachIds(UI.pend)){const [x,y]=marblePt(ms,ms[id]);
      el('circle',{cx:x,cy:y,r:10.5,class:'canring'},g);
      el('circle',{cx:x,cy:y,r:12,class:'hit','data-mid':id},g)}
    el('circle',{cx:tx,cy:ty,r:12,class:'hit','data-to':UI.pend},g);
    return;
  }
  const direct=directTargets(),own=new Set();
  for(const id of selectableIds()){
    if(id===UI.sel)continue;const [x,y]=marblePt(ms,ms[id]);
    el('circle',{cx:x,cy:y,r:10.5,class:'canring'},g);
    el('circle',{cx:x,cy:y,r:12,class:'hit','data-mid':id},g);own.add(Math.round(x)+','+Math.round(y));
  }
  // Ohne gewählte Murmel lassen sich die Zielfelder direkt antippen (dezent markiert).
  // Die Trefferflächen der Murmeln stehen davor, so gewinnt bei Gleichstand die Murmel.
  if(direct)for(const to of allTargets()){const [tx,ty]=locPt(to);if(own.has(Math.round(tx)+','+Math.round(ty)))continue;
    el('circle',{cx:tx,cy:ty,r:4.5,class:'ptarget'},g);
    el('circle',{cx:tx,cy:ty,r:12,class:'hit','data-to':to},g)}
  if(UI.sel!=null){const [x,y]=marblePt(ms,ms[UI.sel]);if(selectableIds().size>1)el('circle',{cx:x,cy:y,r:12,class:'hit','data-mid':UI.sel},g)}
}
function renderHand(){
  const h=$('hand');h.innerHTML='';
  const cards=UI.dealt?S.hands[0].slice(0,UI.dealt[0]):[...S.hands[0]].sort(handCmp);   // beim Austeilen in der Reihenfolge des Eintreffens, danach sortiert
  const myTurn=S.phase==='play'&&S.turn===0&&!busy;
  for(const c of cards){
    const b=document.createElement('button');b.className='card'+(isRed(c)?' red':'')+(c.r==='JO'?' joker':'');
    const playable=S.phase==='exchange'||(myTurn&&cardHasMoves(c.id));
    if(!playable&&S.phase==='play')b.classList.add('dim');
    if((S.phase==='exchange'&&UI.give===c.id)||(UI.card&&UI.card.id===c.id))b.classList.add('sel');
    if(UI.recv===c.id)b.classList.add('recv');if(UI.hide===c.id)b.style.visibility='hidden';if(UI.pop===c.id){b.classList.add('pop');UI.pop=null}
    b.disabled=busy||!(S.phase==='exchange'||myTurn);
    b.setAttribute('aria-label',cardLabel(c)+(c.r!=='JO'?' '+c.s:''));
    b.innerHTML=`<span class="r">${rankLabel(c.r)}</span><span class="s">${suitHTML(c)}</span>${UI.recv===c.id?`<span class="tag">von ${NAMES[2]}</span>`:''}`;
    b.dataset.id=c.id;b.onclick=()=>{if(performance.now()<dragSuppress)return;onCard(c.id)};b.onpointerdown=e=>cardDragStart(e,b,c.id);h.appendChild(b);
  }
  if(!cards.length){const p=document.createElement('p');p.className='empty';p.textContent=S.phase==='over'?'':'Keine Karten mehr in dieser Runde.';h.appendChild(p)}
  // joker picker
  const jp=$('jokerPick');jp.innerHTML='';
  if(UI.card&&UI.card.r==='JO'&&!busy){
    jp.hidden=false;
    for(const v of RORDER){if(v==='JO'||!S.legal.some(m=>m.card.id===UI.card.id&&m.val===v))continue;
      const b=document.createElement('button');b.textContent=rankLabel(v);b.title=VLABEL[v]||v;if(UI.val===v)b.className='on';
      b.onclick=()=>{if(UI.applied.length)return;selectVal(v)};jp.appendChild(b)}
  }else jp.hidden=true;
  requestAnimationFrame(updJkArrows);
  const act=$('actBtn');
  if(S.phase==='exchange'){act.hidden=DBL_MS>0;act.textContent=`Karte an ${NAMES[2]} geben`;act.disabled=UI.give==null}
  else act.hidden=true;
  $('cancelBtn').hidden=!(UI.card&&S.phase==='play'&&!busy);
  $('undoBtn').hidden=!UNDO;$('undoBtn').textContent=S.phase==='over'?'↶ Zurücknehmen':'↶ Letzten Zug zurücknehmen';$('newFloat').hidden=S.phase!=='over';
}
// Lange Texte der Statuszeile. Die Statuszeile reserviert immer die Höhe des längsten möglichen Textes (reserveStatus),
// damit das Brett nicht springt, wenn der Text wechselt. Neue lange Texte bitte in statusSamples() ergänzen.
const txtExchange=(starter,give)=>`${starter}. Tippe eine Karte ${DBL_MS>0?'zweimal kurz hintereinander':'zweimal'} oder wirf sie aufs Brett, um sie ${give} zu geben.`;
const txtOwnIn=name=>`Deine Murmeln sind im Ziel: Du fährst mit denen von ${name}. `;
function statusSamples(){
  const L=NAMES.reduce((a,b)=>b.length>a.length?b:a,'');           // längster Name
  return [`${L} gibt die Karten aus …`,txtExchange(`${L} beginnt`,L),`${L} ist am Zug …`,
    txtOwnIn(L)+'Tippe eine Karte an oder wirf sie aufs Brett.',
    'Keine deiner Karten ist spielbar. Du legst alle ab und setzt diese Runde aus.','Als welche Karte setzt du den Joker ein?',
    'Sieben: noch 7 Schritte. Wähle, wie weit sie fährt.','Mit welcher Murmel tauschen?','Du bist dran. Tippe eine Karte an oder wirf sie aufs Brett.'];
}
function reserveStatus(){
  const s=$('status');if(!s||!s.offsetWidth)return;
  const cs=getComputedStyle(s),pr=document.createElement('p');
  pr.style.cssText=`position:absolute;visibility:hidden;left:0;top:0;margin:0;width:${s.offsetWidth}px;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing}`;
  s.parentNode.appendChild(pr);let h=0;for(const t of statusSamples()){pr.textContent=t;h=Math.max(h,pr.offsetHeight)}pr.remove();
  const line=parseFloat(cs.lineHeight)||21.6;
  document.documentElement.style.setProperty('--statusH',Math.ceil(Math.max(h,2*line))+'px');       // mindestens zwei Zeilen
}
function watchStatusHeight(){
  let w=0;new ResizeObserver(()=>{const nw=$('status').offsetWidth;if(nw!==w){w=nw;reserveStatus()}}).observe($('status').parentNode);
  if(document.fonts){document.fonts.ready.then(reserveStatus);document.fonts.addEventListener('loadingdone',reserveStatus)}
  reserveStatus();
}
function renderStatus(msg){
  let t='';
  if(msg)t=msg;
  else if(S.phase==='over')t=S.winner===0?'Gewonnen!':'Verloren.';
  else if(UI.dealt){const d=(S.roundStart+3)%4;t=`${d===0?'Du gibst':NAMES[d]+' gibt'} die Karten aus …`}
  else if(S.phase==='exchange'){t=txtExchange(S.roundStart===0?'Du beginnst':NAMES[S.roundStart]+' beginnt',NAMES[2])}
  else if(S.turn!==0)t=`${NAMES[S.turn]} ist am Zug …`;
  else{
    const c=ctrlColor(S.marbles,0);const pre=c!==0?txtOwnIn(NAMES[2]):'';
    if(!UI.card)t=pre+(pre?'':'Du bist dran. ')+'Tippe eine Karte an oder wirf sie aufs Brett.';
    else if(UI.card.r==='JO'&&!UI.val)t='Als welche Karte setzt du den Joker ein?';
    else if(UI.val==='7'){const used=UI.applied.reduce((a,s)=>a+s.n,0);t=`Sieben: noch ${7-used} Schritt${7-used===1?'':'e'}. `+(UI.sel==null?'Wähle eine Murmel.':'Wähle, wie weit sie fährt.')}
    else if(UI.pend!=null)t=UI.val==='B'?'Welche deiner Murmeln tauscht?':'Welche Murmel soll dorthin?';
    else if(UI.val==='B')t=UI.sel==null?VLABEL.B+': Wähle deine Murmel oder direkt, mit wem du tauschst.':'Mit welcher Murmel tauschen?';
    else t=UI.sel==null?'Wähle eine Murmel oder direkt ihr Zielfeld.':'Wähle das Zielfeld.';
  }
  $('status').textContent=t;
}
function renderLog(){
  const l=$('log');l.innerHTML='';
  for(const e of S.log.slice(0,30)){const li=document.createElement('li');li.textContent=e.t;if(e.cls)li.className=e.cls;l.appendChild(li)}
}

// ---------- Über Ändi Dog / Kontakt ----------
const cardTxt=c=>c.r==='JO'?'Joker':c.r+c.s;
// Spielbrett als Text: Hände, Murmeln (Zwinger, Bahn 0–63, Ziel) und oberste Ablagekarte
function boardText(){
  const L=['Spielbrett: Phase '+S.phase+', am Zug '+NAMES[S.turn]+', Start der Runde '+NAMES[S.roundStart],'Bahnfelder 0–63, Start: '+[0,1,2,3].map(c=>NAMES[c]+' '+startOf(c)).join(', ')];
  for(let c=0;c<4;c++){
    const m=S.marbles.slice(c*4,c*4+4),k=m.filter(x=>x.loc==='K').length,t=m.filter(x=>x.loc==='T').map(x=>x.pos),g=m.filter(x=>x.loc==='G').map(x=>x.pos+1);
    L.push(`${withCol(c)}: Zwinger ${k}, Bahn ${t.length?t.join('/'):'–'}, Ziel ${g.length?g.join('/'):'–'}`);
  }
  L.push('Hände: '+[0,1,2,3].map(c=>NAMES[c]+' '+(S.hands[c].map(cardTxt).join(' ')||'–')).join('; '));
  if(S.last)L.push('Zuletzt gespielt: '+cardTxt(S.last.card)+' von '+NAMES[S.last.p]);
  return L.join('\n');
}
// Angaben für eine Fehlermeldung (zum Einfügen auf GitHub): Version, wahlweise Spielbrett und Spielverlauf
function reportText(withLog,withBoard){
  const parts=[$('appVer').textContent];
  if(withBoard&&S)parts.push(boardText());
  if(withLog&&S&&S.log.length)parts.push('Spielverlauf (neueste zuerst):\n'+S.log.map(e=>e.t).join('\n'));
  return parts.join('\n\n');
}
function openAbout(){
  $('aboutVer').textContent=$('appVer').textContent;
  $('reportLog').checked=$('reportBoard').checked=false;$('aboutDlg').showModal();
}

// ---------- Persistence ----------
function save(){try{const {legal,...rest}=S;rest.pms=Math.round(PLAYMS);rest.und=UNDOS;localStorage.setItem(SAVE_KEY,JSON.stringify(rest))}catch(e){}}
function load(){try{const s=localStorage.getItem(SAVE_KEY);return s?JSON.parse(s):null}catch(e){return null}}

// ---------- Init ----------
const SHOW_RULES=false; // true = „Regeln & Varianten“ (Menüeintrag und Regeln-Dialog) wieder einblenden; die Varianten stehen immer im Neues-Spiel-Dialog
// Einstellungen-Dialog: eine Zeile je Platz mit Name und Farbe. Wählt man eine Farbe, die schon vergeben ist, tauschen die beiden Plätze.
const SEAT_ROWS=[[0,'Du'],[2,'Partner'],[3,'Gegner links'],[1,'Gegner rechts']];
let DRAFT=null,SNAP=null,POP=null;
const THEME_KEY='aendi-dog-theme';
function applyTheme(v){const r=document.documentElement;if(v==='light'||v==='dark')r.dataset.theme=v;else delete r.dataset.theme;seatVars()}
function openSettings(){
  DRAFT=SEATS.map(s=>({...s}));
  SNAP={view:$('view').value,lvl:$('lvl').value,spd:$('spd').value,theme:$('theme').value,dbl:$('dbl').value,snd:$('snd').value,fx:$('fx').value}; // für „Abbrechen“
  renderSeatRows();closePop();$('setDlg').showModal();
}
// Ansicht, Gegner, Tempo und Darstellung wirken sofort; „Abbrechen“ (oder Escape) stellt sie zurück
function revertSettings(){
  if(!SNAP)return;
  for(const [id,v] of Object.entries(SNAP)){const el=$(id);if(el.value!==v){el.value=v;el.dispatchEvent(new Event('change'))}}
  SNAP=null;
}
function renderSeatRows(){
  const box=$('seatRows');box.innerHTML='';
  for(const [p,role] of SEAT_ROWS){
    const d=DRAFT[p];
    const lab=document.createElement('span');lab.className='seatRole';lab.textContent=role;lab.style.color=PALETTE[d.col].m[1];
    const inp=document.createElement('input');inp.type='text';inp.maxLength=12;inp.value=d.name;inp.placeholder=p===0?'Du':PALETTE[d.col].label;inp.autocomplete='off';
    inp.setAttribute('aria-label','Name: '+role);inp.oninput=()=>{d.name=inp.value};
    const cb=document.createElement('button');cb.type='button';cb.className='colBtn';cb.dataset.p=p;cb.style.setProperty('--sw',PALETTE[d.col].m[1]);
    cb.setAttribute('aria-haspopup','listbox');cb.setAttribute('aria-label','Farbe: '+role);
    cb.innerHTML='<span class="chip"></span><span class="caret">▾</span>';
    cb.onclick=e=>{e.stopPropagation();openColPop(p,cb)};
    box.append(lab,inp,cb);
  }
}
// Farbfeld: alle Farben als Kreise, ohne Namen. Eine schon belegte Farbe hat einen kleinen Punkt; wählt man sie, tauschen die beiden Spieler.
function openColPop(p,btn){
  const pop=$('colPop');
  if(POP===p){closePop();return}
  POP=p;pop.innerHTML='';
  for(const [k,c] of Object.entries(PALETTE)){
    const b=document.createElement('button');b.type='button';b.className='swatch';b.style.setProperty('--sw',c.m[1]);b.dataset.col=k;
    b.setAttribute('role','option');b.setAttribute('aria-label',c.label);b.setAttribute('aria-selected',String(DRAFT[p].col===k));
    if(DRAFT.some((x,q)=>q!==p&&x.col===k))b.classList.add('taken');
    b.onclick=e=>{e.stopPropagation();const d=DRAFT[p];if(d.col!==k){const o=DRAFT.find(x=>x!==d&&x.col===k);if(o){o.col=d.col;o.name=autoName(o.name,DRAFT.indexOf(o),o.col)}d.col=k;d.name=autoName(d.name,p,k)}closePop();renderSeatRows();$('seatRows').querySelector(`.colBtn[data-p="${p}"]`).focus()};
    pop.appendChild(b);
  }
  pop.hidden=false;
  const dlg=$('setDlg'),r=btn.getBoundingClientRect(),dr=dlg.getBoundingClientRect(),pw=pop.offsetWidth,ph=pop.offsetHeight;
  const below=r.bottom+6+ph<=dr.bottom-4;
  pop.style.top=((below?r.bottom+6:r.top-6-ph)-dr.top+dlg.scrollTop)+'px';
  pop.style.left=Math.max(8,Math.min(r.right-dr.left-pw,dr.width-pw-8))+'px';
  (pop.querySelector('[aria-selected="true"]')||pop.firstChild).focus();
}
function closePop(){const pop=$('colPop');if(pop)pop.hidden=true;POP=null}
function init(){
  buildBoard();
  watchStatusHeight();
  $('rulesBtn').hidden=!SHOW_RULES;
  $('lvl').onchange=e=>{S.level=e.target.value;save()};
  $('spd').onchange=e=>{S.speed=e.target.value;save()};
  // Neues Spiel: Regeln (Varianten) werden nur hier gewählt und gelten dann fürs ganze Spiel
  const RULES_KEY='aendi-dog-rules';
  const askNewGame=()=>{$('ngCan').checked=OPT.canadian;$('ngJok').checked=OPT.jokerNo8;$('ngWarn').hidden=!S||S.phase==='over';$('newDlg').showModal()};
  $('ngStart').onclick=()=>{OPT.canadian=$('ngCan').checked;OPT.jokerNo8=$('ngJok').checked;$('optCan').checked=OPT.canadian;$('optJok').checked=OPT.jokerNo8;
    try{localStorage.setItem(RULES_KEY,JSON.stringify({canadian:OPT.canadian,jokerNo8:OPT.jokerNo8}))}catch(e){}
    $('newDlg').close();newGame()};
  $('ngCancel').onclick=()=>$('newDlg').close();
  {const j=$('jokerPick');j.addEventListener('scroll',updJkArrows,{passive:true});addEventListener('resize',updJkArrows);
   $('jkR').onclick=()=>j.scrollBy({left:j.clientWidth*.7,behavior:'smooth'});
   $('jkL').onclick=()=>j.scrollBy({left:-j.clientWidth*.7,behavior:'smooth'})}
  $('newBtn').onclick=askNewGame;
  $('newFloat').onclick=askNewGame;
  // Spielende-Fenster: Tipp auf den Hintergrund schliesst es, damit man das Brett sieht
  // Spielende-Fenster: ein Tipp irgendwo schliesst es (ausser auf seine Knöpfe), damit man das Brett sieht.
  // pointerdown statt click, weil deaktivierte Handkarten kein click auslösen.
  document.addEventListener('pointerdown',()=>WINFX.stop(false),true);   // ein Tippen beendet die Gewinnanimation
  $('actBtn').onclick=()=>{if(S.phase==='exchange')doExchange()};
  $('cancelBtn').onclick=cancelMove;
  $('undoBtn').onclick=undoMove;
  $('rulesBtn').onclick=()=>{renderCardDemo();$('rules').showModal()};
  // Hamburger-Menü: öffnen/schliessen, Klick daneben oder Escape schliesst
  {const mb=$('menuBtn'),mn=$('menu');
   const close=()=>{mn.hidden=true;mb.setAttribute('aria-expanded','false');syncPause()};
   mb.onclick=e=>{e.stopPropagation();const open=mn.hidden;mn.hidden=!open;mb.setAttribute('aria-expanded',String(open));if(open){setPaused(true);(mn.querySelector('button')||mb).focus()}else syncPause()};
   for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',syncPause);
   document.addEventListener('click',e=>{if(!mn.hidden&&!mn.contains(e.target)&&!mb.contains(e.target))close()});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mn.hidden){close();mb.focus()}});
   $('rulesBtn').addEventListener('click',close);
   $('newBtn').addEventListener('click',()=>{if(!$('newBtn').dataset.armed)close()});
   $('statsBtn').addEventListener('click',()=>{close();openStats()});
   $('aboutBtn').addEventListener('click',()=>{close();openAbout()});
  $('aboutClose').onclick=()=>$('aboutDlg').close();
  $('reportCopy').onclick=async()=>{const t=reportText($('reportLog').checked,$('reportBoard').checked);let ok=false;try{await navigator.clipboard.writeText(t);ok=true}catch(e){}
    const b=$('reportCopy');b.textContent=ok?'Kopiert':'Kopieren nicht möglich';setTimeout(()=>b.textContent='Angaben kopieren',1800)};
  $('logBtn').addEventListener('click',()=>{close();renderLog();$('logDlg').showModal()});
   $('setBtn').addEventListener('click',()=>{close();openSettings()});
   $('logClose').onclick=()=>$('logDlg').close();}
  loadStats();
  $('statsClose').onclick=()=>$('stats').close();
  $('setSave').onclick=()=>{
    const seats=DRAFT.map((s,p)=>({name:autoName(s.name,p,s.col),col:s.col}));
    try{localStorage.setItem(THEME_KEY,$('theme').value);localStorage.setItem(DBL_KEY,$('dbl').value);localStorage.setItem(SND_KEY,$('snd').value);localStorage.setItem(FX_KEY,$('fx').value)}catch(e){}
    SNAP=null;closePop();
    if(JSON.stringify(seats)!==JSON.stringify(SEATS)){
      SEATS=seats;try{localStorage.setItem(SEATS_KEY,JSON.stringify(SEATS))}catch(e){}
      try{save()}catch(e){}
      location.reload();                      // Brett und 3D-Ansicht mit den neuen Namen und Farben neu aufbauen
      return;
    }
    $('setDlg').close();
  };
  $('setCancel').onclick=()=>{closePop();revertSettings();$('setDlg').close()};
  $('setDlg').addEventListener('cancel',e=>{if(POP!==null){e.preventDefault();closePop();return}revertSettings()}); // Escape
  $('setDlg').addEventListener('click',e=>{if(POP!==null&&!e.target.closest('#colPop'))closePop()});
  $('setReset').onclick=()=>{ // alles auf die Standardwerte; „Abbrechen“ macht es wieder rückgängig
    DRAFT=SEAT_DEF.map(s=>({...s}));closePop();renderSeatRows();
    for(const [id,v] of Object.entries({view:'2d',lvl:'hard',spd:'normal',theme:'auto',snd:'0',fx:'1',dbl:'500'})){const e=$(id);if(e.value!==v){e.value=v;e.dispatchEvent(new Event('change'))}}
  };
  {let t='auto';try{t=localStorage.getItem(THEME_KEY)||'auto'}catch(e){}
   $('theme').value=(t==='light'||t==='dark')?t:'auto';applyTheme($('theme').value);
   $('theme').onchange=e=>applyTheme(e.target.value)}
  {let v=500;try{const s=localStorage.getItem(DBL_KEY);if(s!==null&&[...$('dbl').options].some(o=>o.value===s))v=+s}catch(e){}
   DBL_MS=v;$('dbl').value=String(v);$('dbl').onchange=e=>{DBL_MS=+e.target.value;clearTimeout(GIVE_T);reserveStatus();render()}}
  {let s='0';try{s=localStorage.getItem(SND_KEY)||'0'}catch(e){}   // Standard: Töne aus
   SND.on=s!=='0';$('snd').value=SND.on?'1':'0';
   $('snd').onchange=e=>{SND.on=e.target.value==='1';if(SND.on){audio();setTimeout(()=>sndSet(),60)}}}
  {let f='1';try{f=localStorage.getItem(FX_KEY)||'1'}catch(e){}
   FX_ON=f!=='0';$('fx').value=FX_ON?'1':'0';$('fx').onchange=e=>{FX_ON=e.target.value==='1'}}
  $('teamLine').textContent=`Du${NAMES[0]!=='Du'?' ('+NAMES[0]+', '+COLNAME[0]+')':' ('+COLNAME[0]+')'} spielst mit ${withCol(2)} gegen ${withCol(3)} und ${withCol(1)}.`;
  {const rb=$('statsReset'),rc=$('statsConfirm'),closeRc=()=>{rc.hidden=true;rb.hidden=false};
   rb.onclick=()=>{rb.hidden=true;rc.hidden=false;$('statsNo').focus()};
   $('statsNo').onclick=closeRc;
   $('statsYes').onclick=()=>{STATS={games:[]};saveStats();closeRc();renderStats()};
   $('stats').addEventListener('close',closeRc)}
  $('rulesClose').onclick=()=>$('rules').close();
  const syncOpt=()=>{OPT.canadian=$('optCan').checked;OPT.jokerNo8=$('optJok').checked;if(S){S.opts={...OPT};if(S.phase==='play'&&S.turn===0&&!busy){S.legal=legalMoves(S.marbles,0,S.hands[0],false);UI=freshUI(true);render()}save()}};
  $('optCan').onchange=syncOpt;$('optJok').onchange=syncOpt;
  const saved=load();
  if(saved&&saved.phase!=='over'&&saved.marbles){
    S=saved;S.deckStyle='fr'; // nur noch französische Karten
    PLAYMS=S.pms||0;PLAY_LAST=performance.now();UNDOS=S.und||0;
    // Tempo-Stufen wurden verschoben (neu: Normal = früher Zügig). Gespeichertes Tempo einmalig umrechnen, damit es sich gleich anfühlt.
    if(!S.spdV2){S.speed={slow:'slow',normal:'slow',fast:'normal'}[S.speed]||'normal';S.spdV2=1}
    $('lvl').value=S.level||'hard';$('spd').value=S.speed||'normal';
    if(S.opts){OPT.canadian=!!S.opts.canadian;OPT.jokerNo8=!!S.opts.jokerNo8;$('optCan').checked=OPT.canadian;$('optJok').checked=OPT.jokerNo8}
    if(S.phase==='exchange')render();else proceed();
  }else{S=null;try{const r=JSON.parse(localStorage.getItem(RULES_KEY)||'null');if(r){OPT.canadian=!!r.canadian;OPT.jokerNo8=!!r.jokerNo8;$('optCan').checked=OPT.canadian;$('optJok').checked=OPT.jokerNo8}}catch(e){}
    NO_DEAL_STATS=true;SND.quiet=true;newGame();NO_DEAL_STATS=false; // Platzhalter-Spiel hinter dem ersten Dialog nicht zählen
    askNewGame();$('ngWarn').hidden=true}
}
init();


// Für die 3D-Ansicht (view3d.ts)
export { $, C, DECK_SCALE, MCOL, NAMES, P, PS, S, SUIT_CH, SYMS, TP, UI, busy, deckPos, el, goalPt, isCH, isRed, kennelPt, onBoardClick, pileCards, pileCount, pileRot, pts, rankLabel, rot, seatPt };
export function setSeatPt(f) { seatPt = f; }
