// @ts-nocheck
/**
 * App: Oberfläche, Spielablauf, Lernen und Statistik.
 *
 * Diese Datei ist 1:1 der Stand der spielbaren Vorschau (Artifact) und deshalb noch untypisiert
 * (@ts-nocheck). Die Spiellogik liegt typisiert und getestet in engine.ts. Wenn du hier etwas
 * änderst und es typisieren möchtest: @ts-nocheck entfernen und die Meldungen von `npm run check`
 * Abschnitt für Abschnitt abarbeiten.
 *
 * Abschnitte (Suche nach „// =====“):
 *   UI ............ Konstanten, Geometrie des Bretts, Austeilen, Spielablauf, Bedienung, Anzeige
 *   Grün lernt .... Stil- und Tausch-Lernen, Rückfragen
 *   Statistik ..... Aufzeichnung und Diagramme
 *   init() ........ Start, Menü, Dialoge (ganz unten)
 */
import { ALLV, GIVE0, OPT, SIZES, W0, aiChoose, aiGive, applyAll, applySeg, cloneMs, ctrlColor, feats, giveCtx, giveFeat, giveVal, initMarbles, keepCost, legalMoves, makeDeck, partnerGoalPen, ruleGive, scoreF, startOf, teamOf, teamWon } from './engine';

// ===== UI =====
const NAMES=['Du','Rot','Grün','Gelb'];
const COLNAME=['Blau','Rot','Grün','Gelb'];
const MCOL=[['#7fa6ff','#2b5fd9','#173a8f'],['#ff8c84','#d23b33','#7e1a15'],['#7fe0ad','#1e9a5a','#0d5531'],['#ffe17a','#e2a908','#8a6200']];
const VLABEL_FR={A:'Ass',B:'Bube',D:'Dame',K:'König',JO:'Joker'};
const VLABEL_CH={A:'Ass',B:'Under',D:'Ober',K:'König',JO:'Joker'};
const SUIT_CH={'♠':'s-sil','♥':'s-ros','♦':'s-sch','♣':'s-eic'};
const isCH=()=>!!(S&&S.deckStyle==='ch');
const VLABEL=new Proxy({},{get:(t,k)=>(isCH()?VLABEL_CH:VLABEL_FR)[k]});
const rankLabel=r=>r==='JO'?'Joker':isCH()?(r==='B'?'U':r==='D'?'O':r):(r==='B'?'J':r);
function suitHTML(c){if(c.r==='JO')return '★';if(!isCH())return c.s;return `<svg class="si" viewBox="0 0 24 24" aria-hidden="true"><use href="#${SUIT_CH[c.s]}"/></svg>`}
const SYMS=`<symbol id="s-sch" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" fill="none" stroke="#7a5200" stroke-width="1.2"/><circle cx="12" cy="13.5" r="7.5" fill="#e8b417" stroke="#7a5200" stroke-width="1.2"/><path d="M4.8 11.5h14.4" stroke="#c0392b" stroke-width="2.4"/><circle cx="12" cy="16.5" r="1.6" fill="#7a5200"/><path d="M12 17v3.5" stroke="#7a5200" stroke-width="1.3"/></symbol><symbol id="s-ros" viewBox="0 0 24 24"><g fill="#c0392b" stroke="#6e1a12" stroke-width=".8"><circle cx="12" cy="5.5" r="4"/><circle cx="18.5" cy="12" r="4"/><circle cx="12" cy="18.5" r="4"/><circle cx="5.5" cy="12" r="4"/></g><circle cx="12" cy="12" r="5" fill="#e8b417" stroke="#6e1a12" stroke-width=".8"/><circle cx="12" cy="12" r="1.7" fill="#2e7d32"/></symbol><symbol id="s-sil" viewBox="0 0 24 24"><path d="M4 3h16v8c0 5.5-3.6 8.8-8 10.5C7.6 19.8 4 16.5 4 11z" fill="#e8b417" stroke="#333" stroke-width="1.2"/><path d="M4.6 3.6h14.8v5.4H4.6z" fill="#222"/><path d="M12 9v12" stroke="#c0392b" stroke-width="3"/></symbol><symbol id="s-eic" viewBox="0 0 24 24"><path d="M12 1.5v4" stroke="#4e342e" stroke-width="1.6"/><ellipse cx="12" cy="15" rx="5.5" ry="7" fill="#e0a526" stroke="#6d4c1f" stroke-width="1"/><path d="M5.5 10.5c0-3.5 2.8-5.5 6.5-5.5s6.5 2 6.5 5.5c-2 1.2-4.2 1.6-6.5 1.6s-4.5-.4-6.5-1.6z" fill="#6d4c1f"/><path d="M8 8.2h8M6.8 9.9h10.4" stroke="#3e2723" stroke-width=".7"/></symbol>`;
const RORDER=[...ALLV,'JO'];
const SAVE_KEY='braendi-dog-v2';
const C=200,NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let S=null,UI=freshUI(),busy=false,TP=[];
function freshUI(k){return {card:null,val:null,cand:null,k:0,temp:null,sel:null,applied:[],give:null,recv:k&&UI?UI.recv:null}}
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
  svg.addEventListener('click',onBoardClick);
}

// ---------- Game flow ----------
let UNDO=null; // Spielstand vor deinem letzten Zug (nur ein Schritt)
let GAME=0; // wird bei jedem neuen Spiel erhöht; laufende Animationen des alten Spiels brechen dann ab
function newGame(){
  GAME++;UNDO=null;ASK=null;if(typeof renderAsk==='function')renderAsk();
  const keep=S?{level:S.level,speed:S.speed,deckStyle:'fr',spdV2:1}:{level:$('lvl').value,speed:$('spd').value,deckStyle:'fr',spdV2:1};
  S={opts:{canadian:OPT.canadian,jokerNo8:OPT.jokerNo8},marbles:initMarbles(),hands:[[],[],[],[]],deck:[],cycle:0,nextStart:0,roundStart:0,turn:0,phase:'exchange',gives:[null,null,null,null],last:null,log:[],winner:null,...keep};
  UI=freshUI();UI.recv=null;busy=false;$('over').hidden=true;
  startRound();
}
// Neue Runde: Der Geber (rechts vor dem Startspieler) teilt im Gegenuhrzeigersinn aus, in Päckchen:
// 6 = 3+3, 5 = 3+2, 4 = 3+1, 3 = 3, 2 = 2. Gemischt wird nur, wenn der Stapel nicht mehr für die ganze
// Runde reicht – dann alle 110 Karten (wie am Tisch: der Reststapel wird weiterverwendet).
async function startRound(){
  const g=GAME;
  const n=SIZES[S.cycle%5];S.cycle++;
  S.roundStart=S.nextStart;S.nextStart=(S.nextStart+1)%4;
  const dealer=(S.roundStart+3)%4,order=[1,2,3,4].map(i=>(dealer+i)%4),packs=n===6?[3,3]:n===5?[3,2]:n===4?[3,1]:[n];
  let shuffled=false;
  if(!S.deck||S.deck.length<n*4){S.deck=makeDeck();S.last=null;S.under=[];shuffled=true}
  for(const k of packs)for(const p of order)for(let i=0;i<k;i++)S.hands[p].push(S.deck.pop());
  S.phase='exchange';S.gives=[null,null,null,null];
  for(let p=1;p<4;p++)S.gives[p]=aiGive(S.marbles,p,S.hands[p],p===2&&LEARN.on?LEARN.g:null,p===2||S.level==='hard').id;
  UI=freshUI();UI.recv=null;
  const who=dealer===0?'Du':NAMES[dealer];
  if(shuffled)addLog(`${who} ${dealer===0?'mischst':'mischt'} alle 110 Karten neu.`,'round');
  addLog(`Neue Runde mit ${n} Karten. ${who} ${dealer===0?'gibst':'gibt'}, ${S.roundStart===0?'du beginnst':NAMES[S.roundStart]+' beginnt'}. Im Stapel: ${S.deck.length} Karten.`,'round');
  save();
  await dealAnim(packs,order,dealer,g);
  if(g!==GAME)return;
  render();
}
// Austeilen sichtbar machen: verdeckte Karten fliegen vom Geber zu den Spielern; deine drehen sich in der Hand auf
async function dealAnim(packs,order,dealer,g){
  UI.dealt=[0,0,0,0];busy=true;render();
  const dur={slow:400,normal:230,fast:132}[S.speed]||230,from=deckScreenPt(),fs=pileScale()*16/(60*PS),jobs=[],cw=cardW();
  for(const k of packs)for(const p of order){
    const base=UI.dealt[p]+jobs.filter(j=>j.p===p&&!j.done).length,hr=$('hand').getBoundingClientRect();
    for(let i=0;i<k;i++){
      const to=p===0?[hr.left+(base+i)*(cw+7)+cw/2,hr.top+hr.height/2,1,0]:[...seatPt(p),.5,(i-(k-1)/2)*9];
      const job={p,done:false};
      job.pr=flyCard('','back',[...from,fs,-90*dealer],to,dur,i*60).then(()=>{job.done=true;if(g!==GAME)return;UI.dealt[p]++;render()});
      jobs.push(job);
    }
    await sleep(dur*.55);if(g!==GAME)return;
  }
  await Promise.all(jobs.map(j=>j.pr));
  if(g!==GAME)return;
  UI.dealt=null;busy=false;
}
async function doExchange(){
  if(UI.give==null||busy)return;
  {const {legal,...r}=S;UNDO=JSON.stringify(r)} // Tauschkarten der Computer stecken schon in S.gives und bleiben beim Undo gleich
  ASK=null;try{checkGiveLearn(S.marbles,S.hands[0],UI.give)}catch(e){console.error(e)}
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
  if(o)jobs.push(flyCard(gHtml,gCls,[o.left+o.width/2,o.top+o.height/2,1],[...seatPt(2),0.55,-10],dur,0));
  const tb=document.querySelector(`#hand .card[data-id="${UI.hide}"]`),tr=tb&&tb.getBoundingClientRect();
  const hr=$('hand').getBoundingClientRect();
  jobs.push(flyCard('','back',[...seatPt(2),0.55,8],tr?[tr.left+tr.width/2,tr.top+tr.height/2,1,0]:[hr.right-34,hr.top+46,1,0],dur,140));
  jobs.push(flyCard('','back',[...seatPt(1),0.55,90],[...seatPt(3),0.55,270],dur,70));
  jobs.push(flyCard('','back',[...seatPt(3),0.55,-90],[...seatPt(1),0.55,90],dur,210));
  await Promise.all(jobs);
  if(g!==GAME)return render();
  UI.hide=null;
  const nb=document.querySelector(`#hand .card[data-id="${moving[2].id}"]`);if(nb){nb.style.visibility='';nb.classList.add('pop')}
  busy=false;
  S.phase='play';S.turn=S.roundStart;
  addLog(`Karten getauscht. Du hast Grün ${artikel(moving[0])} gegeben, Grün dir ${artikel(moving[2])}.`);
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
function deckPos(){const d=(S.roundStart+3)%4,[x,y]=rot(d,46,62);return {d,x:C+x,y:C+y}}
function deckScreenPt(){
  const {d,x,y}=deckPos();
  try{if(window.__v3&&__v3.mode!=='2d'){const s=__v3.scr(x,y,3),bx=document.querySelector('.boardBox').getBoundingClientRect();
    return s&&s[0]>bx.left&&s[0]<bx.right&&s[1]>bx.top&&s[1]<bx.bottom?s:seatPt(d)}}catch(e){}
  const svg=$('board'),pt=svg.createSVGPoint();pt.x=x;pt.y=y;const r=pt.matrixTransform(svg.getScreenCTM());return [r.x,r.y];
}
function drawDeck2D(g){
  if(!S.deck||!S.deck.length||S.phase==='over')return;
  const {d,x,y}=deckPos(),k=Math.max(1,Math.min(6,Math.ceil(S.deck.length/18)));
  const dg=el('g',{transform:`translate(${x} ${y}) rotate(${-90*d})`},g);
  for(let i=k-1;i>=0;i--)el('rect',{x:-8+i*.7,y:-11-i*.9,width:16,height:22,rx:2.5,class:'deckc'},dg);
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
    return faceUp?flyCard(cardHTML(c),cardCls(c),fr,pileLandTf(c)||[...to,ps,rot],dur,i*90,[SH_FLY,SH_PILE]):flyCard('','back',fr,[...to,ps,rot+(i%2?6:-6)],dur,i*90);
  }));
}
function seatPt(p){const svg=$('board');const pt=svg.createSVGPoint();const [a,b]=rot(p,0,150);pt.x=C+a;pt.y=C+b;const r=pt.matrixTransform(svg.getScreenCTM());return [r.x,r.y]}
function flyCard(html,cls,from,to,dur,wait,sh){
  const e=document.createElement('div');e.className='flycard '+cls;e.innerHTML=html;document.body.appendChild(e);
  const hw=e.offsetWidth/2,hh=e.offsetHeight/2;
  const T=q=>q.tf||`translate(${q[0]-hw}px,${q[1]-hh}px) scale(${q[2]||1}) rotate(${q[3]||0}deg)`;
  const k0={transform:T(from)},k1={transform:T(to)};if(sh){k0.boxShadow=sh[0];k1.boxShadow=sh[1]}
  const a=e.animate([k0,k1],{duration:dur,delay:wait||0,easing:'cubic-bezier(.5,.05,.3,1)',fill:'both'});
  return a.finished.then(()=>e.remove(),()=>e.remove());
}
async function animateExchange(giveId){
  const dur={slow:1150,normal:650,fast:367}[S.speed]||650;
  const btn=document.querySelector(`#hand .card[data-id="${giveId}"]`);
  const hr=$('hand').getBoundingClientRect();
  const jobs=[];
  if(btn){const r=btn.getBoundingClientRect();const html=btn.innerHTML.replace(/<span class="tag">.*?<\/span>/,'');btn.style.visibility='hidden';
    jobs.push(flyCard(html,'card'+(btn.classList.contains('red')?' red':'')+(btn.classList.contains('joker')?' joker':''),[r.left+r.width/2,r.top+r.height/2,1],[...seatPt(2),0.55,-10],dur,0))}
  const n=S.hands[0].length;
  const handEnd=[Math.min(hr.right-34,hr.left+(n-1)*68+30),hr.top+46];
  jobs.push(flyCard('','back',[...seatPt(2),0.55,8],[...handEnd,1,0],dur,140));
  jobs.push(flyCard('','back',[...seatPt(1),0.55,90],[...seatPt(3),0.55,270],dur,70));
  jobs.push(flyCard('','back',[...seatPt(3),0.55,-90],[...seatPt(1),0.55,90],dur,210));
  await Promise.all(jobs);
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
      {const g=GAME;setTimeout(async()=>{if(g!==GAME)return;const old=handRects(),cs=S.hands[0];S.hands[0]=[];render();
        await flyToPile(cs,0,false,cs.map(c=>old.get(c.id)));if(g!==GAME)return render();
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
  const mv=aiChoose(S.marbles,p,S.hands[p],S.level,p===2&&LEARN.on?LEARN.w:null);
  if(!mv){const cs=S.hands[p];S.hands[p]=[];render();await flyToPile(cs,p,false);if(g!==GAME)return render();S.hands[p]=cs;fold(p);render();await sleep(delay()*0.3)}
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
  if(teamWon(S.marbles,teamOf(p))){S.phase='over';S.winner=teamOf(p);try{recordGame()}catch(e){console.error(e)}save();render();showOver();return}
  S.turn=(p+1)%4;proceed();
}
async function animateSeg(ms,seg){
  const w=cloneMs(ms),m=w[seg.m];
  const toTop=id=>{const e=$('m'+id);e.parentNode.appendChild(e);e.getBoundingClientRect()};
  if(seg.t==='sw')toTop(seg.o);toTop(m.id);
  const place=(x,dur,lift)=>{const e=$('m'+x.id),sh=$('ms'+x.id);e.style.transitionDuration=sh.style.transitionDuration=dur+'ms';const [px,py]=marblePt(w,x);e.style.transform=sh.style.transform=`translate(${px}px,${py}px)`+(lift?' scale(1.2)':'')};
  if(seg.t==='sw'){const o=w[seg.o];const l=m.loc,p=m.pos;m.loc=o.loc;m.pos=o.pos;o.loc=l;o.pos=p;place(m,750,true);place(o,750,true);await sleep(770);place(m,150);place(o,150);await sleep(160);for(const x of w){$('m'+x.id).style.transitionDuration='';$('ms'+x.id).style.transitionDuration=''}return}
  const steps=[];
  if(seg.t==='out')steps.push({loc:'T',pos:startOf(m.color),kill:true});
  else if(m.loc==='G'){for(let i=m.pos+1;i<=seg.end.pos;i++)steps.push({loc:'G',pos:i})}
  else{seg.tp.forEach((q,i)=>steps.push({loc:'T',pos:q,kill:seg.seven||(i===seg.tp.length-1&&seg.end.loc==='T')}));
    if(seg.end.loc==='G')for(let i=0;i<=seg.end.pos;i++)steps.push({loc:'G',pos:i})}
  const dur=seg.t==='out'?stepMs()*3:stepMs();
  $('m'+m.id).classList.add('moving');
  for(const st of steps){
    m.loc=st.loc;m.pos=st.pos;
    if(st.kill){const o=w.find(x=>x!==m&&x.loc==='T'&&x.pos===st.pos);if(o){o.loc='K';o.pos=0}}
    for(const x of w)if(x!==m)place(x,650);
    place(m,dur,true);
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
  const foreign=mc!==p?` mit ${COLNAME[mc]}`:'';
  let what;
  if(s0.t==='out')what=p===0?'bringst eine Murmel auf den Start':'bringt eine Murmel auf den Start';
  else if(s0.t==='sw')what=(p===0?'tauschst':'tauscht')+foreign+` mit ${COLNAME[before[s0.o].color]}`;
  else if(mv.val==='7'){const goals=mv.segs.filter(s=>s.end.loc==='G'&&before[s.m].loc!=='G').length;what=(p===0?'teilst':'teilt')+' die Sieben'+(mv.segs.length>1?` auf ${mv.segs.length} Murmeln`:'')+foreign+(goals?`, ${goals} ins Ziel`:'')}
  else if(s0.n<0)what=(p===0?'fährst':'fährt')+foreign+' 4 zurück';
  else what=(p===0?'fährst':'fährt')+foreign+' '+s0.n+(s0.end.loc==='G'&&before[s0.m].loc!=='G'?' ins Ziel':'');
  let txt=`${who}: ${lab} – ${what}.`;
  if(killed.length){txt+=' '+killed.map(id=>COLNAME[id>>2]).join(' und ')+(killed.length>1?' müssen':' muss')+' zurück in den Zwinger.'}
  return txt;
}
function addLog(t,cls){S.log.unshift({t,cls:cls||''});if(S.log.length>60)S.log.pop()}

// ---------- Human interaction ----------
function cardHasMoves(id){return S.legal&&S.legal.some(m=>m.card.id===id)}
function onCard(id){
  if(busy)return;
  if(S.phase==='exchange'){if(UI.give===id){doExchange();return}UI.give=id;render();return}
  if(S.phase!=='play'||S.turn!==0)return;
  if(UI.card&&UI.card.id===id&&!UI.applied.length){UI=freshUI(true);render();return}
  if(!cardHasMoves(id))return;
  const card=S.hands[0].find(c=>c.id===id);
  UI=freshUI(true);UI.card=card;
  if(card.r==='JO'){render();return}
  selectVal(card.r);
}
function selectVal(v){
  UI.val=v;UI.cand=S.legal.filter(m=>m.card.id===UI.card.id&&m.val===v);
  UI.k=0;UI.temp=cloneMs(S.marbles);UI.applied=[];UI.sel=null;
  if(UI.cand.some(c=>!c.segs.length)){commitHuman();return}
  autoSel();render();
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
function onBoardClick(e){
  const t=e.target.closest('[data-to],[data-mid]');if(!t||busy||!UI.cand)return;
  if(t.dataset.to){chooseTarget(t.dataset.to);return}
  const id=+t.dataset.mid;UI.sel=UI.sel===id&&selectableIds().size>1?null:id;render();
}
async function chooseTarget(to){
  const sel=UI.sel;if(sel==null)return;
  const match=UI.cand.filter(c=>{const s=c.segs[UI.k];return s&&segMatchMarble(s,sel)&&s.to===to});
  if(!match.length)return;
  const seg={...match[0].segs[UI.k]};if(seg.t==='out')seg.m=sel;
  UI.cand=match;UI.k++;UI.applied.push(seg);UI.sel=null;
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
  if(UI.cand.some(c=>c.segs.length===UI.k)){await commitHuman();return}
  autoSel();render();
}
async function commitHuman(){
  const flown=!!UI.prevLast;
  {const {legal,...r}=S;if(flown){r.last=UI.prevLast.last;r.under=UI.prevLast.under}UNDO=JSON.stringify(r)}
  const legalAll=S.legal;ASK=null;renderAsk();
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
  try{checkLearn(before,legalAll,mv)}catch(e){console.error(e)}
  {const g=GAME;await sleep(250);if(g!==GAME)return render();}busy=false;afterMove(0);
}
function cancelMove(){if(busy)return;if(UI.prevLast){S.last=UI.prevLast.last;S.under=UI.prevLast.under}UI=freshUI(true);render()}
// ===== Grün lernt von dir =====
// Jeder deiner Züge wird mit dem Zug verglichen, den Grün nach seinen (gelernten) Gewichten
// gewählt hätte. Kleine Abweichungen lernt er still, grosse nur nach Rückfrage.
// Lernregel: passiv-aggressives Update – die Gewichte werden gerade so weit verschoben,
// dass dein Zug vor seinem landet (begrenzt, damit ein einzelner Zug nicht alles umwirft).
const LEARN_KEY='aendi-dog-learn',WKEYS=['R','A','G','O','H','C'];
const WS={R:20,A:20,G:1,O:1,H:1,C:8};
const WLIM={R:[-1.5,0],A:[0,0.8],G:[-15,40],O:[-15,30],H:[-10,40],C:[-2.5,0]};
const ASK_GAP=6;
const freshGive=()=>({B:{...GIVE0.B},S1:GIVE0.S1,S2:GIVE0.S2});
let LEARN={on:false,w:{...W0},n:0,yes:0,no:0,g:freshGive(),gn:0},ASK=null;
function loadLearn(){try{const s=JSON.parse(localStorage.getItem(LEARN_KEY)||'null');if(s&&s.w){const g=freshGive();if(s.g){Object.assign(g.B,s.g.B||{});if(typeof s.g.S1==='number')g.S1=s.g.S1;if(typeof s.g.S2==='number')g.S2=s.g.S2}LEARN={...LEARN,...s,w:{...W0,...s.w},g,gn:s.gn||0}}}catch(e){}}
function saveLearn(){try{localStorage.setItem(LEARN_KEY,JSON.stringify(LEARN))}catch(e){}}
function moveFeats(ms,p,mv){const f=feats(applyAll(ms,mv.segs).ms,p);f.C=keepCost(mv.card,mv.val,ms,p);f.P=partnerGoalPen(ms,p,mv.segs);return f}
const scoreMv=(f,W)=>scoreF(f,W)+W.C*f.C-f.P;
function learnFrom(fu,fa,gap,cap){
  const z={};let n2=0;
  for(const k of WKEYS){z[k]=(fu[k]-fa[k])/WS[k];n2+=z[k]*z[k]}
  if(n2<1e-6)return false; // Unterschied nur im Fortschritt – daraus lässt sich kein Stil ablesen
  const tau=Math.min(cap,(gap+2)/n2);
  for(const k of WKEYS)LEARN.w[k]=Math.max(WLIM[k][0],Math.min(WLIM[k][1],LEARN.w[k]+tau*z[k]/WS[k]));
  LEARN.n++;saveLearn();return true;
}
function explainDiff(fu,fa){
  const t=[];
  if(fu.H>fa.H)t.push('schlägst lieber einen Gegner');else if(fu.H<fa.H)t.push('verzichtest aufs Schlagen');
  if(fu.G>fa.G)t.push('bringst mehr Murmeln ins Ziel');else if(fu.G<fa.G)t.push('lässt eine Murmel vor dem Ziel stehen');
  if(fu.O>fa.O)t.push('bringst eine Murmel mehr raus');else if(fu.O<fa.O)t.push('bringst weniger Murmeln raus');
  if(fu.R>fa.R+3)t.push('gehst mehr Risiko ein');else if(fu.R<fa.R-3)t.push('spielst sicherer');
  if(fu.A>fa.A+3)t.push('stellst dich angriffslustiger auf');
  if(fu.C>fa.C+1)t.push('setzt eine wertvolle Karte früher ein');else if(fu.C<fa.C-1)t.push('sparst eine wertvolle Karte');
  if(!t.length)t.push(fu.M<fa.M?'fährst weniger weit':'spielst anders');
  return 'Du '+(t.length>1?t.slice(0,-1).join(', ')+' und '+t[t.length-1]:t[0])+'.';
}
function checkLearn(ms,legal,mv){
  if(!legal||legal.length<2)return;
  const W=LEARN.on?LEARN.w:W0;let best=null,bf=null,bs=-1e9;
  for(const m of legal){const f=moveFeats(ms,0,m),s=scoreMv(f,W);if(s>bs){bs=s;best=m;bf=f}}
  const fu=moveFeats(ms,0,mv),gap=bs-scoreMv(fu,W);
  {const s=st();s.checked++;if(gap<=0.5)s.agreed++;if(LEARN.on)s.lon=(s.lon||0)+1}
  if(!LEARN.on)return;
  if(gap<=0.5)return;                                       // Grün hätte gleich gut gespielt
  if(gap<ASK_GAP){learnFrom(fu,bf,gap,0.8);return}           // kleine Abweichung: still mitlernen
  const alt=describe(0,best,applyAll(ms,best.segs).killed,ms).replace(/^Du: /,'');
  ASK={txt:`Nach Grüns Regeln wäre ein anderer Zug besser gewesen: ${alt} ${explainDiff(fu,bf)} Soll Grün das so lernen?`,yes:()=>learnFrom(fu,bf,gap,3)};
  renderAsk();
}
function renderAsk(){const b=$('learnAsk');if(!b)return;b.hidden=!ASK;if(ASK)$('learnTxt').textContent=ASK.txt}
// --- Tauschen lernen: deine Tauschkarte gegen die, die Grün an deiner Stelle gegeben hätte
function learnGive(u,a,x,gap,cap){
  const fu=giveFeat(u,x),fa=giveFeat(a,x),d={};
  if(fu.r!==fa.r){d['B:'+fu.r]=1;d['B:'+fa.r]=-1}
  d.S1=fu.f1-fa.f1;d.S2=fu.f2-fa.f2;
  let n2=0;for(const k in d)n2+=d[k]*d[k];if(n2<1e-6)return;
  const tau=Math.min(cap,(gap+2)/n2),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const k in d){if(!d[k])continue;
    if(k[0]==='B'){const r=k.slice(2);LEARN.g.B[r]=cl(LEARN.g.B[r]-tau*d[k],0,120)}
    else if(k==='S1')LEARN.g.S1=cl(LEARN.g.S1-tau*d[k],-60,10);else LEARN.g.S2=cl(LEARN.g.S2-tau*d[k],-20,80)}
  LEARN.gn=(LEARN.gn||0)+1;saveLearn();
}
function checkGiveLearn(ms,hand,giveId){
  if(!LEARN.on||hand.length<2)return;
  if(ruleGive(ms,0,hand))return; // hier gilt eine deiner festen Tauschregeln – nichts zu lernen
  const G=LEARN.g,x=giveCtx(ms,0,hand),u=hand.find(c=>c.id===giveId);if(!u)return;
  let a=null,av=1e9;for(const c of hand){const v=giveVal(c,x,G);if(v<av){av=v;a=c}}
  const gap=giveVal(u,x,G)-av;
  if(gap<=0.5)return;                                  // Grün hätte gleich getauscht
  if(gap<6){learnGive(u,a,x,gap,3);return}            // kleine Abweichung: still mitlernen
  const fu=giveFeat(u,x),fa=giveFeat(a,x);
  const why=fu.f1&&!fa.f1?' Du hilfst Grün mit einer Startkarte, weil er keine Murmel draussen hat.'
    :fa.f1&&!fu.f1?' Du behältst die Startkarte, obwohl Grün keine Murmel draussen hat.':'';
  ASK={txt:`Grün hätte an deiner Stelle ${artikel(a)} gegeben. Du gibst ${artikel(u)} und behältst dafür ${artikel(a)}.${why} Soll Grün beim Tauschen so entscheiden?`,yes:()=>learnGive(u,a,x,gap,8)};
  renderAsk();
}
function giveInfo(){
  if(!LEARN.gn)return '';
  const g=LEARN.g,t=[];
  if(g.S1<GIVE0.S1-5)t.push('gibt dir eher eine Startkarte, wenn du keine Murmel draussen hast');else if(g.S1>GIVE0.S1+5)t.push('behält Startkarten eher für sich');
  for(const r in GIVE0.B){const dl=g.B[r]-GIVE0.B[r];if(dl<-5)t.push(`gibt ${artikel({r})} eher weiter`);else if(dl>5)t.push(`behält ${artikel({r})} eher`)}
  return ` Beim Tauschen ${LEARN.gn}× gelernt`+(t.length?': Grün '+(t.length>1?t.slice(0,-1).join(', ')+' und '+t[t.length-1]:t[0])+'.':', noch ohne deutlichen Unterschied.');
}
function learnInfo(){
  const el=$('learnInfo');if(!el)return;
  const on=$('newDlg').open?$('optLearn').checked:LEARN.on; // im Dialog gilt die Auswahl, die noch nicht gespeichert ist
  if(!LEARN.n&&!LEARN.no&&!LEARN.gn){el.textContent=on?'Noch nichts gelernt. Spiel einfach – Grün schaut zu.':'Ausgeschaltet. Grün spielt nach den Standardregeln.';return}
  const w=LEARN.w,t=[];
  if(w.H>2)t.push('schlägt lieber Gegner');else if(w.H<-2)t.push('schont Gegner eher');
  if(w.G>2)t.push('bringt Murmeln lieber sofort ins Ziel');else if(w.G<-2)t.push('lässt sich mit dem Ziel Zeit');
  if(w.O>2)t.push('bringt lieber neue Murmeln raus');else if(w.O<-2)t.push('fährt lieber mit Murmeln, die schon draussen sind');
  if(w.R<W0.R-0.1)t.push('spielt vorsichtiger');else if(w.R>W0.R+0.1)t.push('nimmt mehr Risiko');
  if(w.A>W0.A+0.05)t.push('stellt sich angriffslustiger auf');else if(w.A<W0.A-0.05)t.push('achtet weniger auf Angriffschancen');
  if(w.C<W0.C-0.3)t.push('spart Joker, Sieben und Startkarten');else if(w.C>W0.C+0.3)t.push('setzt wertvolle Karten freizügiger ein');
  el.textContent=`${LEARN.n} Züge gelernt, davon ${LEARN.yes} bestätigt; ${LEARN.no} abgelehnt. `+(t.length?'Grün '+(t.length>1?t.slice(0,-1).join(', ')+' und '+t[t.length-1]:t[0])+'.':'Noch kein deutlicher Unterschied zu den Standardregeln.')+(on?'':' (Lernen ist ausgeschaltet; Grün spielt nach den Standardregeln.)');
  el.textContent+=giveInfo();
}
// ===== Statistik =====
// Jede beendete Partie wird mit ein paar Kennzahlen gespeichert (auf dem Gerät, max. 300 Partien).
const STATS_KEY='aendi-dog-stats';
let STATS={games:[]};
function loadStats(){try{const s=JSON.parse(localStorage.getItem(STATS_KEY)||'null');if(s&&Array.isArray(s.games))STATS=s}catch(e){}}
function saveStats(){try{localStorage.setItem(STATS_KEY,JSON.stringify(STATS))}catch(e){}}
// Zähler der laufenden Partie (steckt im Spielstand, übersteht also Neuladen und Zurücknehmen)
function st(){if(!S.stat)S.stat={us:0,them:0,green:0,folds:0,checked:0,agreed:0,lon:0};return S.stat}
function countKills(p,killed){const s=st();for(const id of killed){const mt=teamOf(p);if(teamOf(id>>2)===mt)continue;if(mt===0){s.us++;if(p===2)s.green++}else s.them++}}
function recordGame(){
  // „mit Lernen“ zählt eine Partie nur, wenn Lernen bei mindestens der Hälfte deiner Züge an war
  const s=st();
  STATS.games.push({t:Date.now(),win:S.winner===0,level:S.level,learn:s.checked?(s.lon||0)*2>=s.checked:LEARN.on,rounds:S.cycle,us:s.us,them:s.them,green:s.green,folds:s.folds,checked:s.checked,agreed:s.agreed});
  if(STATS.games.length>300)STATS.games.shift();
  saveStats();
}
function openStats(){renderStats();$('stats').showModal()}
const pctTxt=(a,b)=>b?Math.round(100*a/b)+'\u202f%':'–';
function chartHistory(arr){
  const W=320,H=132,pl=34,pr=8,pt=8,pb=30,n=arr.length,off=STATS.games.length-n;
  let w=STATS.games.slice(0,off).filter(g=>g.win).length;
  const X=i=>pl+(n===1?(W-pl-pr)/2:i*(W-pl-pr)/(n-1)),Y=v=>pt+(1-v)*(H-pt-pb);
  const pts=arr.map((g,i)=>{if(g.win)w++;return [X(i),Y(w/(off+i+1)),g]});
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Siegquote über die letzten Partien">`;
  for(const v of [0,.5,1])s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="grid${v===.5?' mid':''}"/><text x="${pl-5}" y="${Y(v)+3}" class="ax" text-anchor="end">${v*100}\u202f%</text>`;
  if(n>1)s+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" class="line"/>`;
  for(const [x,y,g] of pts){s+=`<circle cx="${x}" cy="${y}" r="2.2" class="pt"/><circle cx="${x}" cy="${H-11}" r="4.6" class="${g.win?'win':'loss'}"/>`;if(g.learn)s+=`<circle cx="${x}" cy="${H-11}" r="1.7" class="lrn"/>`}
  return s+'</svg><p class="legend"><span class="dot win"></span>Sieg<span class="dot loss"></span>Niederlage<span class="dot lrnl"></span>Grün lernte mit · Linie: Siegquote insgesamt</p>';
}
function chartAgree(arr){
  const g=arr.filter(x=>x.checked>0);
  if(!g.length)return '<p class="muted">Noch keine Daten.</p>';
  const W=320,H=120,pl=34,pr=8,pt=8,pb=14,n=g.length,bw=Math.min(18,(W-pl-pr)/n-3),Y=v=>pt+(1-v)*(H-pt-pb);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Übereinstimmung pro Partie">`;
  for(const v of [0,.5,1])s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pl-5}" y="${Y(v)+3}" class="ax" text-anchor="end">${v*100}\u202f%</text>`;
  g.forEach((x,i)=>{const r=x.agreed/x.checked,cx=pl+(i+.5)*(W-pl-pr)/n;s+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${Y(r).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(0)-Y(r)).toFixed(1)}" rx="2" class="bar${x.learn?'':' off'}"/>`});
  return s+'</svg><p class="legend"><span class="dot win"></span>mit Lernen<span class="dot off"></span>ohne Lernen</p>';
}
function chartProfile(){
  const w=LEARN.w,cl=v=>Math.max(-1,Math.min(1,v));
  const D=[['Gegner schlagen',(w.H-W0.H)/20],['Sofort ins Ziel',(w.G-W0.G)/20],['Neue Murmeln raus',(w.O-W0.O)/15],['Vorsicht',(W0.R-w.R)/0.6],['Angriffslust',(w.A-W0.A)/0.4],['Karten sparen',(W0.C-w.C)/1.2],['Dir Startkarten geben',(GIVE0.S1-LEARN.g.S1)/25]];
  const W=320,rh=24,H=D.length*rh+22,cx=238,hw=78;
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Grüns gelernter Stil im Vergleich zum Standard">`;
  s+=`<text x="${cx-hw}" y="11" class="ax">weniger</text><text x="${cx}" y="11" class="ax" text-anchor="middle">Standard</text><text x="${cx+hw}" y="11" class="ax" text-anchor="end">mehr</text>`;
  D.forEach(([lab,v],i)=>{const y=20+i*rh,c=cl(v),bw=Math.abs(c)*hw;
    s+=`<text x="0" y="${y+15}" class="lab">${lab}</text><rect x="${cx-hw}" y="${y+5}" width="${2*hw}" height="14" rx="7" class="track"/>`;
    if(bw>0.5)s+=`<rect x="${(c<0?cx-bw:cx).toFixed(1)}" y="${y+5}" width="${bw.toFixed(1)}" height="14" rx="4" class="${c<0?'neg':'pos'}"/>`});
  s+=`<line x1="${cx}" x2="${cx}" y1="18" y2="${H}" class="zero"/>`;
  return s+'</svg>';
}
function renderStats(){
  const G=STATS.games,n=G.length,wins=G.filter(g=>g.win).length;
  let run=0,best=0;for(const g of G){run=g.win?run+1:0;best=Math.max(best,run)}
  let h=`<div class="tiles"><div><b>${n}</b><span>Partien</span></div><div><b>${wins}</b><span>Siege</span></div><div><b>${pctTxt(wins,n)}</b><span>Siegquote</span></div><div><b>${best}</b><span>längste Serie</span></div></div>`;
  if(!n)h+='<p class="muted">Noch keine beendete Partie. Die Statistik füllt sich, sobald ein Team gewonnen hat.</p>';
  else{
    h+='<h3>Verlauf</h3>'+chartHistory(G.slice(-30));
    h+='<h3>Grün versteht dich</h3><p class="muted">Anteil deiner Züge, die Grün an deiner Stelle genauso gespielt hätte. Steigt der Wert, spielt Grün immer mehr wie du.</p>'+chartAgree(G.slice(-30));
    const L=G.filter(g=>g.learn),NL=G.filter(g=>!g.learn);
    const row=(lab,a)=>{const c=a.reduce((x,g)=>x+g.checked,0),ag=a.reduce((x,g)=>x+g.agreed,0);return `<tr><td>${lab}</td><td>${a.length}</td><td>${pctTxt(a.filter(g=>g.win).length,a.length)}</td><td>${a.length?(a.reduce((x,g)=>x+g.green,0)/a.length).toFixed(1):'–'}</td><td>${pctTxt(ag,c)}</td></tr>`};
    h+=`<h3>Wirkt das Lernen?</h3><div class="tw"><table class="cmp"><tr><th></th><th>Partien</th><th>Siege</th><th>Schläge</th><th>Gleich</th></tr>${row('Mit Lernen',L)}${row('Ohne Lernen',NL)}</table></div>`;
    h+=`<p class="muted">„Schläge“: gegnerische Murmeln, die Grün pro Partie heimschickt. „Gleich“: wie oft Grün deinen Zug genauso gewählt hätte.${L.length<10||NL.length<10?' Für verlässliche Unterschiede braucht es je etwa zehn Partien – bis dahin ist viel Zufall dabei.':''}</p>`;
    const lv={easy:'Leicht',medium:'Mittel',hard:'Stark'};
    h+='<h3>Letzte Partien</h3><div class="tw"><table class="cmp"><tr><th>Datum</th><th>Ergebnis</th><th>Gegner</th><th>Lernen</th><th>Schläge</th></tr>'+G.slice(-8).reverse().map(g=>{const d=new Date(g.t);return `<tr><td>${d.getDate()}.${d.getMonth()+1}.</td><td class="${g.win?'w':'l'}">${g.win?'Sieg':'Niederlage'}</td><td>${lv[g.level]||g.level}</td><td>${g.learn?'✓':'–'}</td><td>${g.us}\u202f:\u202f${g.them}</td></tr>`}).join('')+'</table></div><p class="muted">Schläge: von euch heimgeschickte gegen selbst heimgeschickt bekommene Murmeln.</p>';
  }
  h+='<h3>Grüns gelernter Stil</h3>'+chartProfile();
  h+=`<p class="muted">${LEARN.n+(LEARN.gn||0)?`Gelernt aus ${LEARN.n} Zügen und ${LEARN.gn||0} Kartentauschen.`:'Grün hat noch nichts gelernt – alle Balken stehen auf Standard.'}${LEARN.on?'':' Lernen ist ausgeschaltet; Grün spielt im Moment nach den Standardregeln.'}</p>`;
  $('statsBody').innerHTML=h;
}
// Pfeile der Joker-Leiste nur zeigen, wenn es in diese Richtung noch weitere Werte gibt
function updJkArrows(){
  const j=$('jokerPick'),L=$('jkL'),R=$('jkR');if(!L)return;
  const on=!j.hidden&&j.scrollWidth>j.clientWidth+2;
  L.hidden=!on||j.scrollLeft<4;R.hidden=!on||j.scrollLeft+j.clientWidth>=j.scrollWidth-4;
}
function undoMove(){
  ASK=null;renderAsk();
  if(!UNDO)return;
  GAME++; // laufende Computerzüge und Animationen abbrechen
  document.querySelectorAll('.flycard').forEach(e=>e.remove());
  S=JSON.parse(UNDO);UNDO=null;UI=freshUI();busy=false;$('over').hidden=true;
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
  const t3=el('text',{x:0,y:48,'text-anchor':'middle',class:'cwho',style:`fill:var(--c${p})`},r);t3.textContent=(p===0?'du':NAMES[p])+(card.r==='JO'?' · als '+rankLabel(val):'');
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
  }
  for(const id of selectableIds()){
    if(id===UI.sel)continue;const [x,y]=marblePt(ms,ms[id]);
    el('circle',{cx:x,cy:y,r:10.5,class:'canring'},g);
    el('circle',{cx:x,cy:y,r:12,class:'hit','data-mid':id},g);
  }
  if(UI.sel!=null){const [x,y]=marblePt(ms,ms[UI.sel]);if(selectableIds().size>1)el('circle',{cx:x,cy:y,r:12,class:'hit','data-mid':UI.sel},g)}
}
function renderHand(){
  const h=$('hand');h.innerHTML='';
  const cards=[...(UI.dealt?S.hands[0].slice(0,UI.dealt[0]):S.hands[0])].sort((a,b)=>RORDER.indexOf(a.r)-RORDER.indexOf(b.r));
  const myTurn=S.phase==='play'&&S.turn===0&&!busy;
  for(const c of cards){
    const b=document.createElement('button');b.className='card'+(isRed(c)?' red':'')+(c.r==='JO'?' joker':'');
    const playable=S.phase==='exchange'||(myTurn&&cardHasMoves(c.id));
    if(!playable&&S.phase==='play')b.classList.add('dim');
    if((S.phase==='exchange'&&UI.give===c.id)||(UI.card&&UI.card.id===c.id))b.classList.add('sel');
    if(UI.recv===c.id)b.classList.add('recv');if(UI.hide===c.id)b.style.visibility='hidden';if(UI.pop===c.id){b.classList.add('pop');UI.pop=null}
    b.disabled=busy||!(S.phase==='exchange'||myTurn);
    b.setAttribute('aria-label',cardLabel(c)+(c.r!=='JO'?' '+c.s:''));
    b.innerHTML=`<span class="r">${rankLabel(c.r)}</span><span class="s">${suitHTML(c)}</span>${UI.recv===c.id?'<span class="tag">von Grün</span>':''}`;
    b.dataset.id=c.id;b.onclick=()=>onCard(c.id);h.appendChild(b);
  }
  if(!cards.length){const p=document.createElement('p');p.className='empty';p.textContent=S.phase==='over'?'':'Keine Karten mehr in dieser Runde.';h.appendChild(p)}
  // joker picker
  const jp=$('jokerPick');jp.innerHTML='';
  if(UI.card&&UI.card.r==='JO'&&!busy){
    jp.hidden=false;
    for(const v of ALLV){if(!S.legal.some(m=>m.card.id===UI.card.id&&m.val===v))continue;
      const b=document.createElement('button');b.textContent=rankLabel(v);b.title=VLABEL[v]||v;if(UI.val===v)b.className='on';
      b.onclick=()=>{if(UI.applied.length)return;selectVal(v)};jp.appendChild(b)}
  }else jp.hidden=true;
  requestAnimationFrame(updJkArrows);
  const act=$('actBtn');
  if(S.phase==='exchange'){act.hidden=false;act.textContent='Karte an Grün geben';act.disabled=UI.give==null}
  else act.hidden=true;
  $('cancelBtn').hidden=!(UI.card&&S.phase==='play'&&!busy);
  $('undoBtn').hidden=!UNDO;
}
function renderStatus(msg){
  let t='';
  if(msg)t=msg;
  else if(S.phase==='over')t=S.winner===0?'Gewonnen!':'Verloren.';
  else if(UI.dealt){const d=(S.roundStart+3)%4;t=`${d===0?'Du gibst':NAMES[d]+' gibt'} die Karten aus …`}
  else if(S.phase==='exchange'){const order=[0,1,2,3].map(i=>(S.roundStart+i)%4).map(q=>q===0?'du':NAMES[q]);t=`${S.roundStart===0?'Du beginnst':NAMES[S.roundStart]+' beginnt'} diese Runde (Reihenfolge: ${order.join(', ')}). Tippe eine Karte zweimal, um sie Grün zu geben.`}
  else if(S.turn!==0)t=`${NAMES[S.turn]} ist am Zug …`;
  else{
    const c=ctrlColor(S.marbles,0);const pre=c!==0?'Deine Murmeln sind im Ziel – du spielst mit Grün. ':'';
    if(!UI.card)t=pre+'Du bist dran. Wähle eine Karte.';
    else if(UI.card.r==='JO'&&!UI.val)t='Als welche Karte setzt du den Joker ein?';
    else if(UI.val==='7'){const used=UI.applied.reduce((a,s)=>a+s.n,0);t=`Sieben: noch ${7-used} Schritt${7-used===1?'':'e'}. `+(UI.sel==null?'Wähle eine Murmel.':'Wähle, wie weit sie fährt.')}
    else if(UI.val==='B')t=UI.sel==null?VLABEL.B+': Wähle deine Murmel.':'Mit welcher Murmel tauschen?';
    else t=UI.sel==null?'Wähle eine Murmel.':'Wähle das Zielfeld.';
  }
  $('status').textContent=t;
}
function renderLog(){
  const l=$('log');l.innerHTML='';
  for(const e of S.log.slice(0,30)){const li=document.createElement('li');li.textContent=e.t;if(e.cls)li.className=e.cls;l.appendChild(li)}
}
function showOver(){
  $('overTitle').textContent=S.winner===0?'Gewonnen!':'Verloren';
  $('overText').textContent=S.winner===0?'Du und Grün habt alle acht Murmeln ins Ziel gebracht.':'Rot und Gelb waren diesmal schneller.';
  $('over').hidden=false;
}

// ---------- Persistence ----------
function save(){try{const {legal,...rest}=S;localStorage.setItem(SAVE_KEY,JSON.stringify(rest))}catch(e){}}
function load(){try{const s=localStorage.getItem(SAVE_KEY);return s?JSON.parse(s):null}catch(e){return null}}

// ---------- Init ----------
const SHOW_RULES=false; // true = „Regeln & Varianten“ (Menüeintrag und Regeln-Dialog) wieder einblenden; die Varianten stehen immer im Neues-Spiel-Dialog
function init(){
  buildBoard();
  $('rulesBtn').hidden=!SHOW_RULES;
  // „Grün lernt von dir“ wohnt im Neues-Spiel-Dialog (die Blöcke stehen im HTML noch beim Regeltext)
  $('newDlg').insertBefore($('learnBox1'),$('ngWarn'));$('newDlg').insertBefore($('learnBox2'),$('ngWarn'));
  $('lvl').onchange=e=>{S.level=e.target.value;save()};
  $('spd').onchange=e=>{S.speed=e.target.value;save()};
  // Neues Spiel: Regeln (Varianten) werden nur hier gewählt und gelten dann fürs ganze Spiel
  const RULES_KEY='aendi-dog-rules';
  const askNewGame=()=>{$('ngCan').checked=OPT.canadian;$('ngJok').checked=OPT.jokerNo8;$('optLearn').checked=LEARN.on;learnInfo();$('ngWarn').hidden=!S||S.phase==='over';$('newDlg').showModal()};
  $('ngStart').onclick=()=>{OPT.canadian=$('ngCan').checked;OPT.jokerNo8=$('ngJok').checked;LEARN.on=$('optLearn').checked;saveLearn();$('optCan').checked=OPT.canadian;$('optJok').checked=OPT.jokerNo8;
    try{localStorage.setItem(RULES_KEY,JSON.stringify({canadian:OPT.canadian,jokerNo8:OPT.jokerNo8}))}catch(e){}
    $('newDlg').close();newGame()};
  $('ngCancel').onclick=()=>$('newDlg').close();
  {const j=$('jokerPick');j.addEventListener('scroll',updJkArrows,{passive:true});addEventListener('resize',updJkArrows);
   $('jkR').onclick=()=>j.scrollBy({left:j.clientWidth*.7,behavior:'smooth'});
   $('jkL').onclick=()=>j.scrollBy({left:-j.clientWidth*.7,behavior:'smooth'})}
  $('newBtn').onclick=askNewGame;
  $('againBtn').onclick=askNewGame;
  // Spielende-Fenster: Tipp auf den Hintergrund schliesst es, damit man das Brett sieht
  $('over').addEventListener('click',e=>{if(e.target===$('over'))$('over').hidden=true});
  $('actBtn').onclick=()=>{if(S.phase==='exchange')doExchange()};
  $('cancelBtn').onclick=cancelMove;
  $('undoBtn').onclick=undoMove;
  $('rulesBtn').onclick=()=>{renderCardDemo();learnInfo();$('rules').showModal()};
  // Hamburger-Menü: öffnen/schliessen, Klick daneben oder Escape schliesst
  {const mb=$('menuBtn'),mn=$('menu');
   const close=()=>{mn.hidden=true;mb.setAttribute('aria-expanded','false')};
   mb.onclick=e=>{e.stopPropagation();const open=mn.hidden;mn.hidden=!open;mb.setAttribute('aria-expanded',String(open));if(open)mn.querySelector('select').focus()};
   document.addEventListener('click',e=>{if(!mn.hidden&&!mn.contains(e.target)&&!mb.contains(e.target))close()});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mn.hidden){close();mb.focus()}});
   $('rulesBtn').addEventListener('click',close);
   $('newBtn').addEventListener('click',()=>{if(!$('newBtn').dataset.armed)close()});
   $('statsBtn').addEventListener('click',()=>{close();openStats()});
   $('logBtn').addEventListener('click',()=>{close();renderLog();$('logDlg').showModal()});
   $('logClose').onclick=()=>$('logDlg').close();}
  loadStats();
  $('statsBtn2').onclick=openStats;
  $('statsClose').onclick=()=>$('stats').close();
  {const rb=$('statsReset'),rc=$('statsConfirm'),closeRc=()=>{rc.hidden=true;rb.hidden=false};
   rb.onclick=()=>{rb.hidden=true;rc.hidden=false;$('statsNo').focus()};
   $('statsNo').onclick=closeRc;
   $('statsYes').onclick=()=>{STATS={games:[]};saveStats();closeRc();renderStats()};
   $('stats').addEventListener('close',closeRc)}
  loadLearn();$('optLearn').checked=LEARN.on;
  $('optLearn').onchange=()=>learnInfo();
  {const rb=$('learnReset'),rc=$('resetConfirm');
   const closeRc=()=>{rc.hidden=true;rb.hidden=false};
   rb.onclick=()=>{rb.hidden=true;rc.hidden=false;$('resetNo').focus()};
   $('resetNo').onclick=()=>{closeRc();rb.focus()};
   $('resetYes').onclick=()=>{LEARN.w={...W0};LEARN.g=freshGive();LEARN.n=LEARN.yes=LEARN.no=LEARN.gn=0;ASK=null;renderAsk();saveLearn();closeRc();learnInfo();$('learnInfo').textContent='Zurückgesetzt. '+$('learnInfo').textContent};
   $('newDlg').addEventListener('close',closeRc)}
  $('learnYes').onclick=()=>{if(!ASK)return;ASK.yes();LEARN.yes++;saveLearn();ASK=null;renderAsk()};
  $('learnNo').onclick=()=>{if(!ASK)return;LEARN.no++;saveLearn();ASK=null;renderAsk()};
  $('rulesClose').onclick=()=>$('rules').close();
  const syncOpt=()=>{OPT.canadian=$('optCan').checked;OPT.jokerNo8=$('optJok').checked;if(S){S.opts={...OPT};if(S.phase==='play'&&S.turn===0&&!busy){S.legal=legalMoves(S.marbles,0,S.hands[0],false);UI=freshUI(true);render()}save()}};
  $('optCan').onchange=syncOpt;$('optJok').onchange=syncOpt;
  const saved=load();
  if(saved&&saved.phase!=='over'&&saved.marbles){
    S=saved;S.deckStyle='fr'; // nur noch französische Karten
    // Tempo-Stufen wurden verschoben (neu: Normal = früher Zügig). Gespeichertes Tempo einmalig umrechnen, damit es sich gleich anfühlt.
    if(!S.spdV2){S.speed={slow:'slow',normal:'slow',fast:'normal'}[S.speed]||'normal';S.spdV2=1}
    $('lvl').value=S.level||'hard';$('spd').value=S.speed||'normal';
    if(S.opts){OPT.canadian=!!S.opts.canadian;OPT.jokerNo8=!!S.opts.jokerNo8;$('optCan').checked=OPT.canadian;$('optJok').checked=OPT.jokerNo8}
    if(S.phase==='exchange')render();else proceed();
  }else{S=null;try{const r=JSON.parse(localStorage.getItem(RULES_KEY)||'null');if(r){OPT.canadian=!!r.canadian;OPT.jokerNo8=!!r.jokerNo8;$('optCan').checked=OPT.canadian;$('optJok').checked=OPT.jokerNo8}}catch(e){}
    newGame();askNewGame();$('ngWarn').hidden=true}
}
init();


// Für die 3D-Ansicht (view3d.ts)
export { $, C, MCOL, NAMES, P, PS, S, SUIT_CH, SYMS, TP, UI, busy, deckPos, el, goalPt, isCH, isRed, kennelPt, onBoardClick, pileCards, pileCount, pileRot, pts, rankLabel, rot, seatPt };
export function setSeatPt(f) { seatPt = f; }
