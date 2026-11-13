/* GLITCH 7 — UI controller. Standalone offline browser game, no accounts or trackers. */
(function(){
"use strict";
const Core=window.GlitchCore;
if(!Core){document.body.textContent="Game files are incomplete. Please reload the page.";return;}
const $=id=>document.getElementById(id);
const dom={
  board:$("board"), boardWrap:$("boardWrap"), phase:$("phaseLabel"), phaseDot:$("phaseDot"),
  round:$("roundTag"), difficulty:$("difficultyLabel"), timer:$("timerFill"),
  instruction:$("instruction"), time:$("timeLabel"), startOverlay:$("startOverlay"),
  overlayTitle:$("overlayTitle"), overlayDesc:$("overlayDesc"), intermission:$("intermission"),
  result:$("resultOverlay"), score:$("scoreDisplay"), correct:$("correctDisplay"),
  best:$("bestDisplay"), final:$("finalScore"), finalAccuracy:$("finalAccuracy"),
  trail:$("scoreTrail"), beat:$("beatMessage"), shareStatus:$("shareStatus"),
  dailyBtn:$("dailyBtn"), duelBtn:$("duelBtn"), soundBtn:$("soundToggle")
};
const params=new URLSearchParams(location.search);
const today=Core.utcDay(new Date());
const requestedDay=params.get("d");
let day=Core.validateDay(requestedDay)?requestedDay:today;
let challenge=Core.validateChallenge(params.get("c"))?params.get("c").toLowerCase():null;
let mode=challenge?"duel":"daily";
const targetRaw=params.get("beat");
let target=targetRaw!==null && /^(0|[1-9]\d{0,3})$/.test(targetRaw) && Number(targetRaw)<=1050 ? Number(targetRaw):null;
let score=0,hits=0,round=0,trail=[],phase="idle",snapshot=null,pickStarted=0;
let timeoutId=null,frameId=null,soundOn=false,audio=null;
const MEMORIZE_MS=2200, GLITCH_MS=350,REVEAL_MS=900;
function activeSeed(){return mode==="daily"?"daily:"+day:"duel:"+challenge;}
function localKey(){return "glitch7-best-"+activeSeed();}
function readBest(){try{return Number(localStorage.getItem(localKey()))||0;}catch{return 0;}}
function saveBest(value){try{if(value>readBest())localStorage.setItem(localKey(),String(value));}catch{}}
function setTimeoutSafe(fn,ms){timeoutId=setTimeout(()=>{timeoutId=null;fn();},ms);}
function stopClock(){
 if(timeoutId!==null){clearTimeout(timeoutId);timeoutId=null;}
 if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
}
function setMessage(text,urgent=false){
 dom.phase.textContent=text;
 dom.phaseDot.classList.toggle("hurry",urgent);
}
function playSound(kind){
 if(!soundOn)return;
 try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)return;
   if(!audio)audio=new AC();
   if(audio.state==="suspended")audio.resume().catch(()=>{});
   const oscillator=audio.createOscillator(),gain=audio.createGain();
   oscillator.connect(gain);gain.connect(audio.destination);
   oscillator.type=kind==="hit"?"sine":"triangle";
   const now=audio.currentTime;
   oscillator.frequency.setValueAtTime(kind==="hit"?640:kind==="miss"?220:390,now);
   oscillator.frequency.exponentialRampToValueAtTime(kind==="hit"?900:kind==="miss"?120:520,now+.11);
   gain.gain.setValueAtTime(.045,now);
   gain.gain.exponentialRampToValueAtTime(.001,now+.16);
   oscillator.start(now);oscillator.stop(now+.17);
 }catch{}
}
function updateHeader(){
 $("dateLabel").textContent=mode==="daily"?"EDITION "+day:"FRIEND DUEL · "+challenge.toUpperCase();
 dom.dailyBtn.classList.toggle("active",mode==="daily");
 dom.dailyBtn.setAttribute("aria-pressed",mode==="daily"?"true":"false");
 dom.duelBtn.classList.toggle("active",mode==="duel");
 dom.duelBtn.setAttribute("aria-pressed",mode==="duel"?"true":"false");
 dom.difficulty.textContent="LEVEL "+String(Math.min(round+1,7)).padStart(2,"0")+" / 07";
}
function updateStats(){
 dom.score.innerHTML=String(score).padStart(3,"0")+'<span>PTS</span>';
 dom.correct.innerHTML=String(hits).padStart(2,"0")+'<span> / 07</span>';
 const best=readBest();
 dom.best.textContent=best?String(best):"—";
}
function reset(modeName,seed,challengeTarget){
 stopClock();phase="idle";score=0;hits=0;round=0;trail=[];snapshot=null;
 mode=modeName;
 if(modeName==="duel")challenge=seed; else if(seed)day=seed;
 target=challengeTarget==null?null:challengeTarget;
 dom.board.innerHTML="";dom.board.classList.remove("hidden");
 dom.intermission.classList.add("hidden");
 dom.result.classList.add("hidden");
 dom.startOverlay.classList.remove("hidden");
 dom.overlayTitle.innerHTML=mode==="duel"?'CHALLENGE <span>ACCEPTED.</span>':'READY TO <span>GLITCH?</span>';
 dom.overlayDesc.textContent=mode==="duel"?
   "Same seven patterns as your friend. Think you can beat their score?":
   "One square changes after the flash. Find it before time runs out.";
 $("startBtn").querySelector("span").textContent=mode==="duel"?"START FRIEND CHALLENGE":"START THE CHALLENGE";
 dom.round.textContent="ROUND 0 / 7";dom.timer.style.width="0%";
 dom.instruction.textContent="THE GRID WILL APPEAR HERE";
 dom.time.textContent="—";setMessage("READY WHEN YOU ARE");
 updateHeader();updateStats();
}
function createChallenge(){
 let seed;
 if(window.crypto&&crypto.getRandomValues){
   const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
   seed=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
 }else seed=Core.hash32(String(Date.now())+":"+Math.random()).toString(16).padStart(8,"0");
 reset("duel",seed,null);
}
function switchDaily(){reset("daily",today,null);}
function mountTiles(pattern){
 const n=pattern.n;
 dom.board.classList.remove("hidden");
 dom.board.style.gridTemplateColumns="repeat("+n+", 1fr)";
 dom.board.style.gridTemplateRows="repeat("+n+", 1fr)";
 const frag=document.createDocumentFragment();
 for(let i=0;i<n*n;i++){
   const b=document.createElement("button");
   b.className="tile";b.type="button";b.disabled=true;
   b.setAttribute("aria-label","Tile "+(i+1)+", row "+(Math.floor(i/n)+1)+", column "+(i%n+1));
   b.style.background=pattern.palette[pattern.original[i]];
   b.addEventListener("click",()=>guess(i));
   frag.appendChild(b);
 }
 dom.board.replaceChildren(frag);
}
function startRun(){
 stopClock();score=0;hits=0;round=0;trail=[];phase="idle";
 dom.startOverlay.classList.add("hidden");
 dom.result.classList.add("hidden");
 updateStats();
 nextRound();
}
function nextRound(){
 stopClock();
 if(round>=Core.ROUNDS){finish();return;}
 phase="memorize";snapshot=Core.buildRound(activeSeed(),round);
 updateHeader();
 mountTiles(snapshot);
 setMessage("MEMORIZE THE COLORS");
 dom.round.textContent="ROUND "+(round+1)+" / 7";
 dom.instruction.textContent="REMEMBER THE PATTERN · ONE TILE WILL CHANGE";
 dom.time.textContent=(MEMORIZE_MS/1000).toFixed(1)+"s";
 dom.timer.style.width="100%";
 dom.timer.classList.remove("danger");
 playSound("start");
 const began=performance.now();
 function showCountdown(){
   if(phase!=="memorize")return;
   const remain=Math.max(0,MEMORIZE_MS-(performance.now()-began));
   dom.timer.style.width=(100*remain/MEMORIZE_MS).toFixed(1)+"%";
   dom.time.textContent=(remain/1000).toFixed(1)+"s";
   frameId=requestAnimationFrame(showCountdown);
 }
 showCountdown();
 setTimeoutSafe(()=>{
   stopClock();phase="glitch";dom.intermission.classList.remove("hidden");
   dom.board.classList.add("hidden");
   setMessage("WAIT FOR THE GLITCH",true);
   dom.instruction.textContent="WATCH CLOSELY…";
   dom.time.textContent="...";
   dom.timer.style.width="0%";
   setTimeoutSafe(showChanged,GLITCH_MS);
 },MEMORIZE_MS);
}
function showChanged(){
 if(phase!=="glitch")return;
 phase="pick";dom.intermission.classList.add("hidden");dom.board.classList.remove("hidden");
 const tiles=dom.board.querySelectorAll(".tile");
 tiles[snapshot.changedIndex].style.background=snapshot.palette[snapshot.after[snapshot.changedIndex]];
 tiles.forEach(t=>{t.disabled=false;t.classList.add("tile-clickable");});
 pickStarted=performance.now();
 setMessage("TAP THE CHANGED TILE",true);
 dom.instruction.textContent="ONE SQUARE CHANGED COLOR — WHICH ONE?";
 dom.timer.style.width="100%";dom.timer.classList.remove("danger");
 function tick(){
   if(phase!=="pick")return;
   const remain=Math.max(0,Core.PICK_MS-(performance.now()-pickStarted));
   dom.time.textContent=(remain/1000).toFixed(1)+"s";
   dom.timer.style.width=(100*remain/Core.PICK_MS).toFixed(1)+"%";
   dom.timer.classList.toggle("danger",remain<1800);
   if(remain<=0){guess(null);return;}
   frameId=requestAnimationFrame(tick);
 }
 tick();
}
function guess(index){
 if(phase!=="pick")return;
 const elapsed=Math.min(Core.PICK_MS,performance.now()-pickStarted);
 const right=index===snapshot.changedIndex;
 phase="reveal";stopClock();
 const nodes=dom.board.querySelectorAll(".tile");
 nodes.forEach(n=>{n.disabled=true;n.classList.remove("tile-clickable");});
 nodes[snapshot.changedIndex].classList.add("tile-right");
 if(index!==null&&!right)nodes[index].classList.add("tile-wrong");
 const earned=Core.pointsFor(elapsed,right);
 if(right){score+=earned;hits++;playSound("hit");}else playSound("miss");
 trail.push(right);
 setMessage(right?"NICE CATCH! +"+earned:"THE CHANGE WAS HERE",!right);
 dom.instruction.textContent=right?"GOT IT. NEXT ROUND COMING UP…":"WATCH FOR THE HIGHLIGHTED SQUARE";
 dom.time.textContent=right?"+"+earned:"0";
 dom.timer.style.width="0%";
 updateStats();
 setTimeoutSafe(()=>{round++;nextRound();},REVEAL_MS);
}
function finish(){
 stopClock();phase="done";
 saveBest(score);updateStats();
 dom.final.textContent=String(score).padStart(3,"0");
 dom.finalAccuracy.textContent=hits+" OF 7 CORRECT";
 dom.trail.replaceChildren();
 for(let i=0;i<7;i++){
   const el=document.createElement("span");
   el.className="trail-item"+(trail[i]?" hit":"");
   el.textContent=trail[i]?"✓":"×";
   el.setAttribute("aria-label","Round "+(i+1)+": "+(trail[i]?"correct":"missed"));
   dom.trail.appendChild(el);
 }
 dom.beat.classList.add("hidden");
 if(target!==null){
   dom.beat.classList.remove("hidden");
   dom.beat.textContent=score>target?"YOU BEAT THE CHALLENGE: "+target:
     score===target?"IT'S A TIE AT "+target+" POINTS":"TARGET TO BEAT: "+target+" POINTS";
 }
 dom.shareStatus.textContent="";
 dom.result.classList.remove("hidden");
 dom.instruction.textContent="YOU COMPLETED ALL SEVEN ROUNDS";
 dom.time.textContent="✓";
 setMessage("RUN COMPLETE");
}
function shareUrl(){
 if(!/^https?:$/.test(location.protocol))return "";
 const url=new URL(location.href);
 url.hash="";url.search="";
 if(mode==="daily")url.searchParams.set("d",day);
 else url.searchParams.set("c",challenge);
 url.searchParams.set("beat",String(score));
 return url.toString();
}
function reportText(){return Core.shareText(mode,day,score,hits,trail,shareUrl());}
async function shareResult(){
 const text=reportText(),url=shareUrl();
 if(navigator.share && url){
   try{await navigator.share({title:"GLITCH 7 · Catch the Change",text});dom.shareStatus.textContent="SHARED!";return;}
   catch(e){if(e&&e.name==="AbortError")return;}
 }
 try{
   await navigator.clipboard.writeText(text);
   dom.shareStatus.textContent=url?"RESULT + FRIEND LINK COPIED!":"RESULT COPIED. PUBLISH THE GAME TO SHARE A LIVE LINK.";
 }catch{
   const area=document.createElement("textarea");area.value=text;area.setAttribute("readonly","");
   area.style.position="fixed";area.style.left="-9999px";document.body.appendChild(area);
   area.select();
   const ok=document.execCommand("copy");area.remove();
   dom.shareStatus.textContent=ok?"SCORE COPIED!":"COPY UNAVAILABLE — SAVE A RESULT CARD INSTEAD.";
 }
}
function saveCard(){
 const w=1080,h=1920,c=document.createElement("canvas");c.width=w;c.height=h;
 const ctx=c.getContext("2d");
 if(!ctx)return;
 const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,"#17162b");grad.addColorStop(.58,"#101825");grad.addColorStop(1,"#10443d");
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle="#67f3dc33";ctx.lineWidth=3;
 for(let x=-200;x<1500;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-850,h);ctx.stroke();}
 const box=(x,y,a,b,r,fill)=>{
  ctx.beginPath();ctx.roundRect(x,y,a,b,r);ctx.fillStyle=fill;ctx.fill();
 };
 box(80,110,920,80,25,"#67f3dc");
 ctx.font="900 40px Arial";ctx.textAlign="center";ctx.fillStyle="#101421";ctx.fillText("GLITCH 7   ·   ONE TILE CHANGES",w/2,164);
 ctx.textAlign="left";ctx.fillStyle="#ffffff";ctx.font="900 95px Arial";ctx.fillText("CAN YOU",80,395);
 ctx.fillStyle="#a68afa";ctx.fillText("SPOT IT?",80,498);
 ctx.font="700 30px Arial";ctx.fillStyle="#b0bbca";ctx.fillText(mode==="daily"?"DAILY CHALLENGE · "+day:"FRIEND CHALLENGE",80,570);
 ctx.fillStyle="#67f3dc";ctx.textAlign="center";ctx.font="900 240px Arial";ctx.fillText(String(score),w/2,1000);
 ctx.font="900 35px Arial";ctx.fillStyle="#c6d7dc";ctx.fillText("POINTS",w/2,1072);
 ctx.font="900 46px Arial";ctx.fillStyle="#ffffff";ctx.fillText(hits+" / 7 CORRECT",w/2,1200);
 const y=1310,sz=95,gap=18,start=(w-(7*sz+6*gap))/2;
 trail.forEach((hit,i)=>{
   box(start+i*(sz+gap),y,sz,sz,15,hit?"#67f3dc":"#ff8999");
   ctx.font="900 55px Arial";ctx.fillStyle="#121723";
   ctx.fillText(hit?"✓":"×",start+i*(sz+gap)+sz/2,y+65);
 });
 ctx.textAlign="center";ctx.font="900 42px Arial";ctx.fillStyle="#ffffff";
 ctx.fillText("CHALLENGE YOUR FRIENDS",w/2,1570);
 ctx.font="500 31px Arial";ctx.fillStyle="#bec9d3";
 ctx.fillText("Free browser game · No account · 7 rounds",w/2,1650);
 const url=shareUrl();
 if(url){ctx.font="24px Arial";ctx.fillText(url.length>73?url.slice(0,73)+"…":url,w/2,1720);}
 ctx.font="900 37px Arial";ctx.fillStyle="#67f3dc";ctx.fillText("GLITCH7",w/2,1830);
 const name="glitch7-"+(mode==="daily"?day:challenge)+"-"+score+".png";
 const download=blob=>{
   if(!blob){dom.shareStatus.textContent="COULD NOT EXPORT RESULT CARD.";return;}
   const href=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=href;link.download=name;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(href),10000);
   dom.shareStatus.textContent="RESULT CARD SAVED!";
 };
 if(c.toBlob)c.toBlob(download,"image/png");else{
   const link=document.createElement("a");link.href=c.toDataURL("image/png");link.download=name;link.click();
   dom.shareStatus.textContent="RESULT CARD SAVED!";
 }
}
function openHelp(){$("helpDialog").showModal();}
function closeHelp(){$("helpDialog").close();}
$("startBtn").addEventListener("click",startRun);
$("againBtn").addEventListener("click",()=>reset(mode,mode==="daily"?day:challenge,target));
$("shareBtn").addEventListener("click",shareResult);
$("saveCardBtn").addEventListener("click",saveCard);
$("dailyBtn").addEventListener("click",switchDaily);
$("duelBtn").addEventListener("click",createChallenge);
$("challengeBtn").addEventListener("click",createChallenge);
$("howBtn").addEventListener("click",openHelp);
$("closeHelp").addEventListener("click",closeHelp);
$("gotItBtn").addEventListener("click",closeHelp);
dom.soundBtn.setAttribute("aria-label","Enable game sounds");
dom.soundBtn.addEventListener("click",()=>{
 soundOn=!soundOn;dom.soundBtn.classList.toggle("sound-active",soundOn);
 dom.soundBtn.setAttribute("aria-label",soundOn?"Mute game sounds":"Enable game sounds");
 dom.soundBtn.title=soundOn?"Mute game sounds":"Enable game sounds";
 if(soundOn)playSound("start");
});
$("year").textContent=String(new Date().getFullYear());
reset(mode,mode==="daily"?day:challenge,target);
})();