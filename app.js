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
    ['week','Week','M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
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
  const ac=new AbortController();const to=setTimeout(()=>ac.abort(),90000);
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
  else if(SCREEN==='week')renderWeek();
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
  h+=`<div class="hintcard"><b>${MEALS[slot]} quick take</b><span id="quicktake">${esc(quickTake(slot))}</span></div>`;
  ensurePlan();
  if(S.prefs.groReminders){
    const e=(S.week.slots||{})[dstr(1)]||{};
    const names=['b','l','d'].map(sl=>e[sl]!=null?RECIPES[e[sl]].n:null).filter(Boolean);
    if(names.length){const sv=WK.scope;WK.scope='tomorrow';const n=groceryList().filter(([g])=>!S.week.have[g]).length;WK.scope=sv;
      h+=`<div class="hintcard nudge"><b>Tomorrow's groceries</b><span>${esc(names.join(', '))} - ${n} item${n===1?'':'s'} to order.</span><div class="gacts"><button class="cta ghost" onclick="go('week')">Open list</button><button class="cta ghost" onclick="shareGroceries('tomorrow')">Share</button></div></div>`}}
  h+=foodCarHTML();
  $('#view').innerHTML=h;
}
const FOOD_IMGS=[["Paneer curry","1585937421612-70a008356fbe"],["Pizza","1565299624946-b28f40a0ae38"],["Salad bowl","1546069901-ba9599a7e63c"],["Pancakes","1567620905732-2d1ec7ab7445"],["Veggie bowl","1540189549336-e6e99c3679fe"],["Skewers","1555939594-58d7cb561ad1"],["Dinner plate","1414235077428-338989a2e8c0"],["Green salad","1512621776951-a57141f2eefd"],["Pasta","1473093295043-cdd812d0e601"],["Burger","1550547660-d9450f859349"],["Home plate","1504674900247-0877df9cc836"],["Thali","1606491956689-2ea866880c84"]];
function foodCarHTML(){
  const cards=FOOD_IMGS.map(([t,id])=>`<div class="fcard"><img loading="lazy" src="https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&q=60" alt="${t}"><div class="l">${t}</div></div>`).join('');
  return `<div class="foodcar"><div class="ftrack">${cards}${cards}</div></div>`;
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
  if(!COOK)COOK={photo:S.draftPhoto||null,busy:false,err:null,mode:null};
  const st=COOK;
  let h=`<div class="largetitle"><div class="gt">Cook at home</div><h1>What is in the kitchen?</h1></div>`;
  h+=`<div class="card"><h3>Snap the fridge or the shelf</h3><div class="sub">Open the fridge, or lay the ingredients on the counter. The chef reads the photo and suggests 2-3 recipes with prep time, ingredients and full method - text only, no videos.</div></div>`;
  if(st.photo){
    h+=`<div class="photopick">${st.photo?`<img src="${st.photo}">`:''}</div>
    <div class="photostatus">&#9989; Photo ready${st.busy?' - the chef is reading it<span class="loadingdots"></span>':''}</div>
    ${st.busy?'':`<div class="photobtns"><button class="cta" onclick="analyzeCook()">Suggest recipes</button>
    <button class="cta ghost" onclick="retakePhoto()">Retake / change photo</button></div>`}`;
  }else{
    h+=`<div class="photobtns">
      <button class="cta" onclick="pickCookPhoto('camera')">&#128247; Click a photo</button>
      <button class="cta ghost" onclick="pickCookPhoto('gallery')">&#128444; Upload from gallery</button>
    </div>`;
  }
  if(st.busy&&!st.photo)h+=`<div class="notice">The chef is reading your photo<span class="loadingdots"></span></div>`;
  if(st.err)h+=`<div class="notice warn">${esc(st.err)}</div>`;
  h+=`<button class="linkbtn" onclick="manualPick()">No photo? Pick your ingredients instead</button>`;
  const scans=S.scans||[];
  if(scans.length){
    h+=`<div class="secttl"><h2>Past scans</h2></div>`+scans.map(s=>`<button class="card scanrow" onclick="openScan(${s.id})"><img src="${s.thumb}"><div style="flex:1"><b>${s.recipes.length} recipe${s.recipes.length>1?'s':''}</b><div class="sub">${esc(s.recipes.map(r=>r.n).slice(0,2).join(', '))}</div><div class="sub sm">${fmtScanDate(s.ts)}</div></div><span class="hchev">&#8250;</span></button>`).join('');
  }
  $('#view').innerHTML=h;
}
window.retakePhoto=()=>{COOK.photo=null;S.draftPhoto=null;save();renderCook()};
window.openScan=id=>{const s=(S.scans||[]).find(x=>x.id===id);if(!s)return;COOK={photo:null,busy:false,err:null,result:{ai:true,ingredients:s.ingredients,recipes:s.recipes}};go('cookresult')};
function fmtScanDate(ts){const d=new Date(ts);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+', '+d.toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit'})}
window.pickCookPhoto=(mode)=>{let i=document.getElementById('cookfile');if(!i){i=document.createElement('input');i.id='cookfile';i.type='file';i.style.display='none';document.body.appendChild(i)}
  i.accept='image/*';
  if(mode==='camera')i.setAttribute('capture','environment');else i.removeAttribute('capture');
  i.onchange=async()=>{
  const f=i.files[0];if(!f)return;
  try{COOK.photo=await downscale(f,1200);S.draftPhoto=COOK.photo;save();COOK.err=null;renderCook()}catch(e){COOK.err='Could not read that photo - try another one.';renderCook()}
};i.value='';i.click()};
function downscale(file,max){return new Promise((res,rej)=>{const img=new Image();img.onerror=rej;img.onload=()=>{
  const sc=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  res(c.toDataURL('image/jpeg',0.82));URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(file)})}

function makeThumb(dataUrl,max){return new Promise((res,rej)=>{const img=new Image();img.onerror=rej;img.onload=()=>{
  const sc=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*sc));c.height=Math.max(1,Math.round(img.height*sc));
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  res(c.toDataURL('image/jpeg',0.7))};img.src=dataUrl})}

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
    a.recipes=a.recipes.filter(r=>r&&r.name&&Array.isArray(r.steps)&&r.steps.length).slice(0,3)
      .map(r=>({n:String(r.name),c:S.prefs.cuisines.includes(r.cuisine)?r.cuisine:S.prefs.cuisines[0],t:Math.max(5,parseInt(r.time_min)||25),diff:(r.difficulty==='Medium'?'Medium':'Easy'),veg:!!r.veg,vegan:!!r.vegan,egg:!!r.egg||(!r.veg&&/egg|anda/i.test(String(r.name)+' '+(r.uses||[]).join(' '))),uses:(r.uses||[]).slice(0,8),needs_extra:(r.needs_extra||[]).slice(0,6),steps:r.steps.slice(0,8)}));
    if(!a.recipes.length)throw new Error('bad');
    COOK.busy=false;COOK.result={ai:true,ingredients:a.ingredients_detected||[],recipes:a.recipes};
    try{const thumb=await makeThumb(COOK.photo,320);
      S.scans=[{id:Date.now(),ts:new Date().toISOString(),thumb,ingredients:COOK.result.ingredients,recipes:COOK.result.recipes},...(S.scans||[])].slice(0,10);
      S.draftPhoto=null;save()}catch(e){}
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
    h+=m.map((r,i)=>recipeRow(r,'local',i)).join('');
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
  return `<button class="card recipick" onclick="openRecipe('${src}',${i})">
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

/* ----- week planner + groceries ----- */
let WK={scope:'tomorrow',focus:null,pinned:false};
function dstr(off){const d=new Date();d.setDate(d.getDate()+off);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dlabel(off){if(off===0)return 'Today';if(off===1)return 'Tomorrow';return new Date(Date.now()+off*86400000).toLocaleDateString('en-US',{weekday:'short',day:'numeric'})}
function poolFor(slot){return RECIPES.map((r,i)=>i).filter(i=>dietOk(RECIPES[i])&&cuisineOk(RECIPES[i])&&RECIPES[i].meal.includes(slot))}
function ensurePlan(){
  if(!S.week)S.week={slots:{},have:{}};
  if(!S.week.have)S.week.have={};
  for(let o=0;o<7;o++){const ds=dstr(o);
    if(!S.week.slots[ds]){const e={};
      ['b','l','d'].forEach(sl=>{const p=poolFor(sl);if(p.length)e[sl]=p[Math.floor(Math.random()*p.length)]});
      S.week.slots[ds]=e}}
  const keep={};for(let o=0;o<7;o++)keep[dstr(o)]=1;
  Object.keys(S.week.slots).forEach(k=>{if(!keep[k])delete S.week.slots[k]});
  save();
}
function rerollSlot(ds,sl){const p=poolFor(sl).filter(i=>i!==S.week.slots[ds][sl]);if(!p.length)return;S.week.slots[ds][sl]=p[Math.floor(Math.random()*p.length)];save();render()}
function scopeDates(){return WK.scope==='tomorrow'?[dstr(1)]:[...Array(7)].map((_,i)=>dstr(i))}
function groceryList(){
  const need=new Map();
  scopeDates().forEach(ds=>{const e=S.week.slots[ds];if(!e)return;
    ['b','l','d'].forEach(sl=>{const i=e[sl];if(i==null)return;RECIPES[i].ing.forEach(g=>{if(!need.has(g))need.set(g,[]);need.get(g).push(RECIPES[i].n)})})});
  return [...need.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function focusIngs(){return WK.focus==null?null:new Set(RECIPES[WK.focus].ing)}
function wkHover(i){WK.focus=i;paintHl()}
function wkBlur(){if(!WK.pinned){WK.focus=null;paintHl()}}
function wkTap(i){WK.pinned=!(WK.pinned&&WK.focus===i);WK.focus=WK.pinned?i:null;paintHl();
  if(WK.pinned){const g=document.getElementById('grocard');if(g)g.scrollIntoView({behavior:'smooth'})}}
function paintHl(){const fi=focusIngs();
  document.querySelectorAll('.gro').forEach(el=>el.classList.toggle('hl',fi?fi.has(el.dataset.ing):false));
  document.querySelectorAll('.wrow').forEach(el=>el.classList.toggle('hl',WK.focus!=null&&+el.dataset.i===WK.focus))}
function wkHave(g){S.week.have[g]=S.week.have[g]?0:1;save();render()}
function wkScope(s){WK.scope=s;WK.pinned=false;WK.focus=null;render()}
function wkRem(){S.prefs.groReminders=!S.prefs.groReminders;save();render();toast(S.prefs.groReminders?"Tomorrow's list will greet you on the Today tab":'Grocery nudges off')}
function shareText(scope){
  const sv=WK.scope;WK.scope=scope;const list=groceryList().filter(([g])=>!S.week.have[g]);WK.scope=sv;
  const days=scope==='tomorrow'?dlabel(1)+"'s meals":"this week's meals";
  return `Groceries for ${days} (What Should I - Eat):\n`+list.map(([g,rs])=>`- ${g} (${rs.join(', ')})`).join('\n');
}
async function shareGroceries(scope){const t=shareText(scope);
  try{if(navigator.share){await navigator.share({title:'Grocery list',text:t});return}}catch(e){}
  try{await navigator.clipboard.writeText(t);toast('List copied - paste it anywhere')}catch(e){toast('Copy failed')}}
function waGroceries(scope){open('https://wa.me/?text='+encodeURIComponent(shareText(scope)),'_blank')}
function renderWeek(){
  ensurePlan();
  let h=`<div class="largetitle"><div class="gt">Plan, shop, done</div><h1>Your week</h1></div>`;
  for(let o=0;o<7;o++){const ds=dstr(o);const e=S.week.slots[ds]||{};
    h+=`<div class="daycard"><div class="dh"><b>${dlabel(o)}</b><span>${new Date(Date.now()+o*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>`;
    ['b','l','d'].forEach(sl=>{const i=e[sl];
      if(i==null){h+=`<div class="wrow empty"><span class="m">${MEALS[sl]}</span><span class="rn">No match - widen cuisines in You</span></div>`;return}
      const r=RECIPES[i];
      h+=`<button class="wrow" data-i="${i}" onmouseenter="wkHover(${i})" onmouseleave="wkBlur()" onclick="wkTap(${i})"><span class="m">${MEALS[sl]}</span><span class="rn">${esc(r.n)}</span><span class="rt">${r.t}m</span><span class="rr" title="Swap" onclick="event.stopPropagation();rerollSlot('${ds}','${sl}')">&#10227;</span></button>`});
    h+=`</div>`;
  }
  const list=groceryList();
  const toOrder=list.filter(([g])=>!S.week.have[g]);
  h+=`<div class="card" id="grocard"><h3>Groceries</h3>
    <div class="seg"><button class="${WK.scope==='tomorrow'?'on':''}" onclick="wkScope('tomorrow')">Tomorrow</button><button class="${WK.scope==='week'?'on':''}" onclick="wkScope('week')">This week</button></div>
    <div class="sub" style="margin:8px 0 2px">Tap what you already have - the rest is your order list. Tap a meal above to spotlight its ingredients.</div>
    ${list.map(([g,rs])=>`<button class="gro ${S.week.have[g]?'have':''}" data-ing="${esc(g)}" onclick="wkHave('${esc(g)}')"><span class="box"></span><span class="gi">${esc(g)}</span><span class="gu">${esc(rs.join(', '))}</span></button>`).join('')||'<div class="sub">No recipes planned.</div>'}
    <div class="gacts"><button class="cta" onclick="shareGroceries('${WK.scope}')">Share ${toOrder.length} to-order item${toOrder.length===1?'':'s'}</button><button class="cta ghost" onclick="waGroceries('${WK.scope}')">WhatsApp</button></div>
    <div class="togglerow"><div><b>Grocery nudges</b><div class="sub">Tomorrow's list greets you on the Today tab.</div></div><button class="switch ${S.prefs.groReminders?'on':''}" onclick="wkRem()" aria-label="Toggle grocery nudges"></button></div>
  </div>`;
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
  h+=`<div class="card about"><h3>About</h3><div class="sub">${APP_NAME} - part of What Should I. Your preferences stay on this device. Fridge photos go only to your own private AI proxy and are never stored.</div></div>`;
  $('#view').innerHTML=h;
}
window.setPref=(k,v)=>{S.prefs[k]=v;save();renderYou()};
window.youToggleCuisine=id=>{const a=S.prefs.cuisines;const i=a.indexOf(id);if(i>=0){if(a.length>1)a.splice(i,1)}else a.push(id);save();renderYou()};

/* ---------- boot ---------- */
if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js')}catch(e){}}
render();
