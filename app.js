/* AETHER Tasks: Supabase Auth, private task CRUD and weekly completion chart. */
(function () {
  "use strict";
  const SUPABASE_URL = "https://dzyhecukaiujbuvsemtf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Iv1sS0zzisomBIRZwp_GwA_dPWksAwl";
  const GOOGLE_CLIENT_ID = "1017357013483-kv9891mvk4bophpuge9g219ns0b9ri5a.apps.googleusercontent.com";
  const GOOGLE_CALENDAR_FUNCTION = SUPABASE_URL + "/functions/v1/google-calendar";
  const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, tasks = [], filterStatus = "all", booted = false, calendarEvents = [], calendarConnected = false;
  const $ = id => document.getElementById(id);
  const err = e => e?.message || "Error desconocido";
  const priorityRank = t => ({high:0,medium:1,low:2}[t.priority] ?? 1);
  function taskOrder(a,b){
    const aDone=a.status==="completed",bDone=b.status==="completed";
    if(aDone!==bDone)return aDone?1:-1;
    if(aDone&&bDone)return (b.completed_at||"").localeCompare(a.completed_at||"");
    const priority=priorityRank(a)-priorityRank(b);
    if(priority)return priority;
    const today=new Date().toISOString().slice(0,10);
    const aToday=a.due_date===today,bToday=b.due_date===today;
    if(aToday!==bToday)return aToday?-1:1;
    const due=(a.due_date||"9999-12-31").localeCompare(b.due_date||"9999-12-31");
    if(due)return due;
    return (b.created_at||"").localeCompare(a.created_at||"");
  }
  function renderDashboardPreview(){
    const preview=$("taskPreviewList"),counter=$("taskCompletedCount");
    if(counter)counter.textContent=tasks.filter(t=>t.status==="completed").length+"/"+tasks.length+" completadas";
    const sidebar=$("taskSidebarCount");if(sidebar)sidebar.textContent=String(tasks.length);
    if(!preview)return;
    preview.replaceChildren();
    const top=tasks.filter(t=>t.status!=="completed").sort(taskOrder).slice(0,3);
    if(!top.length){const empty=document.createElement("p");empty.className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400";empty.textContent="No tienes tareas pendientes.";preview.appendChild(empty);return;}
    top.forEach(t=>{
      const row=document.createElement("div");row.className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 p-2 hover:border-purple-400/60 transition";
      const label=document.createElement("button");label.type="button";label.className="min-w-0 flex-1 truncate text-left text-xs text-slate-100 hover:text-purple-200";label.textContent=t.title;label.title=t.title;label.onclick=e=>{e.stopPropagation();window.openFolder("tasks");};
      const mark=document.createElement("button");mark.type="button";mark.className="shrink-0 rounded bg-purple-500/20 px-2 py-1 text-[9px] font-mono text-purple-200";const dueToday=t.due_date===new Date().toISOString().slice(0,10);mark.textContent=( {high:"URGENTE",medium:"MEDIA",low:"BAJA"}[t.priority]||"MEDIA")+(dueToday?" · HOY":"");mark.title=t.due_date?"Fecha: "+t.due_date:"Sin fecha";mark.onclick=e=>{e.stopPropagation();update(t,{status:"completed",completed_at:new Date().toISOString()});};
      row.append(label,mark);preview.appendChild(row);
    });
  }
  function msg(text, bad=false) {
    const box = $("taskMessageBox"); if (!box) return;
    box.textContent = text || ""; box.classList.toggle("hidden", !text);
    box.className = "mb-3 rounded-lg border p-3 text-xs font-mono " + (bad ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200");
  }
  function monday(d) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x; }
  function renderChart() {
    const chart=$("weeklyChart"); if(!chart)return;
    const start=monday(new Date()), counts=Array(7).fill(0), names=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
    tasks.forEach(t=>{ if(t.status!=="completed"||!t.completed_at)return; const d=new Date(t.completed_at); const i=Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate())-start)/86400000); if(i>=0&&i<7)counts[i]++; });
    const max=Math.max(1,...counts); chart.replaceChildren();
    counts.forEach((n,i)=>{const col=document.createElement("div");col.className="h-full flex flex-col items-center justify-end gap-1";const value=document.createElement("span");value.className="text-[10px] font-mono text-slate-300";value.textContent=n;const bar=document.createElement("div");bar.className="w-full max-w-10 rounded-t bg-gradient-to-t from-purple-700 to-cyan-300 shadow-[0_0_12px_rgba(168,85,247,.45)] transition-all duration-500";bar.style.height=(n?Math.max(10,n/max*78):3)+"%";const label=document.createElement("span");label.className="text-[10px] font-mono text-slate-400";label.textContent=names[i];col.append(value,bar,label);chart.appendChild(col);});
    $("weeklyDoneTotal").textContent=String(counts.reduce((a,b)=>a+b,0));
  }
  function calendarDate(event,compact=false){
    const value=event.start?.dateTime||event.start?.date;if(!value)return "Hora por confirmar";const date=new Date(value);
    if(event.start?.date)return new Intl.DateTimeFormat("es-ES",{weekday:compact?undefined:"short",day:"2-digit",month:compact?undefined:"short"}).format(date)+" · Todo el día";
    return new Intl.DateTimeFormat("es-ES",compact?{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}:{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
  }
  function renderCalendarEvents(target,events,compact=false){
    if(!target)return;target.replaceChildren();
    if(!events.length){const empty=document.createElement("p");empty.className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400";empty.textContent=calendarConnected?"No hay eventos próximos en los siguientes 14 días.":"Conecta Google Calendar para ver tus próximos eventos.";target.appendChild(empty);return;}
    events.slice(0,compact?2:50).forEach(event=>{const row=document.createElement("article");row.className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-black/35 p-3 transition hover:border-cyan-400/50";const body=document.createElement("div");body.className="min-w-0 flex-1";const date=document.createElement("p");date.className="text-[10px] font-mono uppercase tracking-wider text-cyan-300";date.textContent=calendarDate(event,compact);const title=document.createElement("p");title.className="mt-1 truncate text-sm font-medium text-white";title.textContent=event.summary||"Evento sin título";body.append(date,title);if(event.location&&!compact){const location=document.createElement("p");location.className="mt-1 truncate text-xs text-slate-400";location.textContent=event.location;body.appendChild(location);}row.appendChild(body);if(event.htmlLink){const open=document.createElement("button");open.type="button";open.className="shrink-0 rounded-lg border border-cyan-400/35 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/15";open.textContent=compact?"Ver ↗":"Abrir en Google ↗";open.addEventListener("click",e=>{e.stopPropagation();window.open(event.htmlLink,"_blank","noopener,noreferrer");});row.appendChild(open);}target.appendChild(row);});
  }
  async function calendarApi(action,extra={}){
    const {data,error}=await db.auth.getSession();if(error||!data.session)throw new Error("Inicia sesión en AETHER para conectar Calendar.");
    const response=await fetch(GOOGLE_CALENDAR_FUNCTION,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+data.session.access_token,"apikey":SUPABASE_KEY,"X-Requested-With":"XMLHttpRequest"},body:JSON.stringify({action,...extra})});const result=await response.json().catch(()=>({error:"Respuesta no válida del servicio."}));if(!response.ok)throw new Error(result.error||"No se pudo conectar con Google Calendar.");return result;
  }
  function calendarMessage(text,bad=false){const node=$("googleCalendarMessage");if(!node)return;node.textContent=text||"";node.className="mt-3 text-xs "+(bad?"text-rose-200":"text-slate-300");}
  function paintCalendar(){const status=$("googleCalendarStatus"),connect=$("googleConnectButton"),disconnect=$("googleDisconnectButton"),refresh=$("googleRefreshButton");if(status)status.textContent=calendarConnected?"Conectado · eventos sincronizados desde Google Calendar":"No conectado · vincula tu cuenta de Google";if(connect)connect.classList.toggle("hidden",calendarConnected);if(disconnect)disconnect.classList.toggle("hidden",!calendarConnected);if(refresh)refresh.classList.toggle("hidden",!calendarConnected);const badge=$("calendarPreviewBadge");if(badge)badge.textContent=calendarConnected?"GOOGLE · EN VIVO":"CONECTA GOOGLE";renderCalendarEvents($("googleEventsList"),calendarEvents,false);renderCalendarEvents($("calendarPreviewList"),calendarEvents,true);}
  async function loadCalendar(){if(!user)return;try{const status=await calendarApi("status");calendarConnected=!!status.connected;if(calendarConnected){const result=await calendarApi("events");calendarEvents=result.events||[];}else calendarEvents=[];paintCalendar();}catch(error){calendarConnected=false;calendarEvents=[];paintCalendar();calendarMessage(error.message,true);}}
  async function connectGoogle(){
    if(!GOOGLE_CLIENT_ID||GOOGLE_CLIENT_ID.startsWith("AÑADE_AQUI")){calendarMessage("Falta poner el Client ID público de OAuth en app.js. No incluyas aquí el Client Secret.",true);return;}
    if(!window.google?.accounts?.oauth2){calendarMessage("Google todavía está cargando. Espera un momento y vuelve a intentarlo.",true);return;}
    try{const {data,error}=await db.auth.getSession();if(error||!data.session)throw new Error("Inicia sesión en AETHER antes de vincular Google.");const codeClient=window.google.accounts.oauth2.initCodeClient({client_id:GOOGLE_CLIENT_ID,scope:"https://www.googleapis.com/auth/calendar.events.readonly",ux_mode:"popup",select_account:true,include_granted_scopes:true,callback:async response=>{if(response.error){calendarMessage("Google no autorizó la conexión: "+response.error,true);return;}if(!response.code){calendarMessage("Google no devolvió el código de autorización. Inténtalo de nuevo.",true);return;}calendarMessage("Guardando conexión segura…");try{await calendarApi("exchange",{code:response.code,redirect_uri:window.location.origin});calendarConnected=true;calendarMessage("Google Calendar conectado. La autorización queda guardada de forma duradera.");await loadCalendar();}catch(e){calendarMessage(e.message,true);}}});codeClient.requestCode();}catch(error){calendarMessage(error.message,true);}
  }
  window.initAetherCalendar=function(){if(!db)return;$("googleConnectButton")?.addEventListener("click",connectGoogle);$("googleRefreshButton")?.addEventListener("click",async()=>{calendarMessage("Actualizando agenda…");await loadCalendar();calendarMessage("Agenda actualizada.");});$("googleDisconnectButton")?.addEventListener("click",async()=>{if(!confirm("¿Desconectar Google Calendar de AETHER?"))return;try{await calendarApi("disconnect");calendarConnected=false;calendarEvents=[];paintCalendar();calendarMessage("Conexión eliminada.");}catch(error){calendarMessage(error.message,true);}});paintCalendar();if(user)loadCalendar();};
  async function load() {
    if(!user){msg("Inicia sesión para consultar tus tareas.",true);return;}
    const cutoff=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const cleanup=await db.from("tasks").delete().eq("user_id",user.id).eq("status","completed").lt("completed_at",cutoff);
    const {data,error}=await db.from("tasks").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
    if(error){msg("No se pudieron cargar tareas: "+err(error),true);return;}
    tasks=data||[];renderDashboardPreview();render();
    if(cleanup.error)msg("No se pudieron limpiar tareas antiguas: "+err(cleanup.error),true);
  }
  function render() {
    const list=$("taskList");if(!list)return;list.replaceChildren();renderChart();
    const q=$("searchInput").value.trim().toLowerCase(),cat=$("filterCategory").value,sort=$("sortBy").value;
    let shown=tasks.filter(t=>(filterStatus==="all"||t.status===filterStatus)&&(cat==="all"||(t.category||"general")===cat)&&(!q||(t.title||"").toLowerCase().includes(q)||(t.description||"").toLowerCase().includes(q)));
    shown.sort((a,b)=>taskOrder(a,b)||(sort==="due_asc"?(a.due_date||"9999").localeCompare(b.due_date||"9999"):0));
    $("emptyState").classList.toggle("hidden",shown.length>0);
    shown.forEach(t=>{
      const row=document.createElement("article");row.className="rounded-xl border border-white/10 bg-[#11111f]/80 p-3 flex flex-wrap items-center justify-between gap-3 transition hover:border-purple-400/50";
      const info=document.createElement("div");info.className="flex items-start gap-3 min-w-0 flex-1";
      const check=document.createElement("input");check.type="checkbox";check.checked=t.status==="completed";check.className="mt-1 accent-purple-500";check.setAttribute("aria-label","Completar tarea");check.onchange=()=>update(t,{status:check.checked?"completed":"pending",completed_at:check.checked?new Date().toISOString():null});
      const body=document.createElement("div");body.className="min-w-0";const title=document.createElement("p");title.className="text-sm font-semibold "+(check.checked?"line-through text-slate-500":"text-white");title.textContent=t.title;body.appendChild(title);
      const meta=document.createElement("p");meta.className="mt-1 text-[10px] font-mono text-slate-400";meta.textContent=[(t.category||"general").toUpperCase(),(t.priority||"medium").toUpperCase(),t.status==="in_progress"?"EN CURSO":t.status==="completed"?"COMPLETADA":"PENDIENTE",t.due_date?"FECHA "+t.due_date:""].filter(Boolean).join(" • ");body.appendChild(meta);if(t.description){const d=document.createElement("p");d.className="mt-1 text-xs text-slate-400";d.textContent=t.description;body.appendChild(d);}info.append(check,body);
      const actions=document.createElement("div");actions.className="flex gap-2";const edit=document.createElement("button");edit.type="button";edit.className="task-filter";edit.textContent="Editar";edit.onclick=()=>editTask(t);const del=document.createElement("button");del.type="button";del.className="task-filter text-rose-300";del.textContent="Borrar";del.onclick=()=>remove(t);actions.append(edit,del);row.append(info,actions);list.appendChild(row);
    });
  }
  function editTask(t){$("editTaskId").value=t.id;$("taskTitle").value=t.title||"";$("taskDescription").value=t.description||"";$("taskCategory").value=t.category||"general";$("taskPriority").value=t.priority||"medium";$("taskStatus").value=t.status||"pending";$("taskDueDate").value=t.due_date||"";$("formHeading").textContent="Editar tarea";$("saveTaskButton").textContent="Guardar cambios";$("cancelEditBtn").classList.remove("hidden");}
  function reset(){["editTaskId","taskTitle","taskDescription","taskDueDate"].forEach(id=>$(id).value="");$("taskCategory").value="general";$("taskPriority").value="medium";$("taskStatus").value="pending";$("formHeading").textContent="Añadir tarea";$("saveTaskButton").textContent="+ Guardar tarea";$("cancelEditBtn").classList.add("hidden");}
  async function save(){const title=$("taskTitle").value.trim();if(!title){msg("Escribe un título para la tarea.",true);return;}const id=$("editTaskId").value,status=$("taskStatus").value,payload={title,description:$("taskDescription").value.trim(),category:$("taskCategory").value,priority:$("taskPriority").value,status,due_date:$("taskDueDate").value||null,completed_at:status==="completed"?(tasks.find(t=>t.id===id)?.completed_at||new Date().toISOString()):null};msg("Guardando…");let r=id?await db.from("tasks").update(payload).eq("id",id).eq("user_id",user.id):await db.from("tasks").insert(payload);if(r.error){msg("No se pudo guardar. Comprueba que aplicaste la migración completed_at: "+err(r.error),true);return;}reset();await load();msg("Tarea guardada.");}
  async function update(t,p){const {error}=await db.from("tasks").update(p).eq("id",t.id).eq("user_id",user.id);if(error)msg("No se pudo actualizar: "+err(error),true);else await load();}
  async function remove(t){if(!confirm("¿Borrar «"+t.title+"»?"))return;const {error}=await db.from("tasks").delete().eq("id",t.id).eq("user_id",user.id);if(error)msg("No se pudo borrar: "+err(error),true);else await load();}
  function showPanel(session){const gate=$("authGate"),shell=$("appShell");if(session&&session.user){user=session.user;gate.classList.add("hidden");shell.classList.remove("hidden");load();loadCalendar();}else{user=null;tasks=[];calendarEvents=[];calendarConnected=false;paintCalendar();shell.classList.add("hidden");gate.classList.remove("hidden");}}
  async function login(event){event.preventDefault();const button=$("loginButton"),notice=$("loginMessage");button.disabled=true;button.textContent="Entrando…";notice.textContent="Conectando con Supabase…";const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});button.disabled=false;button.textContent="Entrar";if(error){notice.textContent="No se pudo iniciar sesión: "+err(error);return;}notice.textContent="Sesión iniciada.";showPanel(data.session);}
  function bootAuth(){
    if(!db){$("loginMessage").textContent="No se pudo cargar Supabase.";return;}
    if(booted)return;booted=true;
    $("loginForm").addEventListener("submit",login);
    $("logoutButton").onclick=async()=>{const {error}=await db.auth.signOut();if(error)$("loginMessage").textContent=err(error);showPanel(null);};
    db.auth.onAuthStateChange((event,session)=>setTimeout(()=>showPanel(session),0));
    db.auth.getSession().then(({data,error})=>{if(error){$("loginMessage").textContent=err(error);showPanel(null);}else showPanel(data.session);});
    window.setInterval(()=>{if(user)load();},60*60*1000);
  }
  window.initAetherTasks=function(){
    if(!db)return;
    $("saveTaskButton").onclick=save;$("cancelEditBtn").onclick=reset;$("searchInput").oninput=render;$("filterCategory").onchange=render;$("sortBy").onchange=render;
    [["stAll","all"],["stPending","pending"],["stProgress","in_progress"],["stCompleted","completed"]].forEach(([id,value])=>$(id).onclick=()=>{filterStatus=value;render();});
    if(user)load();
  };
  window.refreshAetherTasks=renderDashboardPreview;
  bootAuth();})();

