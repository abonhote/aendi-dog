// @ts-nocheck
/**
 * 3D-Ansicht (WebGL, ohne Bibliotheken) – 1:1 aus der spielbaren Vorschau übernommen.
 * Die SVG-Ansicht in app.ts bleibt die Quelle der Wahrheit; diese Datei liest jedes Bild die
 * Murmel-Positionen und Markierungen aus dem SVG und zeichnet sie räumlich.
 */
import { $, C, DECK_SCALE, MCOL, NAMES, P, PS, S, SUIT_CH, SYMS, TP, UI, busy, deckPos, el, goalPt, isCH, isRed, kennelPt, onBoardClick, pileCards, pileCount, pileRot, pts, rankLabel, rot, seatPt, setSeatPt } from './app';
import { ctrlColor, startOf } from './engine';

// ===== 3D-Ansicht (WebGL, ohne Bibliotheken) =====
// Die SVG-Ansicht bleibt die Quelle der Wahrheit: Spiel-Logik, Animationen und Markierungen
// laufen dort weiter (unsichtbar). Die 3D-Szene liest jedes Bild die animierten Murmel-
// Positionen und die Markierungen aus dem SVG und zeichnet sie räumlich.
(()=>{
const VIEW_KEY='aendi-dog-view';
const box=document.querySelector('.boardBox');
const sel=$('view');
const wrap=document.createElement('div');wrap.className='view3d';
wrap.innerHTML=`<canvas id="gl" tabindex="0" aria-label="Spielbrett in 3D"></canvas><div id="labs3d"></div><div class="mini" hidden></div><button class="v3btn" id="v3reset" type="button" aria-label="Blick zurücksetzen" title="Blick zurücksetzen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><p class="hint3d" hidden></p>`;
box.insertBefore(wrap,$('over'));
const cv=wrap.querySelector('canvas'),miniEl=wrap.querySelector('.mini'),hintEl=wrap.querySelector('.hint3d'),labsEl=$('labs3d');
let gl=null;
try{gl=cv.getContext('webgl',{antialias:true,alpha:false})}catch(e){}
if(!gl){for(const o of sel.options)if(o.value!=='2d')o.disabled=true;sel.value='2d';return}

// ---------- Vektor & Matrix ----------
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mulS=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]};
const lerp3=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
function mat(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o}
function persp(f,a,n,fa){const t=1/Math.tan(f/2),nf=1/(n-fa);return [t/a,0,0,0,0,t,0,0,0,0,(fa+n)*nf,-1,0,0,2*fa*n*nf,0]}
function ortho(h,a,n,f){return [1/(h*a),0,0,0,0,1/h,0,0,0,0,-2/(f-n),0,0,0,-(f+n)/(f-n),1]}
function lookAt(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]}
function camSetup(c,aspect){
  c.aspect=aspect;
  c.f=norm(sub(c.ctr,c.eye));c.r=norm(cross(c.f,c.up));c.u=cross(c.r,c.f);
  const proj=c.ortho?ortho(c.half,aspect,1,3000):persp(c.fov,aspect,c.near,c.far);
  c.vp=mat(proj,lookAt(c.eye,c.ctr,c.up));return c;
}
function project(c,p){const v=c.vp,x=v[0]*p[0]+v[4]*p[1]+v[8]*p[2]+v[12],y=v[1]*p[0]+v[5]*p[1]+v[9]*p[2]+v[13],w=v[3]*p[0]+v[7]*p[1]+v[11]*p[2]+v[15];if(w<=0.01)return null;return [x/w,y/w,w]}
function ray(c,nx,ny){
  if(c.ortho){const o=add(c.eye,add(mulS(c.r,nx*c.half*c.aspect),mulS(c.u,ny*c.half)));return {o,d:c.f}}
  const t=Math.tan(c.fov/2);return {o:c.eye,d:norm(add(c.f,add(mulS(c.r,nx*t*c.aspect),mulS(c.u,ny*t))))};
}
const W=(x,y,h)=>[x-C,h||0,y-C];

// ---------- Shader ----------
const VS=`attribute vec3 aPos;attribute vec3 aNor;attribute vec2 aUv;
uniform mat4 uVP;uniform vec3 uX;uniform vec3 uS;uniform float uRot;uniform vec3 uCam;
varying vec3 vN;varying vec3 vW;varying vec2 vUv;varying vec3 vV;
void main(){float c=cos(uRot),s=sin(uRot);vec3 p=aPos*uS;p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);vec3 w=p+uX;
vN=vec3(c*aNor.x+s*aNor.z,aNor.y,-s*aNor.x+c*aNor.z);vW=w;vV=normalize(uCam-w);vUv=aUv;gl_Position=uVP*vec4(w,1.0);}`;
const FS=`precision mediump float;
uniform int uMode;uniform vec4 uCol;uniform sampler2D uTex;uniform vec3 uL;uniform float uEm;uniform float uAmb;uniform vec3 uCol2;
varying vec3 vN;varying vec3 vW;varying vec2 vUv;varying vec3 vV;
void main(){
  if(uMode==2){float d=length(vUv-0.5)*2.0;gl_FragColor=vec4(uCol.rgb,uCol.a*smoothstep(1.0,0.0,d));return;}
  if(uMode==3){gl_FragColor=vec4(uCol.rgb,uCol.a*(1.0-vUv.y)*(1.0-vUv.y));return;}
  if(uMode==4){gl_FragColor=uCol;return;}
  vec3 n=normalize(vN);float dif=max(dot(n,uL),0.0);
  if(uMode==5){
    vec3 v=normalize(vV);vec3 h=normalize(uL+v);
    float sp=pow(max(dot(n,h),0.0),70.0);float rim=pow(1.0-max(dot(n,v),0.0),2.5);
    vec3 bl=normalize(vec3(-0.6,1.0,0.2));float w=clamp((dot(n,bl)+0.4)/1.4,0.0,1.0);float hemi=0.5+0.5*n.y;
    vec3 c=mix(uCol.rgb*0.5,mix(uCol.rgb,uCol2,0.5),w*w*(3.0-2.0*w))*(0.9+0.2*hemi);
    c+=uCol2*pow(max(dot(-n,uL),0.0),2.0)*0.22;
    c=mix(c,vec3(1.0),rim*0.14)+vec3(sp)*0.9+uCol2*uEm+vec3(uEm*0.2);
    gl_FragColor=vec4(c,1.0);return;}
  if(uMode==6){float f=fract(vW.y/0.55);vec3 c=uCol.rgb*mix(0.78,1.0,smoothstep(0.0,0.5,f));gl_FragColor=vec4(c*(uAmb+(1.0-uAmb)*max(dif,0.35)),1.0);return;}
  vec4 b=uMode==1?texture2D(uTex,vUv):uCol;
  gl_FragColor=vec4(b.rgb*(uAmb+(1.0-uAmb)*dif),b.a*uCol.a);
}`;
function shader(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(o));return o}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);gl.useProgram(prog);
const A={};for(const n of ['aPos','aNor','aUv'])A[n]=gl.getAttribLocation(prog,n);
const U={};for(const n of ['uVP','uX','uS','uRot','uMode','uCol','uTex','uCam','uL','uEm','uAmb','uCol2'])U[n]=gl.getUniformLocation(prog,n);
const LIGHT=norm([-0.35,1,0.5]);

// ---------- Geometrie ----------
function mesh(p,n,uv,idx){
  const b=a=>{const o=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);return o};
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);
  return {p:b(p),n:b(n),uv:b(uv),ib,cnt:idx.length};
}
const OCT=[[100,5],[300,5],[395,100],[395,300],[300,395],[100,395],[5,300],[5,100]];
const THICK=16;
function boardTop(){const p=[0,0,0],n=[0,1,0],uv=[.5,.5],idx=[];OCT.forEach(([x,y],i)=>{p.push(x-C,0,y-C);n.push(0,1,0);uv.push(x/400,y/400);idx.push(0,1+i,1+(i+1)%8)});return mesh(p,n,uv,idx)}
function boardSides(){const p=[],n=[],uv=[],idx=[];
  for(let i=0;i<8;i++){const a=OCT[i],b=OCT[(i+1)%8];const nn=norm([b[1]-a[1],0,-(b[0]-a[0])]);const k=p.length/3;
    for(const [q,h] of [[a,0],[b,0],[b,-THICK],[a,-THICK]]){p.push(q[0]-C,h,q[1]-C);n.push(-nn[0],0,-nn[2]);uv.push(0,0)}
    idx.push(k,k+1,k+2,k,k+2,k+3)}
  return mesh(p,n,uv,idx)}
function sphere(){const p=[],n=[],uv=[],idx=[],LA=16,LO=26;
  for(let i=0;i<=LA;i++){const th=i*Math.PI/LA;for(let j=0;j<=LO;j++){const ph=j*2*Math.PI/LO;const v=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];p.push(...v);n.push(...v);uv.push(j/LO,i/LA)}}
  for(let i=0;i<LA;i++)for(let j=0;j<LO;j++){const a=i*(LO+1)+j,b=a+LO+1;idx.push(a,b,a+1,b,b+1,a+1)}
  return mesh(p,n,uv,idx)}
function ring(ri,ro,seg){seg=seg||40;const p=[],n=[],uv=[],idx=[];
  for(let j=0;j<=seg;j++){const a=j*2*Math.PI/seg,c=Math.cos(a),s=Math.sin(a);
    for(const r of [ri,ro]){p.push(c*r,0,s*r);n.push(0,1,0);uv.push(.5+.5*c*r/ro,.5+.5*s*r/ro)}}
  for(let j=0;j<seg;j++){const k=j*2;idx.push(k,k+1,k+3,k,k+3,k+2)}
  return mesh(p,n,uv,idx)}
function cyl(){const p=[],n=[],uv=[],idx=[],seg=24;
  for(let j=0;j<=seg;j++){const a=j*2*Math.PI/seg,c=Math.cos(a),s=Math.sin(a);p.push(c,0,s,c,1,s);n.push(c,0,s,c,0,s);uv.push(j/seg,0,j/seg,1)}
  for(let j=0;j<seg;j++){const k=j*2;idx.push(k,k+1,k+3,k,k+3,k+2)}
  return mesh(p,n,uv,idx)}
function boxMesh(){const p=[],n=[],uv=[],idx=[];
  const F=[[[0,1,0],[[-.5,1,-.5],[.5,1,-.5],[.5,1,.5],[-.5,1,.5]]],[[0,0,1],[[-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5]]],[[0,0,-1],[[.5,0,-.5],[-.5,0,-.5],[-.5,1,-.5],[.5,1,-.5]]],[[1,0,0],[[.5,0,.5],[.5,0,-.5],[.5,1,-.5],[.5,1,.5]]],[[-1,0,0],[[-.5,0,-.5],[-.5,0,.5],[-.5,1,.5],[-.5,1,-.5]]]];
  for(const [nn,q] of F){const k=p.length/3;for(const v of q){p.push(...v);n.push(...nn);uv.push(0,0)}idx.push(k,k+1,k+2,k,k+2,k+3)}
  return mesh(p,n,uv,idx)}
function quad(w,h){return mesh([-w/2,0,-h/2,w/2,0,-h/2,w/2,0,h/2,-w/2,0,h/2],[0,1,0,0,1,0,0,1,0,0,1,0],[0,0,1,0,1,1,0,1],[0,1,2,0,2,3])}
function tri(pts){const p=[],n=[],uv=[];for(const q of pts){p.push(q[0],0,q[1]);n.push(0,1,0);uv.push(0,0)}return mesh(p,n,uv,[0,1,2])}
const G={stack:boxMesh(),top:boardTop(),sides:boardSides(),ball:sphere(),disc:ring(0,1,36),canR:ring(9.4,11.6),selR:ring(9.6,12.6),tgtR:ring(8.4,10.6),beam:cyl(),card:quad(60*PS,86*PS),
  marker:tri([[13,0],[-8,8],[-8,-8]]),wedge:tri([[0,0],[150,-105],[150,105]])};

// ---------- Farben & Texturen ----------
const cctx=document.createElement('canvas').getContext('2d');
function rgba(s){cctx.fillStyle='#000';cctx.fillStyle=s.trim();const v=cctx.fillStyle;
  if(v[0]==='#')return [parseInt(v.slice(1,3),16)/255,parseInt(v.slice(3,5),16)/255,parseInt(v.slice(5,7),16)/255,1];
  const m=v.match(/[\d.]+/g).map(Number);return [m[0]/255,m[1]/255,m[2]/255,m[3]==null?1:m[3]]}
let COL={};
function readColors(){const cs=getComputedStyle(document.documentElement);const g=n=>cs.getPropertyValue('--'+n).trim();
  COL={raw:{},bg:rgba(g('bg')),ink:rgba(g('ink')),panel:rgba(g('panel')),sel:rgba(g('sel')),side:rgba(g('wood3')),groove:rgba(g('groove')),
    dark:matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.dataset.theme!=='light'||document.documentElement.dataset.theme==='dark'};
  for(const n of ['wood1','wood2','wood3','groove','card','hole','rim'])COL.raw[n]=g(n);
  COL.ball=MCOL.map(c=>rgba(c[1]));COL.ballL=MCOL.map(c=>rgba(c[0]).slice(0,3));
}
function texFrom(canvas,mip){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
  if(mip){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    const ext=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))}
  else{gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return t}
let boardTex=null,texGen=0;
const TS=2048;
function paintWood(ctx){
  const R=COL.raw,s=TS/500,P=22*s;
  ctx.fillStyle=R.wood1;ctx.fillRect(0,0,TS,TS);
  ctx.save();ctx.translate(TS*.18,TS*1.3);ctx.scale(1,60/140);
  const maxR=Math.hypot(TS*.82,TS*1.3*140/60)+P;
  for(let r0=Math.ceil(maxR/P)*P;r0>=0;r0-=P){
    for(const [d,c] of [[P,R.wood3],[21*s,R.wood1],[13*s,R.wood2],[9*s,R.wood1]]){ctx.beginPath();ctx.arc(0,0,r0+d,0,7);ctx.fillStyle=c;ctx.fill()}}
  ctx.restore();
  ctx.save();ctx.translate(TS/2,TS*.4);ctx.scale(1.2,.9);const vg=ctx.createRadialGradient(0,0,0,0,0,TS);vg.addColorStop(.55,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.18)');ctx.fillStyle=vg;ctx.fillRect(-TS,-TS,TS*2,TS*2);ctx.restore();
}
function svgSnapshot(){
  const src=$('board'),cl=src.cloneNode(true);
  const a=src.querySelectorAll('*'),b=cl.querySelectorAll('*');
  const props=['fill','stroke','stroke-width','opacity','fill-opacity','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin'];
  for(let i=0;i<a.length;i++){if(a[i].closest('defs'))continue;const cs=getComputedStyle(a[i]);for(const p of props){const v=cs.getPropertyValue(p);if(v)b[i].setAttribute(p,v)}b[i].removeAttribute('class');b[i].removeAttribute('style')}
  for(const id of ['marbles','hl','center'])cl.querySelector('#'+id)?.remove();
  cl.querySelectorAll('text').forEach(t=>t.remove());
  cl.setAttribute('xmlns','http://www.w3.org/2000/svg');cl.setAttribute('width',TS);cl.setAttribute('height',TS);cl.removeAttribute('style');
  return new XMLSerializer().serializeToString(cl);
}
function buildBoardTex(){
  const gen=++texGen;readColors();
  const c=document.createElement('canvas');c.width=c.height=TS;const ctx=c.getContext('2d');paintWood(ctx);
  const set=()=>{if(gen!==texGen)return;try{const t=texFrom(c,true);if(boardTex)gl.deleteTexture(boardTex);boardTex=t}catch(e){}};
  set();
  const img=new Image();
  img.onload=()=>{ctx.drawImage(img,0,0,TS,TS);set()};
  img.onerror=()=>{const k=TS/400;ctx.fillStyle=COL.raw.hole;for(const [x,y] of TP){ctx.beginPath();ctx.arc(x*k,y*k,6.2*k,0,7);ctx.fill()}set()};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgSnapshot());
}
// Karte in der Mitte
const cardCv=document.createElement('canvas');cardCv.width=240;cardCv.height=344;
let cardTex=[],cardKey='',backTex=null;
// Kartenrückseite wie in der flachen Ansicht: weisser Rand, rot gestreift
function makeBackTex(){
  const c=document.createElement('canvas');c.width=240;c.height=344;const x=c.getContext('2d');
  x.fillStyle='#fffdf7';x.beginPath();x.roundRect(2,2,236,340,34);x.fill();
  x.save();x.beginPath();x.roundRect(14,14,212,316,24);x.clip();x.fillStyle='#a83232';x.fillRect(0,0,240,344);
  x.strokeStyle='#8b1e1e';x.lineWidth=20;for(let i=-344;i<240+344;i+=40){x.beginPath();x.moveTo(i,0);x.lineTo(i+344,344);x.stroke()}
  x.restore();return texFrom(c,false);
}
const symImg={};
function symbol(id){if(symImg[id])return symImg[id];const i=new Image();i.onload=()=>{cardKey=''};
  i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><defs>${SYMS}</defs><use href="#${id}"/></svg>`);return symImg[id]=i}
function drawCard(){
  const pc=pileCards();const key=pc.length?[pc.map(l=>l.card.id).join(','),S.deckStyle,COL.raw.card].join('|'):'';
  if(key===cardKey)return;cardKey=key;
  for(const t of cardTex)gl.deleteTexture(t);cardTex=pc.map(l=>cardTexFor(l.card));
}
function cardTexFor(card){
  // gleiche Gestaltung wie die Handkarte (60×86, hier 4-fach)
  const x=cardCv.getContext('2d'),w=240,h=344,k=4,jo=card.r==='JO';
  const cs=getComputedStyle(document.documentElement),ink=cs.getPropertyValue('--cardInk').trim()||'#1d2925',redC=cs.getPropertyValue('--red').trim()||'#c0392b';
  x.clearRect(0,0,w,h);x.fillStyle=COL.raw.card;x.beginPath();x.roundRect(2,2,w-4,h-4,34);x.fill();
  x.strokeStyle='rgba(0,0,0,.18)';x.lineWidth=4;x.stroke();
  const red=isRed(card);x.textBaseline='alphabetic';
  x.textAlign='left';x.fillStyle=red?redC:ink;x.font=`800 ${(jo?14:19)*k}px "Bricolage Grotesque",system-ui,sans-serif`;
  x.fillText(rankLabel(card.r),7*k,(jo?18.5:21.5)*k);
  if(!jo&&isCH()){const i=symbol(SUIT_CH[card.s]);if(i.complete&&i.naturalWidth)x.drawImage(i,25*k,51*k,28*k,28*k)}
  else{x.textAlign='right';x.fillStyle=jo?'#b07d00':red?redC:ink;x.font=`${24*k}px "Atkinson Hyperlegible",system-ui,sans-serif`;x.fillText(jo?'★':card.s,53*k,74*k)}
  return texFrom(cardCv,false);
}

// ---------- Zeichnen ----------
gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
gl.uniform3fv(U.uL,LIGHT);gl.uniform1i(U.uTex,0);
const M_LIT=0,M_TEX=1,M_RAD=2,M_FADE=3,M_FLAT=4,M_BALL=5;
function draw(m,o){
  gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.vertexAttribPointer(A.aPos,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(A.aPos);
  if(A.aNor>=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.vertexAttribPointer(A.aNor,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(A.aNor)}
  if(A.aUv>=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.uv);gl.vertexAttribPointer(A.aUv,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(A.aUv)}
  gl.uniform3fv(U.uX,o.at||[0,0,0]);const s=o.s==null?1:o.s;gl.uniform3fv(U.uS,Array.isArray(s)?s:[s,s,s]);gl.uniform1f(U.uRot,o.rot||0);
  gl.uniform1i(U.uMode,o.mode||0);gl.uniform4fv(U.uCol,o.col||[1,1,1,1]);gl.uniform1f(U.uEm,o.em||0);gl.uniform1f(U.uAmb,o.amb==null?.6:o.amb);
  if(o.tex){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o.tex)}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.drawElements(gl.TRIANGLES,m.cnt,gl.UNSIGNED_SHORT,0);
}
const withA=(c,a)=>[c[0],c[1],c[2],a];
function decal(on){gl.depthMask(!on);if(on){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-4)}else gl.disable(gl.POLYGON_OFFSET_FILL)}

// ---------- Zustand aus dem SVG ----------
const MP=[];for(let i=0;i<16;i++)MP.push({x:0,y:0,s:1,moving:false,w:[0,5,0]});
function readMarbles(){
  for(let i=0;i<16;i++){const e=$('m'+i);if(!e)continue;const q=MP[i];const t=getComputedStyle(e).transform;
    const m=t&&t!=='none'?t.match(/matrix\(([^)]+)\)/):null;
    if(m){const v=m[1].split(',').map(parseFloat);q.s=v[0];q.x=v[4];q.y=v[5]}
    q.moving=e.classList.contains('moving');q.w=W(q.x,q.y,5+Math.max(0,q.s-1)*70)}
}
let HL=[],dirty=true;
new MutationObserver(()=>{dirty=true}).observe($('board'),{childList:true,subtree:true,characterData:true});
const LABS=[];
const PILE3D=document.createElement('div');PILE3D.className='lab3d';labsEl.appendChild(PILE3D);
for(let p=0;p<4;p++){const d=document.createElement('div');d.className='lab3d';d.style.color=`var(--c${p})`;d.innerHTML='<b></b><small></small>';labsEl.appendChild(d);LABS.push(d)}
function syncDom(){
  dirty=false;
  HL=[...$('hl').children].map(e=>({cls:e.getAttribute('class'),x:+e.getAttribute('cx'),y:+e.getAttribute('cy'),el:e}));
  for(let p=0;p<4;p++){const l=$('lab'+p);if(!l)continue;const t=l.querySelectorAll('tspan');const d=LABS[p];
    d.children[0].textContent=t[0]?t[0].textContent:'';d.children[1].textContent=t[1]?t[1].textContent:'';
    d.classList.toggle('on',l.classList.contains('active'));d.dataset.x=l.getAttribute('x');d.dataset.y=+l.getAttribute('y')+4}
}

// ---------- Kamera ----------
const orbit={th:0,ph:.8,dist:620};
const ORBIT0={...orbit};
const pov={focus:0,ang:-Math.PI/2,yaw:0,pitch:0,dist:46,eye:null,ctr:null,lastTurn:-1};
let mode='2d';
function nearestDir(x,y){
  let bi=-1,bd=1e9;for(let i=0;i<64;i++){const d=Math.hypot(TP[i][0]-x,TP[i][1]-y);if(d<bd){bd=d;bi=i}}
  if(bd<14){const a=TP[(bi+63)%64],b=TP[(bi+1)%64];return Math.atan2(b[1]-a[1],b[0]-a[0])}
  for(let c=0;c<4;c++)for(let i=0;i<4;i++){const g=goalPt(c,i);if(Math.hypot(g[0]-x,g[1]-y)<14){const a=i===0?TP[c*16]:goalPt(c,i-1),b=i===0?goalPt(c,0):goalPt(c,i);const p=i===0?goalPt(c,1):b;return Math.atan2(p[1]-a[1],p[0]-a[0])}
    const k=kennelPt(c,i);if(Math.hypot(k[0]-x,k[1]-y)<14){const s=TP[c*16];return Math.atan2(s[1]-k[1],s[0]-k[0])}}
  return null;
}
function myMarble(){
  const c=ctrlColor(S.marbles,0);let best=c*4,bp=-1;
  for(let i=c*4;i<c*4+4;i++){const m=S.marbles[i];if(m.loc==='T'){const pr=(m.pos-startOf(c)+64)%64;if(pr>bp){bp=pr;best=i}}}
  return best;
}
function chooseFocus(){
  for(let i=0;i<16;i++)if(MP[i].moving||MP[i].s>1.03)return i;
  if(UI&&UI.cand&&UI.sel!=null)return UI.sel;
  if(S&&S.phase==='play'&&S.turn===0){
    if(pov.lastTurn!==0){pov.lastTurn=0;return myMarble()}
    return pov.focus;
  }
  if(S)pov.lastTurn=S.turn;
  return pov.focus;
}
const angLerp=(a,b,k)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return a+d*k};
function mainCam(dt,aspect){
  if(mode==='3d'){
    const {th,ph,dist}=orbit,ctr=[0,-4,0];
    return camSetup({eye:add(ctr,[dist*Math.sin(ph)*Math.sin(th),dist*Math.cos(ph),dist*Math.sin(ph)*Math.cos(th)]),ctr,up:[0,1,0],fov:40*Math.PI/180,near:20,far:4000},aspect);
  }
  const f=chooseFocus();if(f!==pov.focus){pov.focus=f;pov.yaw*=.0;pov.pitch=0}
  const q=MP[f];const a=nearestDir(q.x,q.y);const k=1-Math.exp(-dt*5);
  if(a!=null)pov.ang=angLerp(pov.ang,a,pov.eye?k:1);
  const ang=pov.ang+pov.yaw,D=[Math.cos(ang),0,Math.sin(ang)];
  const eyeT=add(q.w,[-D[0]*pov.dist,pov.dist*.72+12,-D[2]*pov.dist]);
  const ctrT=add(q.w,[D[0]*50,-8+pov.pitch*110,D[2]*50]);
  if(!pov.eye){pov.eye=eyeT;pov.ctr=ctrT}
  const kk=reduce?1:1-Math.exp(-dt*6);pov.eye=lerp3(pov.eye,eyeT,kk);pov.ctr=lerp3(pov.ctr,ctrT,kk);
  return camSetup({eye:pov.eye,ctr:pov.ctr,up:[0,1,0],fov:68*Math.PI/180,near:2.5,far:3000},aspect);
}
const miniCam=a=>camSetup({eye:[0,900,0],ctr:[0,0,0],up:[0,0,-1],ortho:true,half:206},a);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Szene ----------
function scene(cam,isMini,t){
  gl.uniformMatrix4fv(U.uVP,false,cam.vp);gl.uniform3fv(U.uCam,cam.eye);
  const pulse=reduce?.8:.55+.45*Math.sin(t*.0057);
  if(!isMini){
    decal(true);
    draw(G.disc,{at:[0,-THICK-.05,0],s:[1600,1,1600],mode:M_RAD,col:[0,0,0,COL.dark?.32:.16]});
    draw(G.disc,{at:[12,-THICK+.05,-18],s:[330,1,330],mode:M_RAD,col:[0,0,0,COL.dark?.6:.42]});
    decal(false);
    draw(G.sides,{mode:M_LIT,col:COL.side,amb:.5});
  }
  draw(G.top,boardTex?{mode:M_TEX,tex:boardTex,amb:isMini?1:.62}:{mode:M_LIT,col:rgba(COL.raw.wood1)});
  decal(true);
  if(!isMini)for(let i=0;i<16;i++){const q=MP[i];const lift=q.w[1]-5;const r=9+lift*.25;draw(G.disc,{at:[q.w[0]+1.2+lift*.2,0,q.w[2]-1.8-lift*.3],s:[r,1,r],mode:M_RAD,col:[0,0,0,Math.max(0,.55-lift*.02)]})}
  if(S&&S.deck&&S.deck.length&&S.phase!=='over'){ // Kartenstapel beim Geber
    const dp=deckPos(),dh=Math.max(.6,S.deck.length*.12),at=W(dp.x,dp.y,0);
    if(!isMini)draw(G.disc,{at:[at[0]+2+dh*.15,0,at[2]-3-dh*.2],s:[(46+dh*.8)*DECK_SCALE,1,(54+dh*.8)*DECK_SCALE],mode:M_RAD,col:[0,0,0,.3+Math.min(.15,dh*.012)]});
    decal(false);draw(G.stack,{at,s:[45*DECK_SCALE,dh,65*DECK_SCALE],rot:-dp.a*Math.PI/180,mode:6,col:rgba(COL.raw.card),amb:.6});decal(true);
    if(!backTex)backTex=makeBackTex();
    draw(G.card,{at:[at[0],dh+.12,at[2]],s:[DECK_SCALE,1,DECK_SCALE],rot:-dp.a*Math.PI/180,mode:M_TEX,tex:backTex,amb:isMini?1:.78});
  }
  if(S&&S.last&&cardTex.length){
    const pn=pileCount(),hh=Math.max(.5,Math.min(110,pn)*.12),pc=pileCards();
    if(!isMini)draw(G.disc,{at:[2+hh*.15,0,-3-hh*.2],s:[46+hh*.8,1,54+hh*.8],mode:M_RAD,col:[0,0,0,.3+Math.min(.15,hh*.012)]});
    if(pn>1){decal(false);draw(G.stack,{at:[0,0,-6],s:[45,hh,65],rot:.025,mode:6,col:rgba(COL.raw.card),amb:.55});decal(true)}
    gl.uniform1f(U.uAmb,.75);
    for(let i=pc.length-1;i>=0;i--)if(cardTex[i])draw(G.card,{at:[0,hh+.15+(pc.length-1-i)*.3,-6],rot:-pileRot(pc[i].card)*Math.PI/180,mode:M_TEX,tex:cardTex[i],amb:isMini?1:.78});
  }
  const glow={};
  for(const h of HL){
    const at=W(h.x,h.y,.4);
    if(h.cls==='canring'){draw(G.canR,{at,mode:M_FLAT,col:withA(COL.sel,.35+.6*pulse)});glow[key(h)]=.18*pulse}
    else if(h.cls==='selring'){draw(G.selR,{at,mode:M_FLAT,col:withA(COL.sel,.95)});glow[key(h)]=.32}
    else if(h.cls==='target'){draw(G.disc,{at,s:10,mode:M_FLAT,col:[1,1,1,.32]});draw(G.tgtR,{at,mode:M_FLAT,col:withA(COL.sel,.4+.6*pulse)})}
  }
  decal(false);
  for(let i=0;i<16;i++){const q=MP[i];const g=glow[Math.round(q.x)+','+Math.round(q.y)]||0;
    gl.uniform3fv(U.uCol2,COL.ballL[i>>2]);draw(G.ball,{at:q.w,s:8,mode:M_BALL,col:COL.ball[i>>2],em:g})}
  if(!isMini){gl.depthMask(false);
    for(const h of HL)if(h.cls==='target')draw(G.beam,{at:W(h.x,h.y,.4),s:[7,mode==='pov'?46:34,7],mode:M_FADE,col:withA(COL.sel,.18+.22*pulse)});
    gl.depthMask(true)}
}
const key=h=>Math.round(h.x)+','+Math.round(h.y);

// ---------- Ablauf ----------
let raf=0,last=0,curMain=null,curMini=null,miniRect=null;
function size(){const r=wrap.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}return {w:r.width,h:r.height,dpr}}
function frame(t){
  if(mode==='2d'){raf=0;return}
  raf=requestAnimationFrame(frame);
  const dt=Math.min(.1,last?(t-last)/1000:0);last=t;
  if(!S)return;
  const {w,h,dpr}=size();
  readMarbles();if(dirty)syncDom();drawCard();
  gl.disable(gl.SCISSOR_TEST);gl.viewport(0,0,cv.width,cv.height);
  gl.clearColor(COL.bg[0],COL.bg[1],COL.bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  curMain=mainCam(dt,w/h);scene(curMain,false,t);
  if(mode==='pov'){
    const s=Math.round(Math.min(w*.36,200)),m=10;miniRect={x:w-s-m,y:m,s};
    miniEl.style.cssText=`left:${w-s-m}px;top:${m}px;width:${s}px;height:${s}px`;
    const X=Math.round((w-s-m)*dpr),Y=Math.round((h-m-s)*dpr),SS=Math.round(s*dpr);
    gl.enable(gl.SCISSOR_TEST);gl.scissor(X,Y,SS,SS);gl.viewport(X,Y,SS,SS);
    gl.clearColor(COL.panel[0],COL.panel[1],COL.panel[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    curMini=miniCam(1);scene(curMini,true,t);
    gl.disable(gl.DEPTH_TEST);
    const f=curMain.f,rot=Math.atan2(-f[2],f[0]),at=[curMain.eye[0],20,curMain.eye[2]];
    draw(G.wedge,{at,rot,mode:M_FLAT,col:withA(COL.ink,.16)});
    draw(G.marker,{at,rot,s:1.25,mode:M_FLAT,col:withA(COL.ink,.95)});
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);
  }else miniRect=null;
  {const l=S.last,pt=l&&project(curMain,W(C,C+35,2));
    if(!pt||Math.abs(pt[0])>1.05||Math.abs(pt[1])>1.05)PILE3D.style.visibility='hidden';
    else{const t=(l.p===0?'du':NAMES[l.p])+(l.card.r==='JO'&&l.val?' · als '+rankLabel(l.val):'')+(l.fold?' · abgelegt':'');if(PILE3D.textContent!==t)PILE3D.textContent=t;PILE3D.style.color=`var(--c${l.p})`;
      PILE3D.style.visibility='';PILE3D.style.transform=`translate(${((pt[0]*.5+.5)*w).toFixed(1)}px,${((.5-pt[1]*.5)*h).toFixed(1)}px) translate(-50%,-50%) scale(.72)`}}
  for(let p=0;p<4;p++){const d=LABS[p];const pt=project(curMain,W(+d.dataset.x,+d.dataset.y,10));
    if(!pt||Math.abs(pt[0])>1.05||Math.abs(pt[1])>1.05){d.style.visibility='hidden';continue}
    let x=(pt[0]*.5+.5)*w,y=(.5-pt[1]*.5)*h;
    if(miniRect&&x>miniRect.x-50&&y<miniRect.y+miniRect.s+20){d.style.visibility='hidden';continue}
    const sc=Math.min(1.05,Math.max(.62,(mode==='3d'?560:260)/pt[2]*Math.min(1,w/560+.25)));d.style.visibility='';d.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${sc.toFixed(3)})`}
}
function start(){if(!raf){last=0;raf=requestAnimationFrame(frame)}}

// ---------- Eingabe ----------
function pick(cam,nx,ny){
  const {o,d}=ray(cam,nx,ny);let best=null,bt=1e9;
  for(const h of HL){if(h.cls!=='hit')continue;
    if(h.el.dataset.mid!=null){const c=W(h.x,h.y,5),oc=sub(o,c),b=dot(oc,d),cc=dot(oc,oc)-11*11,disc=b*b-cc;
      if(disc>=0){const tt=-b-Math.sqrt(disc);if(tt>0&&tt<bt){bt=tt;best=h}}}
    else if(d[1]<0){const tt=(.5-o[1])/d[1];const p=add(o,mulS(d,tt));if(Math.hypot(p[0]-(h.x-C),p[2]-(h.y-C))<12.5&&tt<bt){bt=tt;best=h}}}
  if(best)return best;
  if(d[1]>=0)return null;
  // grosszügig: nächstgelegene Markierung auf Murmelhöhe
  const tt=(4-o[1])/d[1],p=add(o,mulS(d,tt));let bd=cam.ortho?14:19;
  for(const h of HL){if(h.cls!=='hit')continue;const dd=Math.hypot(p[0]-(h.x-C),p[2]-(h.y-C));if(dd<bd){bd=dd;best=h}}
  return best;
}
function pickAt(cx,cy){
  const r=cv.getBoundingClientRect(),x=cx-r.left,y=cy-r.top;
  if(miniRect&&x>=miniRect.x&&x<=miniRect.x+miniRect.s&&y>=miniRect.y&&y<=miniRect.y+miniRect.s&&curMini)
    return pick(curMini,(x-miniRect.x)/miniRect.s*2-1,1-(y-miniRect.y)/miniRect.s*2);
  if(!curMain)return null;return pick(curMain,x/r.width*2-1,1-y/r.height*2);
}
const ptr=new Map();let drag=null,pinch=0;
function zoom(f){if(mode==='3d')orbit.dist=Math.min(1300,Math.max(240,orbit.dist*f));else pov.dist=Math.min(110,Math.max(16,pov.dist*f))}
function turn(dx,dy){if(mode==='3d'){orbit.th-=dx*.008;orbit.ph=Math.min(1.42,Math.max(.12,orbit.ph-dy*.006))}else{pov.yaw-=dx*.006;pov.pitch=Math.min(.9,Math.max(-.5,pov.pitch+dy*.004))}}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptr.size===1)drag={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,moved:false};
  else{if(drag)drag.moved=true;const [a,b]=[...ptr.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1])}});
cv.addEventListener('pointermove',e=>{
  if(!ptr.has(e.pointerId)){if(e.pointerType==='mouse'){const h=pickAt(e.clientX,e.clientY);cv.style.cursor=h?'pointer':''}return}
  ptr.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptr.size>=2){const [a,b]=[...ptr.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)zoom(pinch/d);pinch=d;return}
  if(!drag)return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)>7){drag.moved=true;cv.classList.add('dragging')}
  if(drag.moved){turn(e.clientX-drag.x,e.clientY-drag.y)}
  drag.x=e.clientX;drag.y=e.clientY});
function up(e){
  if(drag&&!drag.moved&&ptr.size===1&&e.type==='pointerup'){const h=pickAt(e.clientX,e.clientY);if(h&&!busy)onBoardClick({target:h.el})}
  ptr.delete(e.pointerId);if(ptr.size<2)pinch=0;if(!ptr.size){drag=null;cv.classList.remove('dragging')}}
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.0012))},{passive:false});
cv.addEventListener('keydown',e=>{const k={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];
  if(k){e.preventDefault();turn(k[0],k[1])}else if(e.key==='+'||e.key==='='){zoom(.9)}else if(e.key==='-'){zoom(1.1)}});
$('v3reset').onclick=()=>{if(mode==='3d')Object.assign(orbit,ORBIT0);else{pov.yaw=0;pov.pitch=0;pov.dist=46}};

// ---------- Modus ----------
const HINTS={'3d':'Ziehen dreht das Brett, Mausrad oder zwei Finger zoomen.','pov':'Du fährst mit der Murmel mit. Ziehen, um dich umzusehen. Murmeln und Felder kannst du auch auf der Karte oben rechts antippen.'};
const shown={};let hintT=0;
function hint(m){if(shown[m])return;shown[m]=1;hintEl.textContent=HINTS[m];hintEl.hidden=false;clearTimeout(hintT);hintT=setTimeout(()=>{hintEl.hidden=true},5200)}
function setMode(m,quiet){
  mode=m;try{localStorage.setItem(VIEW_KEY,m)}catch(e){}
  box.classList.toggle('is3d',m!=='2d');miniEl.hidden=m!=='pov';
  cv.setAttribute('aria-label',m==='pov'?'Spielbrett aus Murmelsicht, mit Übersichtskarte':'Spielbrett in 3D. Pfeiltasten drehen, Plus und Minus zoomen.');
  if(m!=='2d'){if(!boardTex)buildBoardTex();dirty=true;cardKey='';pov.eye=null;if(!quiet)hint(m);start()}
}
sel.onchange=e=>setMode(e.target.value);
const reTheme=()=>{if(boardTex||mode!=='2d'){buildBoardTex();cardKey=''}};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(reTheme,50));
new MutationObserver(reTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
document.fonts&&document.fonts.ready.then(()=>{cardKey=''});

// Karten fliegen beim Tausch zu den Sitzplätzen in der 3D-Szene
const seat2d=seatPt;
setSeatPt(function(p){
  if(mode==='2d')return seat2d(p);
  const r=cv.getBoundingClientRect(),[a,b]=rot(p,0,150);
  if(mode==='3d'&&curMain){const s=project(curMain,[a,6,b]);if(s&&Math.abs(s[0])<1.2&&Math.abs(s[1])<1.2)return [r.left+(s[0]*.5+.5)*r.width,r.top+(.5-s[1]*.5)*r.height]}
  return [r.left+r.width*(.5+a/430),r.top+r.height*(.5+b/430)];

});

let saved='2d';try{saved=localStorage.getItem(VIEW_KEY)||'2d'}catch(e){}
if(!['2d','3d','pov'].includes(saved))saved='2d';
sel.value=saved;setMode(saved,true);
window.__v3={get mode(){return mode},orbit,pov,setMode,scr(x,y,h,mini){const r=cv.getBoundingClientRect();if(mini&&miniRect){const c=curMini,s=project(c,W(x,y,h));return [r.left+miniRect.x+(s[0]*.5+.5)*miniRect.s,r.top+miniRect.y+(.5-s[1]*.5)*miniRect.s]}const s=project(curMain,W(x,y,h));return s&&[r.left+(s[0]*.5+.5)*r.width,r.top+(.5-s[1]*.5)*r.height]}};
})();
