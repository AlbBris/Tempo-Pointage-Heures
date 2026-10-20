(() => {
"use strict";
const STORAGE_KEY="tempo_pointage_v1";
const DEFAULTS={weeklyHours:39,creditSchool:true,creditSick:false};
const LABELS={work:"Travail",leave:"Congé",rtt:"RTT",school:"École",holiday:"Férié",sick:"Maladie",other:"Autre absence"};
const $=id=>document.getElementById(id);
const today=()=>localISO(new Date());
const getNowTime=()=>{const d=new Date();return `${z(d.getHours())}:${z(d.getMinutes())}`;};
const z=v=>String(v).padStart(2,"0");
const minOf=v=>{if(!v||!/^[0-2]\d:[0-5]\d$/.test(v))return null; const [h,m]=v.split(":").map(Number);return h<24?h*60+m:null;};
function localISO(d){return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;}
function asDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12);}
function addDays(s,n){const d=asDate(s);d.setDate(d.getDate()+n);return localISO(d);}
function monthKey(s){return s.slice(0,7);}
function shiftMonth(m,offset){let [y,mo]=m.split("-").map(Number);const d=new Date(y,mo-1+offset,1,12);return `${d.getFullYear()}-${z(d.getMonth()+1)}`;}
function monthDates(m){const [y,mo]=m.split("-").map(Number);const last=new Date(y,mo,0).getDate();return Array.from({length:last},(_,i)=>`${m}-${z(i+1)}`);}
function isWeekday(s){return ![0,6].includes(asDate(s).getDay());}
function isoMonday(s){const d=asDate(s);const wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return localISO(d);}
function duration(minutes,sign=false){const n=Math.round(Math.abs(minutes)||0);return `${sign?(minutes<0?"-":"+"):""}${Math.floor(n/60)}h${z(n%60)}`;}
function niceDate(s,opts={weekday:"long",day:"numeric",month:"long"}){return asDate(s).toLocaleDateString("fr-FR",opts);}
function niceMonth(m){return asDate(m+"-01").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).replace(/^./,ch=>ch.toUpperCase());}
function shortWeekday(s){return asDate(s).toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","");}
function round(n){return Math.round(n*100)/100;}
function load(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(data?.version===1&&data.records&&typeof data.records==="object"){
      const cleaned={};
      for(const [date,record] of Object.entries(data.records)) if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&record?.type in LABELS) cleaned[date]=record;
      return {records:cleaned,settings:{...DEFAULTS,...data.settings}};
    }
  }catch(err){console.warn("Impossible de lire les données",err);}
  return {records:{},settings:{...DEFAULTS}};
}
const state=load();
let calMonth=monthKey(today());
let reportMonth=calMonth;
let originalDialogDate=null;
let toastTimer;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,records:state.records,settings:state.settings}));return true;}catch(e){console.error(e);toast("Stockage indisponible : exporte une sauvegarde.");return false;}}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3300);}
function record(date){return state.records[date]||null;}
function getWorked(r,live=false){
  if(!r||r.type!=="work"||!r.start)return 0;
  const start=minOf(r.start);if(start===null)return 0;
  let stop=minOf(r.end);
  if(stop===null){if(live&&r.date===today())stop=minOf(getNowTime());else return 0;}
  if(stop===null||stop<=start)return 0;
  const lunchS=minOf(r.lunchStart),lunchE=minOf(r.lunchEnd);
  let pause=0;
  if(lunchS!==null){
    if(lunchE!==null&&lunchE>=lunchS)pause=Math.max(0,Math.min(lunchE,stop)-lunchS);
    else if(live&&!r.end)stop=Math.min(stop,lunchS);
  }else if(r.manualPause!==null&&r.manualPause!==undefined&&r.manualPause!=="")pause=Math.max(0,Number(r.manualPause)||0);
  return Math.max(0,stop-start-pause);
}
function isIncomplete(r){return !!(r&&r.type==="work"&&r.start&&!r.end&&r.date!==today());}
function credited(r){return !!(r&&isWeekday(r.date)&&(["leave","rtt","holiday"].includes(r.type)||(r.type==="school"&&state.settings.creditSchool)||(r.type==="sick"&&state.settings.creditSick)));}
function dailyRef(){return Number(state.settings.weeklyHours||39)*60/5;}
function statsForDates(dates){
  let worked=0,credit=0,ref=0,leaveCount=0,workDays=0;
  const now=today();
  for(const date of dates){
    if(isWeekday(date)&&date<=now)ref+=dailyRef();
    const r=record(date);
    if(!r)continue;
    if(r.type==="work"){
      const v=getWorked(r,true);worked+=v;
      if(r.start)workDays++;
    }else{leaveCount++;if(credited(r))credit+=dailyRef();}
  }
  return {worked,credit,ref,balance:worked+credit-ref,leaveCount,workDays};
}
function weekDates(monday){return Array.from({length:7},(_,i)=>addDays(monday,i));}
function weekStat(weekStart){return statsForDates(weekDates(weekStart));}
function statusOf(r){
  if(!r)return "empty";
  if(r.type!=="work")return "absence";
  if(r.end)return "finished";
  if(r.lunchStart&&!r.lunchEnd)return "paused";
  if(r.lunchEnd)return "resumed";
  if(r.start)return "working";
  return "empty";
}
function startOfDayRecord(date){return {date,type:"work",start:"",lunchStart:"",lunchEnd:"",end:"",manualPause:null,note:""};}
function doPunch(action){
  const date=today();let r=record(date);
  if(r&&r.type!=="work"){toast("Journée d'absence : modifie-la pour pointer.");return;}
  if(!r)r=startOfDayRecord(date);
  const time=getNowTime();const status=statusOf(r);
  let msg="";
  if(action==="skip"&&status==="working"){
    if(minOf(time)<=minOf(r.start)){toast("Le départ doit suivre l'arrivée.");return;}
    r.end=time;msg="Départ enregistré sans pause.";
  }else if(status==="empty"){
    r.start=time;msg="Arrivée pointée.";
  }else if(status==="working"){
    if(minOf(time)<=minOf(r.start)){toast("Laisse passer au moins une minute.");return;}
    r.lunchStart=time;r.manualPause=null;msg="Début du repas enregistré.";
  }else if(status==="paused"){
    if(minOf(time)<=minOf(r.lunchStart)){toast("La reprise doit suivre le début de pause.");return;}
    r.lunchEnd=time;msg="Reprise enregistrée.";
  }else if(status==="resumed"){
    if(minOf(time)<=minOf(r.lunchEnd)){toast("Le départ doit suivre la reprise.");return;}
    r.end=time;msg="Départ enregistré.";
  }else{openDayEditor(date);return;}
  r.updatedAt=new Date().toISOString();state.records[date]=r;
  if(persist()){renderAll();toast(msg);}
}
function navigate(view){
  document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id===view));
  document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  if(view==="todayView")renderToday();
  if(view==="calendarView")renderCalendar();
  if(view==="reportsView")renderReports();
  if(view==="settingsView")renderSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderTimeline(r){
  const labels=[["start","Arrivée","1"],["lunchStart","Repas","2"],["lunchEnd","Reprise","3"],["end","Départ","4"]];
  $("todayTimeline").innerHTML=labels.map(([key,label,num])=>{
    const mark=r?.type==="work"?r[key]||null:null;
    return `<div class="step ${mark?"done":""}"><div class="step-marker">${mark?"✓":num}</div><span>${label}</span><strong>${mark||"—"}</strong></div>`;
  }).join("");
}
function renderToday(){
  const date=today(),r=record(date),status=statusOf(r),worked=getWorked(r,true);
  $("todayDate").textContent=niceDate(date).replace(/^./,ch=>ch.toUpperCase());
  $("todayFlag").textContent=r?.type!=="work"&&r?LABELS[r.type]:"Pointage personnel";
  const statuses={empty:"Prêt pour la journée",working:"Journée en cours",paused:"Pause déjeuner",resumed:"De retour au travail",finished:"Journée terminée",absence:r?LABELS[r.type]:"Absence"};
  $("workStatus").textContent=statuses[status];
  const text=duration(worked);$("liveWorked").innerHTML=text.replace("h","<span>h</span>");
  const badge=$("liveBadge");badge.textContent=({empty:"À pointer",working:"● En cours",paused:"● En pause",resumed:"● En cours",finished:"✓ Terminé",absence:"Indisponible"})[status];
  badge.classList.toggle("active-status",status==="working"||status==="resumed");
  renderTimeline(r);
  const cta=$("punchButton"),skip=$("skipLunchButton");skip.classList.toggle("hidden",status!=="working");
  cta.textContent=({empty:"Pointer mon arrivée ↗",working:"Débuter ma pause ↗",paused:"Reprendre le travail ↗",resumed:"Pointer mon départ ↗",finished:"Voir / modifier la journée ↗",absence:"Modifier cette journée ↗"})[status];
  const week=weekStat(isoMonday(date));
  $("todayWeekHours").textContent=duration(week.worked);
  $("todayWeekTarget").textContent=`Référence à date : ${duration(week.ref)} / ${duration(state.settings.weeklyHours*60)} par semaine`;
  $("todayWeekBalance").textContent=duration(week.balance,true);
  $("todayWeekBalance").classList.toggle("balance-negative",week.balance<0);
  $("todayWeekBalance").classList.toggle("balance-positive",week.balance>=0);
  const dates=Object.keys(state.records).filter(d=>d<=date).sort().reverse().slice(0,5);
  renderDayList($("recentDays"),dates,"Aucune journée enregistrée. Lance ton premier pointage !");
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);}
function renderDayList(target,dates,empty){
  if(!dates.length){target.innerHTML=`<div class="empty">${empty}</div>`;return;}
  target.innerHTML=dates.map(date=>{
    const r=record(date);if(!r)return "";
    const d=asDate(date),label=LABELS[r.type],wd=shortWeekday(date);
    const msg=r.type==="work"?(r.start?`${esc(r.start)} ${r.end?"→ "+esc(r.end):"→ En cours"}${r.note?" · "+esc(r.note):""}`:"Horaires à préciser"):(r.note?esc(r.note):"Journée déclarée");
    const total=r.type==="work"?duration(getWorked(r,true)):label;
    const hint=isIncomplete(r)?"À compléter":r.type==="work"?r.end?"Journée terminée":"Pointage en cours":credited(r)?"Jour assimilé":"Jour déclaré";
    return `<button class="day-item" data-day="${date}" type="button"><div class="day-date"><span>${esc(wd)}</span><strong>${d.getDate()}</strong></div><div class="day-body"><strong>${esc(label)}</strong><span>${msg}</span></div><div class="day-result"><strong>${esc(total)}</strong><small class="${isIncomplete(r)?"warning":""}">${esc(hint)}</small></div></button>`;
  }).join("");
  target.querySelectorAll("[data-day]").forEach(b=>b.addEventListener("click",()=>openDayEditor(b.dataset.day)));
}
function renderCalendar(){
  $("calMonthButton").innerHTML=`${esc(niceMonth(calMonth))} <span>⌄</span>`;
  $("calMonthInput").value=calMonth;
  const first=calMonth+"-01",weekday=(asDate(first).getDay()+6)%7;
  const grid=$("calendarGrid");let html=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(x=>`<div class="cal-weekday">${x}</div>`).join("");
  for(let i=0;i<weekday;i++)html+='<div class="cal-cell outside" aria-hidden="true"></div>';
  for(const date of monthDates(calMonth)){
    const r=record(date),cls=r?.type==="work"?"work-cell":r?"leave-cell":"";
    const t=r?.type==="work"?(r.end?duration(getWorked(r)):r.start?"En cours":"—"):r?(LABELS[r.type].length>7?LABELS[r.type].slice(0,7):LABELS[r.type]):"";
    html+=`<button type="button" class="cal-cell ${cls} ${date===today()?"today-cell":""}" data-date="${date}" aria-label="${esc(niceDate(date))}, ${esc(t||"sans saisie")}"><span class="cal-num">${Number(date.slice(-2))}</span><small class="${isIncomplete(r)?"incomplete":""}">${esc(t)}</small></button>`;
  }
  grid.innerHTML=html;
  grid.querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>openDayEditor(b.dataset.date)));
  $("journalTitle").textContent=niceMonth(calMonth);
  const dates=monthDates(calMonth).filter(d=>record(d)).reverse();
  renderDayList($("monthDays"),dates,"Aucune journée saisie pour ce mois. Touche une date pour commencer.");
}
function renderReports(){
  $("reportMonthButton").innerHTML=`${esc(niceMonth(reportMonth))} <span>⌄</span>`;
  $("reportMonthInput").value=reportMonth;
  const dates=monthDates(reportMonth),stat=statsForDates(dates);
  $("reportWorked").textContent=duration(stat.worked);
  $("reportLeave").textContent=String(stat.leaveCount);
  $("reportCredit").textContent=duration(stat.credit);
  $("reportBalance").textContent=duration(stat.balance,true);
  $("reportBalance").classList.toggle("balance-positive",stat.balance>=0);
  $("reportBalance").classList.toggle("balance-negative",stat.balance<0);
  $("reportTargetText").textContent=`Référence à date : ${duration(stat.ref)}`;
  const mondaySet=[...new Set(dates.map(isoMonday))];
  $("weeklyBreakdown").innerHTML=mondaySet.map(monday=>{
    const sunday=addDays(monday,6),days=weekDates(monday).filter(d=>d.startsWith(reportMonth));
    const s=statsForDates(days),used=s.worked+s.credit;
    const pct=s.ref?Math.max(0,Math.min(100,100*used/s.ref)):0;
    return `<article class="week-card"><div class="week-top"><strong>Du ${esc(niceDate(monday,{day:"numeric",month:"short"}))} au ${esc(niceDate(sunday,{day:"numeric",month:"short"}))}</strong><small>${s.workDays} jour(s) pointé(s)</small></div><h4>${duration(s.worked)}<span>travaillées</span></h4><div class="week-track"><div class="week-fill" style="width:${pct}%"></div></div><div class="week-foot"><span>Assimilées : ${duration(s.credit)} · Réf. : ${duration(s.ref)}</span><span class="${s.balance<0?"balance-negative":"balance-positive"}">${duration(s.balance,true)}</span></div></article>`;
  }).join("");
}
function renderSettings(){
  $("weeklyHours").value=state.settings.weeklyHours;
  $("creditSchool").checked=!!state.settings.creditSchool;
  $("creditSick").checked=!!state.settings.creditSick;
}
function renderAll(){renderToday();renderCalendar();renderReports();}
function openDayEditor(date=today()){
  const r=record(date)||startOfDayRecord(date);originalDialogDate=record(date)?date:null;
  $("dayDialogTitle").textContent=record(date)?"Modifier la journée":"Ajouter une journée";
  $("entryDate").value=date;
  $("entryDate").disabled=!!record(date);
  $("entryType").value=r.type;
  $("entryStart").value=r.start||"";
  $("entryEnd").value=r.end||"";
  $("entryLunchStart").value=r.lunchStart||"";
  $("entryLunchEnd").value=r.lunchEnd||"";
  $("entryManualPause").value=r.manualPause??"";
  $("entryNote").value=r.note||"";
  $("entryError").classList.add("hidden");
  $("deleteDay").classList.toggle("hidden",!record(date));
  toggleEditorFields();
  $("dayDialog").showModal();
}
function toggleEditorFields(){const isWork=$("entryType").value==="work";$("workEntryFields").classList.toggle("hidden",!isWork);}
function editorError(msg){const el=$("entryError");el.textContent=msg;el.classList.remove("hidden");}
function saveDay(event){
  event.preventDefault();$("entryError").classList.add("hidden");
  const date=$("entryDate").value,type=$("entryType").value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!LABELS[type]){editorError("Sélectionne une date et un type de journée valides.");return;}
  if(originalDialogDate&&date!==originalDialogDate){editorError("Pour déplacer cette journée, supprime d'abord l'ancienne puis crée la nouvelle.");return;}
  const r={date,type,start:"",end:"",lunchStart:"",lunchEnd:"",manualPause:null,note:$("entryNote").value.trim(),updatedAt:new Date().toISOString()};
  if(type==="work"){
    r.start=$("entryStart").value;
    r.end=$("entryEnd").value;
    r.lunchStart=$("entryLunchStart").value;
    r.lunchEnd=$("entryLunchEnd").value;
    const p=$("entryManualPause").value;
    r.manualPause=p!==""?Number(p):null;
    const s=minOf(r.start),e=minOf(r.end),ls=minOf(r.lunchStart),le=minOf(r.lunchEnd);
    if(r.end&&!r.start){editorError("L'heure d'arrivée est obligatoire si tu renseignes un départ.");return;}
    if((r.lunchStart||r.lunchEnd)&&!r.start){editorError("Renseigne d'abord l'arrivée.");return;}
    if(r.lunchEnd&&!r.lunchStart){editorError("Renseigne le début de la pause repas.");return;}
    if(ls!==null&&ls<=s){editorError("Le repas doit commencer après l'arrivée.");return;}
    if(le!==null&&le<=ls){editorError("La reprise doit suivre le début de repas.");return;}
    if(e!==null&&s!==null&&e<=s){editorError("Le départ doit suivre l'arrivée (la V1 ne gère pas les nuits).");return;}
    if(e!==null&&ls!==null&&le===null){editorError("Ajoute la reprise ou supprime le début de repas avant de saisir le départ.");return;}
    if(e!==null&&le!==null&&e<=le){editorError("Le départ doit suivre la reprise.");return;}
    if(e!==null&&ls!==null&&e<=ls){editorError("Le départ doit suivre la pause.");return;}
    if(r.manualPause!==null&&(!Number.isFinite(r.manualPause)||r.manualPause<0||r.manualPause>720)){editorError("La pause doit être comprise entre 0 et 720 minutes.");return;}
    if(s!==null&&e!==null&&ls===null&&r.manualPause!==null&&r.manualPause>=e-s){editorError("La pause ne peut pas être supérieure ou égale au temps de présence.");return;}
  }
  if(date!==originalDialogDate&&record(date)&&!confirm("Une journée existe déjà à cette date. La remplacer ?"))return;
  state.records[date]=r;
  if(persist()){$("dayDialog").close();renderAll();toast("Journée enregistrée.");}
}
function deleteDay(){
  const date=$("entryDate").value;
  if(!record(date)||!confirm(`Supprimer la journée du ${niceDate(date)} ?`))return;
  delete state.records[date];
  if(persist()){$("dayDialog").close();renderAll();toast("Journée supprimée.");}
}
function openPeriod(){
  $("periodType").value="leave";
  $("periodStart").value=today();
  $("periodEnd").value=today();
  $("periodNote").value="";
  $("periodError").classList.add("hidden");
  $("periodDialog").showModal();
}
function savePeriod(event){
  event.preventDefault();$("periodError").classList.add("hidden");
  const a=$("periodStart").value,b=$("periodEnd").value,type=$("periodType").value,note=$("periodNote").value.trim();
  if(!a||!b||b<a){$("periodError").textContent="La date de fin doit être postérieure ou égale à la date de début.";$("periodError").classList.remove("hidden");return;}
  const dates=[];
  for(let d=a;d<=b&&dates.length<=367;d=addDays(d,1))if(isWeekday(d))dates.push(d);
  if(!dates.length){$("periodError").textContent="Aucun jour ouvré sur cette période.";$("periodError").classList.remove("hidden");return;}
  if(dates.length>366){$("periodError").textContent="Limite : un an par saisie groupée.";$("periodError").classList.remove("hidden");return;}
  const conflicts=dates.filter(d=>record(d));
  if(conflicts.length&&!confirm(`${conflicts.length} journée(s) déjà saisie(s) seront remplacées. Continuer ?`))return;
  for(const d of dates)state.records[d]={date:d,type,start:"",end:"",lunchStart:"",lunchEnd:"",manualPause:null,note,updatedAt:new Date().toISOString()};
  if(persist()){$("periodDialog").close();calMonth=monthKey(a);reportMonth=monthKey(a);renderAll();toast(`${dates.length} journée(s) enregistrée(s).`);}
}
function savePreferences(){
  const val=Number($("weeklyHours").value);
  if(!Number.isFinite(val)||val<1||val>80){toast("Entre une durée hebdomadaire comprise entre 1 et 80 heures.");return;}
  state.settings.weeklyHours=val;
  state.settings.creditSchool=$("creditSchool").checked;
  state.settings.creditSick=$("creditSick").checked;
  if(persist()){renderAll();toast("Réglages enregistrés.");}
}
function downloadBlob(data,name,type){
  const blob=data instanceof Blob?data:new Blob([data],{type:type||"application/octet-stream"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportBackup(){
  const backup={version:1,exportedAt:new Date().toISOString(),settings:state.settings,records:state.records};
  downloadBlob(JSON.stringify(backup,null,2),`Tempo_sauvegarde_${today()}.json`,"application/json;charset=utf-8");toast("Sauvegarde téléchargée.");
}
async function importBackup(file){
  if(!file)return;
  try{
    const text=await file.text(),obj=JSON.parse(text);
    if(obj.version!==1||!obj.records||typeof obj.records!=="object"||!obj.settings)throw new Error("format non reconnu");
    const entries=Object.entries(obj.records);
    if(entries.some(([date,r])=>!/^\d{4}-\d{2}-\d{2}$/.test(date)||!r||!LABELS[r.type]||r.date!==date))throw new Error("journées invalides");
    if(!confirm(`Cette sauvegarde contient ${entries.length} journée(s). Elle remplacera les données actuelles. Continuer ?`))return;
    const oldRecords={...state.records},oldSettings={...state.settings};
    state.records=Object.fromEntries(entries);state.settings={...DEFAULTS,...obj.settings};
    if(!persist()){state.records=oldRecords;state.settings=oldSettings;return;}
    renderSettings();renderAll();toast("Sauvegarde restaurée.");
  }catch(e){console.error(e);toast("Le fichier de sauvegarde est invalide.");}
  finally{$("restoreFile").value="";}
}
function exportExcel(){
  if(!window.TempoXLSX){toast("Export Excel indisponible.");return;}
  const dates=monthDates(reportMonth),st=statsForDates(dates);
  const rows=[["Date","Jour","Type de journée","Arrivée","Début pause","Fin pause","Départ","Pause manuelle (min)","Heures travaillées (h)","Heures assimilées (h)","Statut","Commentaire"]];
  for(const date of dates){
    const r=record(date);if(!r)continue;
    rows.push([date,niceDate(date,{weekday:"long"}),LABELS[r.type],r.start||"",r.lunchStart||"",r.lunchEnd||"",r.end||"",r.manualPause??"",round(getWorked(r,false)/60),round((credited(r)?dailyRef():0)/60),isIncomplete(r)?"À compléter":r.type!=="work"?"Absence":r.end?"Complet":"En cours",r.note||""]);
  }
  const weeks=[...new Set(dates.map(isoMonday))];
  const weekly=[["Semaine du","Au","Heures travaillées (h)","Heures assimilées (h)","Heures de référence (h)","Solde indicatif (h)"]];
  for(const mon of weeks){const s=statsForDates(weekDates(mon).filter(d=>d.startsWith(reportMonth)));weekly.push([mon,addDays(mon,6),round(s.worked/60),round(s.credit/60),round(s.ref/60),round(s.balance/60)]);}
  const summary=[["Indicateur","Valeur"],["Mois",niceMonth(reportMonth)],["Heures travaillées (h)",round(st.worked/60)],["Heures assimilées (h)",round(st.credit/60)],["Référence à date (h)",round(st.ref/60)],["Solde indicatif (h)",round(st.balance/60)],["Jours d'absence",st.leaveCount],["Durée hebdomadaire paramétrée (h)",state.settings.weeklyHours],["École assimilée",state.settings.creditSchool?"Oui":"Non"],["Maladie assimilée",state.settings.creditSick?"Oui":"Non"]];
  const blob=TempoXLSX.create([{name:"Pointages",rows,widths:[16,16,22,12,14,14,12,23,24,23,17,42]},{name:"Semaines",rows:weekly,widths:[16,16,24,24,26,24]},{name:"Synthèse",rows:summary,widths:[38,23]}]);
  downloadBlob(blob,`Pointage_Tempo_${reportMonth}.xlsx`);toast("Bilan Excel téléchargé.");
}
async function tryImportOldVersion(){
  // Récupération non destructive de l'ancienne V1 Frais & Temps, uniquement si elle existe sur la même origine.
  if(Object.keys(state.records).length||!window.indexedDB||!indexedDB.databases)return;
  try{
    const list=await indexedDB.databases();if(!list.some(d=>d.name==="fraisTempsDB"))return;
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("fraisTempsDB");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    if(!db.objectStoreNames.contains("times")){db.close();return;}
    const source=await new Promise((resolve,reject)=>{const tx=db.transaction("times","readonly");const req=tx.objectStore("times").getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();
    if(!source.length)return;
    for(const r of source){if(!r.date||!LABELS[r.type])continue;
      state.records[r.date]={date:r.date,type:r.type,start:r.start||"",end:r.end||"",lunchStart:"",lunchEnd:"",manualPause:r.type==="work"?Number(r.lunch||0):null,note:r.note||""};
    }
    if(persist()){renderAll();toast("Anciens pointages récupérés de Frais & Temps.");}
  }catch(e){console.warn("Migration facultative non disponible",e);}
}
function wire(){
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $("topSettings").addEventListener("click",()=>navigate("settingsView"));
  $("historyLink").addEventListener("click",()=>navigate("calendarView"));
  $("punchButton").addEventListener("click",()=>{
    const r=record(today());if(["finished","absence"].includes(statusOf(r)))openDayEditor(today());else doPunch("next");
  });
  $("skipLunchButton").addEventListener("click",()=>doPunch("skip"));
  $("editTodayButton").addEventListener("click",()=>openDayEditor(today()));
  for(const [prefix,type] of [["cal","calendar"],["report","reports"]]){
    const target=type==="calendar"?()=>calMonth:m=>reportMonth;
    const setter=type==="calendar"?v=>{calMonth=v;renderCalendar();}:v=>{reportMonth=v;renderReports();};
    $(prefix+"Prev").addEventListener("click",()=>setter(shiftMonth(target(),-1)));
    $(prefix+"Next").addEventListener("click",()=>setter(shiftMonth(target(),1)));
    $(prefix+"MonthButton").addEventListener("click",()=>{
      const input=$(prefix+"MonthInput");input.classList.remove("hidden");input.focus();if(input.showPicker)try{input.showPicker();}catch(e){}
    });
    $(prefix+"MonthInput").addEventListener("change",event=>{if(event.target.value)setter(event.target.value);event.target.classList.add("hidden");});
    $(prefix+"MonthInput").addEventListener("blur",event=>event.target.classList.add("hidden"));
  }
  $("newDayButton").addEventListener("click",()=>openDayEditor(today()));
  $("newPeriodButton").addEventListener("click",openPeriod);
  $("dayForm").addEventListener("submit",saveDay);
  $("entryType").addEventListener("change",toggleEditorFields);
  $("entryDate").addEventListener("change",()=>{$("deleteDay").classList.toggle("hidden",!record($("entryDate").value));});
  $("deleteDay").addEventListener("click",deleteDay);
  $("periodForm").addEventListener("submit",savePeriod);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
  $("saveSettings").addEventListener("click",savePreferences);
  $("downloadBackup").addEventListener("click",exportBackup);
  $("restoreBackup").addEventListener("click",()=>$("restoreFile").click());
  $("restoreFile").addEventListener("change",event=>importBackup(event.target.files[0]));
  $("excelExport").addEventListener("click",exportExcel);
  setInterval(()=>{if(document.getElementById("todayView").classList.contains("active"))renderToday();},30000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)renderAll();});
}
function init(){wire();renderSettings();renderAll();tryImportOldVersion();if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(console.warn);}
init();
})();
