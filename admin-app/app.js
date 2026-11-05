import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sections=[
 ["dashboard","لوحة المعلومات","◈"],["users","المستخدمون","♙"],["rooms","الغرف","◉"],["seats","المقاعد","▦"],["vip","VIP","✦"],["wallet","المحفظة","◈"],["gifts","الهدايا","✧"],["banners","البنرات","▧"],["notifications","الإشعارات","♧"],["assets","الأصول ثلاثية الأبعاد","◇"],["reports","البلاغات","⚑"],["roles","أدوار المشرفين","♜"],["settings","الإعدادات","⚙"],["analytics","التحليلات","▥"],["audit","سجل التدقيق","≋"]
];
const datasets={
 users:[["profiles","ملفات المستخدمين"],["user_bans","الحظر"]],
 rooms:[["rooms","الغرف"],["room_members","أعضاء الغرف"]],
 seats:[["room_seats","المقاعد"]],
 vip:[["vip_tiers","مستويات VIP"]],
 wallet:[["wallet_balances","الأرصدة"],["wallet_transactions","المعاملات"]],
 gifts:[["gifts","الهدايا"]],
 banners:[["admin_banners","البنرات"]],
 notifications:[["user_notifications","إشعارات المستخدمين"]],
 assets:[["admin_assets","مكتبة الأصول"]],
 reports:[["admin_reports","البلاغات"]],
 roles:[["admin_roles","أدوار المشرفين"]],
 settings:[["admin_settings","إعدادات التطبيق"]],
 audit:[["admin_audit_log","سجل التدقيق"]]
};
const readOnly=new Set(["wallet_transactions","admin_audit_log"]);
let currentUser=null,currentSection="dashboard",currentTable=null,currentRows=[],editing=null;
function notice(msg){const el=$("#notice");el.textContent=msg;el.classList.remove("hidden");setTimeout(()=>el.classList.add("hidden"),5000)}
function showLogin(msg=""){ $("#app").classList.add("hidden");$("#login").classList.remove("hidden");$("#login-error").textContent=msg}
function showApp(){ $("#login").classList.add("hidden");$("#app").classList.remove("hidden");$("#admin-email").textContent=currentUser.email||currentUser.id }
async function verifyAdmin(){
 const {data,error}=await db.from("admin_roles").select("role").eq("user_id",currentUser.id).maybeSingle();
 if(error) throw error;
 return data?.role||null;
}
async function enter(){
 const role=await verifyAdmin();
 if(!["super_admin","admin","moderator"].includes(role)){showLogin("هذا الحساب ليس ضمن فريق الإدارة. إذا كنت أول مشرف، استخدم زر تفعيل أول مشرف.");return}
 showApp();renderNav();await openSection("dashboard");
}
$("#login-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const {data,error}=await db.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){showLogin(error.message);return}currentUser=data.user;try{await enter()}catch(err){showLogin(err.message)}});
$("#claim").addEventListener("click",async()=>{const {data:{user}}=await db.auth.getUser();if(!user){showLogin("سجّل الدخول أولاً ثم اضغط تفعيل أول مشرف.");return}const {data,error}=await db.rpc("claim_first_admin");if(error){showLogin(error.message);return}if(!data){showLogin("تم تسجيل أول مشرف بالفعل. اطلب من المشرف الأعلى إضافتك.");return}currentUser=user;await enter()});
$("#logout").addEventListener("click",async()=>{await db.auth.signOut();currentUser=null;showLogin()});
db.auth.onAuthStateChange(async(_event,session)=>{if(session?.user&&!currentUser){currentUser=session.user;try{await enter()}catch(e){showLogin(e.message)}}});
function renderNav(){ $("#nav").innerHTML=sections.map(([id,label,icon])=>`<button class="nav-btn ${id===currentSection?"active":""}" data-section="${id}"><span>${icon}</span>　${label}</button>`).join("");$("#nav").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>openSection(b.dataset.section)))}
async function count(table){const {count,error}=await db.from(table).select("*",{count:"exact",head:true});if(error)throw error;return count||0}
async function dashboard(){
 const items=[["المستخدمون","profiles"],["الغرف","rooms"],["المقاعد المشغولة","room_seats"],["الهدايا","gifts"],["مستويات VIP","vip_tiers"],["البلاغات","admin_reports"],["الأصول","admin_assets"],["الإشعارات","user_notifications"]];
 const values=await Promise.all(items.map(async([label,table])=>[label,await count(table)]));
 $("#content").innerHTML=`<div class="stats">${values.map(([label,n])=>`<article class="stat"><b>${Number(n).toLocaleString("ar-EG")}</b><span>${label}</span></article>`).join("")}</div><div class="panel" style="margin-top:16px"><h3>حالة الاتصال</h3><p class="muted">اتصال Supabase نشط. جميع التعديلات تخضع لسياسات RLS وصلاحية المشرف على الخادم.</p><p class="hint">قاعدة البيانات: ${esc(new URL(SUPABASE_URL).hostname)} · الدور: ${esc((await verifyAdmin())||"غير معروف")}</p></div>`;
}
async function openSection(id){
 currentSection=id;renderNav();$("#section-title").textContent=sections.find(x=>x[0]===id)?.[1]||"";
 if(id==="dashboard"||id==="analytics"){await dashboard();if(id==="analytics")$("#content").insertAdjacentHTML("beforeend",'<div class="panel" style="margin-top:14px"><h3>التحليلات</h3><p class="muted">الأرقام أعلاه هي أعداد مباشرة من جداول الإنتاج، وليست بيانات تجريبية.</p></div>');return}
 const list=datasets[id];if(!list){$("#content").innerHTML='<p class="empty">لا توجد بيانات لهذا القسم.</p>';return}
 currentTable=list[0][0];renderDatasetPicker(list);await loadTable(currentTable);
}
function renderDatasetPicker(list){$("#content").innerHTML=`<div class="toolbar"><select id="dataset" aria-label="نوع البيانات">${list.map(([t,l])=>`<option value="${t}">${l}</option>`).join("")}</select><input id="search" placeholder="بحث في السجلات..."><button id="refresh" class="ghost">تحديث</button><button id="add" class="primary">إضافة سجل</button>${currentSection==="assets"||currentSection==="banners"?'<input id="upload" type="file" accept="image/*,.glb,.gltf,.bin"><button id="upload-btn" class="ghost">رفع ملف</button>':""}</div><div id="table-slot"></div>`;
 $("#dataset").addEventListener("change",e=>{currentTable=e.target.value;loadTable(currentTable)});
 $("#refresh").addEventListener("click",()=>loadTable(currentTable));
 $("#search").addEventListener("input",()=>renderRows($("#search").value));
 $("#add").addEventListener("click",()=>editRecord(null));
 if($("#upload-btn"))$("#upload-btn").addEventListener("click",uploadAsset);
 if(readOnly.has(currentTable))$("#add").disabled=true;
}
async function loadTable(table){
 currentTable=table;$("#table-slot").innerHTML='<p class="empty">جارٍ تحميل البيانات...</p>';
 let q=db.from(table).select("*").limit(150);
 if(table==="profiles"||table==="rooms"||table==="admin_reports"||table==="admin_assets"||table==="admin_banners"||table==="user_notifications"||table==="wallet_transactions"||table==="admin_audit_log")q=q.order("created_at",{ascending:false});
 const {data,error}=await q;if(error){$("#table-slot").innerHTML=`<p class="error">${esc(error.message)}</p>`;return}
 currentRows=data||[];renderRows($("#search")?.value||"");
 $("#add").disabled=readOnly.has(table);
}
function renderRows(term=""){
 const rows=currentRows.filter(r=>JSON.stringify(r).toLowerCase().includes(term.toLowerCase()));
 if(!rows.length){$("#table-slot").innerHTML='<div class="panel empty">لا توجد سجلات مطابقة.</div>';return}
 const keys=Object.keys(rows[0]);const actions=readOnly.has(currentTable)?"":'<th>إجراءات</th>';
 $("#table-slot").innerHTML=`<div class="table-wrap"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join("")}${actions}</tr></thead><tbody>${rows.map((r,i)=>`<tr>${keys.map(k=>`<td title="${esc(typeof r[k]==="object"?JSON.stringify(r[k]):r[k])}">${esc(typeof r[k]==="object"?JSON.stringify(r[k]):r[k])}</td>`).join("")}${readOnly.has(currentTable)?"":`<td><div class="actions"><button class="ghost" data-edit="${i}">تعديل</button><button class="danger" data-delete="${i}">حذف</button></div></td>`}</tr>`).join("")}</tbody></table></div>`;
 $("#table-slot").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editRecord(rows[Number(b.dataset.edit)])));
 $("#table-slot").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteRecord(rows[Number(b.dataset.delete)])));
}
function editRecord(row){editing=row;$("#editor-title").textContent=row?"تعديل سجل":"إضافة سجل";$("#json-value").value=JSON.stringify(row||defaultRecord(currentTable),null,2);$("#editor").showModal()}
function defaultRecord(table){return ({profiles:{display_name:"",bio:""},rooms:{name:"",topic:""},room_seats:{room_id:"",seat_number:0,is_locked:false,is_muted:false},vip_tiers:{level:1,name:"VIP 1",price_coins:1000,duration_days:30},gifts:{id:crypto.randomUUID(),name:"",emoji:"🎁",price_coins:100,is_active:true},admin_banners:{title:"",body:"",image_url:"",is_active:true},user_notifications:{user_id:"",title:"",body:""},admin_assets:{asset_key:"",name:"",category:"general",url:"",metadata:{},is_active:true},admin_reports:{target_type:"user",target_id:"",reason:"",status:"open"},admin_roles:{user_id:"",role:"moderator"},admin_settings:{key:"",value:{}},user_bans:{user_id:"",reason:"",banned_until:null}})[table]||{}}
function keyFor(table,row){return ({profiles:["id"],rooms:["id"],room_seats:["room_id","seat_number"],vip_tiers:["level"],gifts:["id"],admin_banners:["id"],user_notifications:["id"],admin_assets:["id"],admin_reports:["id"],admin_roles:["user_id"],admin_settings:["key"],user_bans:["user_id"],room_members:["room_id","user_id"]})[table]||["id"]}
async function saveRecord(){
 let obj;try{obj=JSON.parse($("#json-value").value)}catch{$("#login-error").textContent="JSON غير صالح";return}
 const table=currentTable;let q;
 if(editing){q=db.from(table).update(obj);for(const k of keyFor(table,editing))q=q.eq(k,editing[k])}
 else q=db.from(table).insert(obj);
 if(table==="admin_settings")q=db.from(table).upsert(obj,{onConflict:"key"});
 const {error}=await q;if(error){notice(error.message);return}
 $("#editor").close();notice("تم الحفظ بنجاح");await loadTable(table);
 try{await db.rpc("admin_write_audit",{p_action:editing?"update":"insert",p_entity_type:table,p_entity_id:String(obj.id||obj.user_id||obj.key||""),p_details:{}})}catch{}
}
async function deleteRecord(row){if(!confirm("تأكيد حذف هذا السجل؟ لا يمكن التراجع عن الحذف."))return;let q=db.from(currentTable).delete();for(const k of keyFor(currentTable,row))q=q.eq(k,row[k]);const {error}=await q;if(error){notice(error.message);return}notice("تم الحذف");await loadTable(currentTable)}
$("#save-record").addEventListener("click",saveRecord);
async function uploadAsset(){
 const file=$("#upload").files?.[0];if(!file){notice("اختر ملفاً أولاً");return}
 const path=`${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
 const {error}=await db.storage.from("admin-assets").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
 if(error){notice(error.message);return}
 if(currentSection==="assets"){const {error:e}=await db.from("admin_assets").insert({asset_key:crypto.randomUUID(),name:file.name,category:file.type.startsWith("image/")?"image":"3d",url:path,metadata:{size:file.size,mime:file.type},is_active:true});if(e){notice(e.message);return}}
 if(currentSection==="banners"){const {error:e}=await db.from("admin_banners").insert({title:file.name,image_url:path,is_active:true});if(e){notice(e.message);return}}
 notice("تم رفع الملف إلى التخزين الخاص");await loadTable(currentTable);
}
(async()=>{const {data:{session}}=await db.auth.getSession();if(session?.user){currentUser=session.user;try{await enter()}catch(e){showLogin(e.message)}}})();
