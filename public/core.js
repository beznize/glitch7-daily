/* GLITCH 7 game core — deterministic, dependency-free, usable in browser and Node. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports) module.exports=api;
  else root.GlitchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const PALETTE=["#8271F6","#55DBD0","#FFB37B","#94E39B","#FB789F","#A7BAF9"];
const GRID_SIZES=[4,4,5,5,6,6,7];
const ROUNDS=7;
const PICK_MS=6000;
function hash32(text) {
 let h=2166136261>>>0;
 for(let i=0;i<String(text).length;i++){h^=String(text).charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}
function randomGenerator(seed) {
 let a=seed>>>0;
 return function(){
   a=(a+0x6D2B79F5)>>>0;
   let t=a;
   t=Math.imul(t^(t>>>15),t|1);
   t^=t+Math.imul(t^(t>>>7),t|61);
   return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function utcDay(date) {
 let d=date instanceof Date?date:new Date(date);
 if(!Number.isFinite(d.getTime()))throw new Error("Invalid date");
 return d.toISOString().slice(0,10);
}
function validateDay(s){if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;try{return utcDay(s+"T12:00:00Z")===s;}catch{return false;}}
function validateChallenge(s){return typeof s==="string" && /^[a-f0-9]{8,16}$/i.test(s);}
function buildRound(seed,round) {
 if(!Number.isInteger(round)||round<0||round>=ROUNDS)throw new Error("Invalid round");
 const n=GRID_SIZES[round],count=n*n;
 const rng=randomGenerator(hash32(String(seed)+"::round::"+round));
 const original=[];
 for(let i=0;i<count;i++)original.push(Math.floor(rng()*PALETTE.length));
 const changedIndex=Math.floor(rng()*count),old=original[changedIndex];
 const diff=1+Math.floor(rng()*(PALETTE.length-1));
 const after=original.slice();
 after[changedIndex]=(old+diff)%PALETTE.length;
 return {n,original,after,changedIndex,palette:PALETTE.slice(),round};
}
function pointsFor(elapsed,correct) {
 if(!correct)return 0;
 const e=Math.max(0,Math.min(PICK_MS,Number(elapsed)||0));
 return 100+Math.max(0,Math.round(50*(PICK_MS-e)/PICK_MS));
}
function shareText(mode,day,score,hits,trail,url) {
 const label=mode==="daily"?"DAILY "+day:"FRIEND CHALLENGE";
 const icons=trail.map(x=>x?"🟩":"⬛").join("");
 const beat=typeof score==="number"?score:0;
 const message="GLITCH 7 ⚡ "+label+"\n"+icons+"\n"+hits+"/7 correct · "+beat+" points\nCan you spot the change?";
 return message+(url?"\n"+url:"");
}
return {PALETTE,GRID_SIZES,ROUNDS,PICK_MS,hash32,randomGenerator,utcDay,validateDay,validateChallenge,buildRound,pointsFor,shareText};
});