/* Aaj Kya Khau - app logic */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS='akk_v1';
let S=load();
function load(){try{return JSON.parse(localStorage.getItem(LS))||null}catch(e){return null}}
function save(){localStorage.setItem(LS,JSON.stringify(S))}

/* ---------- prefs ---------- */
function defaultPrefs(){return {style:null, // 'home' | 'out' | 'mix'
  diet:'nonveg', // 'veg' | 'nonveg' | 'vegan' | 'egg'
  cuisines:['indian','chinese','pizza','pasta','healthy'],
  done:false}}
function dietOk(item){const d=S.prefs.diet;
  if(d==='vegan')return !!item.vegan;
  if(d==='veg')return !!item.veg;
  if(d==='egg')return !!(item.veg||item.egg);
  return true}
function cuisineOk(item){return S.prefs.cuisines.includes(item.c)}

/* ---------- routing / back ---------- */
let SCREEN='today',PARAM=null,HIST=[];
function go(sc,p){if(SCREEN===sc&&JSON.stringify(PARAM||null)===JSON.stringify(p||null)){render();return}
  HIST.push([SCREEN,PARAM]);try{history.pushState({sc,p},'')}catch(e){}
  SCREEN=sc;PARAM=p||null;render()}
function back(){const h=HIST.pop();if(h){SCREEN=h[0];PARAM=h[1]}else{SCREEN='today';PARAM=null}render()}
window.addEventListener('popstate',()=>{back()});
try{history.replaceState({sc:'today'},'')}catch(e){}

/* ---------- shared ui ---------- */
function slotNow(){const h=new Date().getHours();for(const [a,b,id] of SLOT_HOURS){if(h>=a&&h<b)return id}return 'n'}
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
function nav(){
  const items=[['today','Today','M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10'],
    ['cook','Cook','M6 13h12M6 13a6 6 0 0 1 12 0M9 10V7M12 10V6M15 10V7M4 17h16'],
    ['out','Eat out','M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    ['you','You','M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 4-6 8-6s8 2 8 6']];
  const map={recipe:'cook',cookresult:'cook'};
  const cur=map[SCREEN]||SCREEN;
  $('#nav').innerHTML='<div class="navin">'+items.map(([id,n,d])=>
    `<button class="${cur===id?'on':''}" onclick="go('${id}')"><svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>${n}</button>`).join('')+'</div>';
}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
function chipRow(list,cur,fn){return `<div class="chips">${list.map(c=>`<button class="chip ${cur===c.id||cur.includes&&cur.includes(c.id)?'on':''}" onclick="${fn}('${c.id}')">${c.n}</button>`).join('')}</div>`}
function vegBadge(r){return r.vegan?'<span class="badge vegan">Vegan</span>':r.veg?'<span class="badge veg">Veg</span>':r.egg?'<span class="badge egg">Egg</span>':'<span class="badge nonveg">Non-veg</span>'}
const CNAME=id=>(CUISINES.find(c=>c.id===id)||{}).n||id;

/* ---------- worker ---------- */
async function askWorker(sys,userText,b64img){
  const parts=[{text:userText}];
  if(b64img)parts.push({inline_data:{mime_type:'image/jpeg',data:b64img}});
  const body={system_instruction:{parts:[{text:sys}]},contents:[{role:'user',parts}]};
  const ac=new AbortController();const to=setTimeout(()=>ac.abort(),45000);
  try{
    const r=await fetch(WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ac.signal});
    clearTimeout(to);
    if(!r.ok)throw new Error('http_'+r.status);
    const j=await r.json();
    const t=(j.text||'').replace(/```json|```/g,'').trim();
    return JSON.parse(t);
  }catch(e){clearTimeout(to);throw e}
}
function prefsTxt(){const d={veg:'strictly vegetarian (no meat, fish or eggs)',nonveg:'non-vegetarian',vegan:'strictly vegan',egg:'eggetarian (eggs ok, no meat or fish)'}[S.prefs.diet];
  return `The person is ${d} and likes these cuisines: ${S.prefs.cuisines.map(CNAME).join(', ')}.`}

/* ---------- screens ---------- */
async function render(){
  nav();
  const v=$('#view');
  if(!S||!S.prefs||!S.prefs.done){renderOnboard();return}
  if(SCREEN==='today')renderToday();
  else if(SCREEN==='cook')renderCook();
  else if(SCREEN==='cookresult')renderCookResult();
  else if(SCREEN==='recipe')renderRecipe(PARAM);
  else if(SCREEN==='manual')renderManual();
  else if(SCREEN==='out')renderOut();
  else if(SCREEN==='you')renderYou();
  window.scrollTo(0,0);
}

/* ----- onboarding ----- */
let OB=null;
function renderOnboard(){
  $('#nav').innerHTML='';
  if(!OB)OB={step:1,p:defaultPrefs()};
  const p=OB.p;let h='';
  h+=`<div class="obhero"><div class="obemoji">&#127835;</div><h1>${APP_NAME}</h1><div class="obsub">What do I eat today? Answer once, get ideas forever.</div>
  <div class="stepsdots">${[1,2].map(i=>`<div class="st ${OB.step>=i?'on':''}"></div>`).join('')}</div></div>`;
  if(OB.step===1){
    h+=`<div class="card"><h3>Where do you usually eat?</h3>
    ${[['home','Mostly home-cooked','I like cooking from what I have'],['out','Mostly eating out','Restaurants, cafes, delivery'],['mix','A mix of both','Depends on the day']].map(([id,t,s])=>
      `<button class="pick ${p.style===id?'on':''}" onclick="OB.p.style='${id}';renderOnboard()"><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    <button class="cta ${p.style?'':'off'}" onclick="if(OB.p.style){OB.step=2;renderOnboard()}">Continue</button>`;
  }else{
    h+=`<div class="card"><h3>How do you eat?</h3>
    ${[['veg','Vegetarian'],['nonveg','Non-vegetarian'],['vegan','Vegan'],['egg','Eggetarian']].map(([id,t])=>
      `<button class="pick sm ${p.diet===id?'on':''}" onclick="OB.p.diet='${id}';renderOnboard()"><b>${t}</b></button>`).join('')}</div>
    <div class="card"><h3>Cuisines you enjoy</h3><div class="sub">Pick at least one - used for every suggestion.</div>
    ${chipRow(CUISINES,p.cuisines,'obToggleCuisine')}</div>
    <button class="cta ${p.cuisines.length?'':'off'}" onclick="if(OB.p.cuisines.length){finishOnboard()}">Start eating well</button>`;
  }
  $('#view').innerHTML=h;
}
window.obToggleCuisine=id=>{const a=OB.p.cuisines;const i=a.indexOf(id);if(i>=0){if(a.length>1)a.splice(i,1)}else a.push(id);renderOnboard()};
window.finishOnboard=()=>{OB.p.done=true;S={prefs:OB.p,cook:{},roll:{seen:[]}};save();try{history.replaceState({sc:'today'},'')}catch(e){}SCREEN='today';render()};

/* ----- today ----- */
function renderToday(){
  const slot=slotNow();const p=S.prefs;
  let h=`<div class="largetitle"><div class="gt">${greet()}</div><h1>${MEALS[slot]} time</h1></div>`;
  const cookFirst=p.style!=='out';
  const cookCard=`<button class="hero" onclick="go('cook')">
    <div class="hemoji">&#129348;</div>
    <div class="htxt"><b>Cook at home</b><span>Snap your fridge or ingredients - get 2-3 recipes you can make right now, with steps and prep time.</span></div>
    <span class="hchev">&#8250;</span></button>`;
  const outCard=`<button class="hero alt" onclick="go('out')">
    <div class="hemoji">&#127839;</div>
    <div class="htxt"><b>Eating out</b><span>Roll for a dish that fits your taste - ${p.cuisines.map(CNAME).slice(0,3).join(', ')}${p.cuisines.length>3?' and more':''}.</span></div>
    <span class="hchev">&#8250;</span></button>`;
  h+=cookFirst?cookCard+outCard:outCard+cookCard;
  h+=`<div class="hintcard"><b>'+MEALS[slot]+' quick take</b><span id="quicktake">${esc(quickTake(slot))}</span></div>`;
  $('#view').innerHTML=h;
}
function quickTake(slot){
  const pool=OUT_DISHES.filter(d=>cuisineOk(d)&&dietOk(d)&&d.meal.includes(slot));
  const d=pool[Math.floor(Math.random()*pool.length)];
  if(!d)return 'Roll on the Eat out tab when hunger strikes.';
  return `If you are heading out: ${d.n} - ${d.d.toLowerCase()}. If not, the Cook tab can read your fridge.`;
}

/* ----- cook ----- */
let COOK=null;
function renderCook(){
  if(!COOK)COOK={photo:null,busy:false,err:null,mode:null};
  const st=COOK;
  let h=`<div class="largetitle"><div class="gt">Cook at home</div><h1>What is in the kitchen?</h1></div>`;
  h+=`<div class="card"><h3>Snap the fridge or the shelf</h3><div class="sub">Open the fridge, or lay the ingredients on the counter. The chef reads the photo and suggests 2-3 recipes with prep time, ingredients and full method - text only, no videos.</div></div>`;
  h+=`<div class="photopick" onclick="pickCookPhoto()">${st.photo?`<img src="${st.photo}">`:'<span class="big">&#128247;</span><span>Tap to photograph or upload</span>'}</div>`;
  if(st.busy)h+=`<div class="notice">The chef is reading your photo<span class="loadingdots"></span></div>`;
  if(st.err)h+=`<div class="notice warn">${esc(st.err)}</div>`;
  if(st.photo&&!st.busy)h+=`<button class="cta" onclick="analyzeCook()">Suggest recipes</button>`;
  h+=`<button class="linkbtn" onclick="manualPick()">No photo? Pick your ingredients instead</button>`;
  $('#view').innerHTML=h;
}
window.pickCookPhoto=()=>{let i=document.getElementById('cookfile');if(!i){i=document.createElement('input');i.id='cookfile';i.type='file';i.accept='image/*';i.style.display='none';document.body.appendChild(i)}i.onchange=async()=>{
  const f=i.files[0];if(!f)return;
  try{COOK.photo=await downscale(f,1200);COOK.err=null;renderCook()}catch(e){COOK.err='Could not read that photo - try another one.';renderCook()}
};i.click()};
function downscale(file,max){return new Promise((res,rej)=>{const img=new Image();img.onerror=rej;img.onload=()=>{
  const sc=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  res(c.toDataURL('image/jpeg',0.82));URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(file)})}

window.analyzeCook=async()=>{
  COOK.busy=true;COOK.err=null;renderCook();
  const b64=COOK.photo.split(',')[1];
  const sys=`You are a warm, practical Indian home chef. Look at the photo of a fridge, shelf or laid-out ingredients. ${prefsTxt()}
Reply with strict JSON only, no markdown, no commentary:
{"ingredients_detected":["item",...],
 "recipes":[{"name":"dish name","cuisine":"one of: ${S.prefs.cuisines.join('|')}","time_min":number,"difficulty":"Easy|Medium","veg":true,"vegan":false,"egg":false,
   "uses":["ingredients from the photo it uses"],"needs_extra":["common pantry items assumed, or missing extras"],"steps":["step 1","step 2",...]}]}
Set egg:true when the dish contains eggs. Rules: exactly 2 or 3 recipes the person can realistically cook from what is visible (assume oil, salt, basic spices, onion, tomato, ginger, garlic are available). Respect the diet strictly. Prefer the person's liked cuisines. Steps must be complete enough to cook from - 3 to 6 short steps each. Text only, never links or videos.`;
  try{
    const a=await askWorker(sys,'What can I cook from this?',b64);
    if(!a||!Array.isArray(a.recipes)||!a.recipes.length)throw new Error('bad');
    a.recipes=a.recipes.filter(r=>r&&r.name&&Array.isArray(r.steps)&&r.steps.length).slice(0,3);
    if(!a.recipes.length)throw new Error('bad');
    COOK.busy=false;COOK.result={ai:true,ingredients:a.ingredients_detected||[],recipes:a.recipes};
    go('cookresult');
  }catch(e){
    COOK.busy=false;COOK.result=null;
    COOK.err='The AI chef is unreachable right now - pick your ingredients below and I will match recipes offline.';
    renderCook();manualPick(true);
  }
};

/* manual ingredient pick (fallback path) */
const PANTRY=['potato','onion','tomato','eggs','paneer','rice','spinach','cauliflower','chickpeas','poha','besan','oats','bread','cheese','pasta','noodles','curd','moong dal','toor dal','okra','cabbage','carrot','capsicum','chicken','sprouts','banana'];
let MANUAL=null;
window.manualPick=(silent)=>{MANUAL=MANUAL||{picked:[]};MANUAL.silent=silent;go('manual')};
function renderManual(){
  const silent=MANUAL&&MANUAL.silent;
  let h=`<div class="backbar"><button onclick="back()">&#8592; Back</button><h2>Pick ingredients</h2></div>`;
  if(silent)h+=`<div class="notice warn">AI photo reading is unavailable - this offline matcher works from what you pick.</div>`;
  h+=`<div class="card"><h3>What do you have?</h3><div class="sub">Tap everything available. Recipes update as you pick.</div>
  <div class="chips">${PANTRY.map(p=>`<button class="chip ${MANUAL.picked.includes(p)?'on':''}" onclick="toggleIng('${p}')">${p}</button>`).join('')}</div></div>`;
  const m=matchRecipes(MANUAL.picked);
  if(MANUAL.picked.length){
    h+=`<div class="secttl"><h2>${m.length?'You can make':'Nothing yet - add a couple more staples'}</h2></div>`;
    h+=m.map(r=>recipeRow(r,'local')).join('');
  }
  $('#view').innerHTML=h;window.scrollTo(0,0);
}
window.toggleIng=p=>{const a=MANUAL.picked;const i=a.indexOf(p);if(i>=0)a.splice(i,1);else a.push(p);renderManual()};

function matchRecipes(picked){
  if(!picked.length)return[];
  return RECIPES.filter(r=>dietOk(r)&&cuisineOk(r))
    .map(r=>{const have=r.ing.filter(i=>picked.includes(i));return {r,score:have.length/r.ing.length,have}})
    .filter(x=>x.score>=0.4&&x.have.length>=2)
    .sort((a,b)=>b.score-a.score).slice(0,5)
    .map(x=>({...x.r,match:Math.round(x.score*100)}));
}

/* ----- cook results ----- */
function renderCookResult(){
  const res=COOK&&COOK.result;if(!res){go('cook');return}
  let h=`<div class="backbar"><button onclick="back()">&#8592; Back</button><h2>From your kitchen</h2></div>`;
  if(res.ingredients.length)h+=`<div class="card"><h3>The chef spotted</h3><div class="chips ro">${res.ingredients.map(i=>`<span class="chip on ro">${esc(i)}</span>`).join('')}</div></div>`;
  h+=`<div class="secttl"><h2>You can cook</h2></div>`;
  h+=res.recipes.map((r,i)=>recipeRow(r,'ai',i)).join('');
  h+=`<button class="linkbtn" onclick="COOK=null;go('cook')">Try another photo</button>`;
  $('#view').innerHTML=h;
}
function recipeRow(r,src,i){
  const idx=src==='ai'?i:RECIPES.indexOf(RECIPES.find(x=>x.n===r.n));
  return `<button class="card recipick" onclick="openRecipe('${src}',${idx})">
    <div class="rtop"><b>${esc(r.n)}</b>${vegBadge(r)}</div>
    <div class="rmeta"><span>&#9200; ${r.t||r.time_min} min</span><span>${esc(r.diff)}</span><span>${esc(CNAME(r.c)||'')}</span>${r.match?`<span class="matchbadge">${r.match}% match</span>`:''}</div>
    <div class="ruses">Uses: ${esc((r.uses||r.ing||[]).slice(0,5).join(', '))}</div>
  </button>`;
}
window.openRecipe=(src,i)=>go('recipe',{src,i});

/* ----- recipe detail ----- */
function renderRecipe(p){
  let r=null;
  if(p.src==='ai')r=COOK&&COOK.result&&COOK.result.recipes[p.i];
  else{const m=matchRecipes(MANUAL?MANUAL.picked:[]);r=m[p.i]||null}
  if(!r){back();return}
  const steps=r.steps||[];const ing=r.uses||r.ing||[];
  let h=`<div class="backbar"><button onclick="back()">&#8592; Back</button><h2>${esc(r.n)}</h2></div>`;
  h+=`<div class="card hero-r"><div class="rtop"><b class="rname">${esc(r.n)}</b>${vegBadge(r)}</div>
    <div class="rmeta"><span>&#9200; ${r.t||r.time_min} min prep + cook</span><span>${esc(r.diff)}</span><span>${esc(CNAME(r.c)||'')}</span></div></div>`;
  h+=`<div class="card"><h3>Ingredients</h3><ul class="ing">${ing.map(i=>`<li>${esc(i)}</li>`).join('')}
    ${(r.needs_extra&&r.needs_extra.length)?r.needs_extra.map(i=>`<li class="extra">${esc(i)} <span class="x">assumed pantry</span></li>`).join(''):''}</ul></div>`;
  h+=`<div class="card"><h3>Method</h3><ol class="steps">${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`;
  h+=`<div class="notice soft">Text recipe only - no videos here, by design.</div>`;
  $('#view').innerHTML=h;
}

/* ----- eat out ----- */
let ROLL=null;
function renderOut(){
  if(!ROLL)ROLL={cur:null,ai:null,aibusy:false,seen:[]};
  const slot=slotNow();
  if(!ROLL.cur)ROLL.cur=rollDish(slot);
  const d=ROLL.cur;
  let h=`<div class="largetitle"><div class="gt">Eating out</div><h1>Roll for ${MEALS[slot].toLowerCase()}</h1></div>`;
  if(d){
    h+=`<div class="rollcard" id="rollcard">
      <div class="rollcuisine">${esc(CNAME(d.c))}</div>
      <div class="rollname">${esc(d.n)}</div>
      <div class="rollbadges">${vegBadge(d)}</div>
      <div class="rolldesc">${esc(d.d)}</div>
      <div class="rollat">Find it at: ${esc(d.at)}</div>
    </div>`;
  }else{
    h+=`<div class="notice warn">No dishes match those filters - widen your cuisines in the You tab.</div>`;
  }
  h+=`<button class="cta" onclick="reroll()">&#127922; Roll again</button>`;
  h+=`<button class="cta ghost" onclick="aiIdeas()" ${ROLL.aibusy?'disabled':''}>${ROLL.aibusy?'Asking the chef<span class="loadingdots"></span>':'Ask the chef for fresh ideas'}</button>`;
  if(ROLL.ai)h+=`<div class="secttl"><h2>Chef's ideas for ${MEALS[slot].toLowerCase()}</h2></div>`+ROLL.ai.map(a=>`
    <div class="card"><div class="rtop"><b>${esc(a.n)}</b>${a.tag?`<span class="badge aiidea">${esc(a.tag)}</span>`:''}</div><div class="rolldesc">${esc(a.why)}</div></div>`).join('');
  $('#view').innerHTML=h;
}
function rollDish(slot){
  if(!ROLL)ROLL={cur:null,ai:null,aibusy:false,seen:[]};
  const seen=ROLL.seen||[];
  let pool=OUT_DISHES.filter(d=>cuisineOk(d)&&dietOk(d)&&d.meal.includes(slot)&&!seen.includes(d.n));
  if(!pool.length)pool=OUT_DISHES.filter(d=>cuisineOk(d)&&dietOk(d)&&d.meal.includes(slot));
  if(!pool.length)pool=OUT_DISHES.filter(d=>cuisineOk(d)&&dietOk(d));
  if(!pool.length)return null;
  const d=pool[Math.floor(Math.random()*pool.length)];
  ROLL.seen=[...seen,d.n].slice(-8);
  return d;
}
window.reroll=()=>{const c=$('#rollcard');if(c){c.classList.add('spin')}
  setTimeout(()=>{ROLL.cur=rollDish(slotNow());renderOut()},260)};
window.aiIdeas=async()=>{
  ROLL.aibusy=true;renderOut();
  const slot=slotNow();
  const sys=`You are a food-obsessed friend in Dubai suggesting what to eat out. ${prefsTxt()} It is ${MEALS[slot]} time. Reply strict JSON only, no markdown: {"ideas":[{"n":"dish name","tag":"short tag like 'indulgent' or 'light'","why":"one short sentence why it fits right now"}]}. Exactly 3 ideas, specific dishes not cuisines, no restaurant names, no links.`;
  try{
    const a=await askWorker(sys,'Give me ideas.');
    ROLL.ai=(a.ideas||[]).filter(x=>x&&x.n&&x.why).slice(0,3);
    if(!ROLL.ai.length)throw new Error('bad');
  }catch(e){
    ROLL.ai=null;toast('Chef is unreachable - the dice still work');
  }
  ROLL.aibusy=false;renderOut();
};

/* ----- you ----- */
function renderYou(){
  const p=S.prefs;
  let h=`<div class="largetitle"><div class="gt">Your taste</div><h1>You</h1></div>`;
  h+=`<div class="card"><h3>Where do you usually eat?</h3>
    ${[['home','Mostly home-cooked'],['out','Mostly eating out'],['mix','A mix of both']].map(([id,t])=>
    `<button class="pick sm ${p.style===id?'on':''}" onclick="setPref('style','${id}')"><b>${t}</b></button>`).join('')}</div>`;
  h+=`<div class="card"><h3>How do you eat?</h3>
    ${[['veg','Vegetarian'],['nonveg','Non-vegetarian'],['vegan','Vegan'],['egg','Eggetarian']].map(([id,t])=>
    `<button class="pick sm ${p.diet===id?'on':''}" onclick="setPref('diet','${id}')"><b>${t}</b></button>`).join('')}</div>`;
  h+=`<div class="card"><h3>Cuisines you enjoy</h3>${chipRow(CUISINES,p.cuisines,'youToggleCuisine')}</div>`;
  h+=`<div class="card about"><h3>About</h3><div class="sub">${APP_NAME} - the third of the Aaj Kya family. Your preferences stay on this device. Fridge photos go only to your own private AI proxy and are never stored.</div></div>`;
  $('#view').innerHTML=h;
}
window.setPref=(k,v)=>{S.prefs[k]=v;save();renderYou()};
window.youToggleCuisine=id=>{const a=S.prefs.cuisines;const i=a.indexOf(id);if(i>=0){if(a.length>1)a.splice(i,1)}else a.push(id);save();renderYou()};

/* ---------- boot ---------- */
if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js')}catch(e){}}
render();
