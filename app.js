/* AETHER Tasks: Supabase Auth, private task CRUD and weekly completion chart. */
(function () {
  "use strict";
  const SUPABASE_URL = "https://dzyhecukaiujbuvsemtf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Iv1sS0zzisomBIRZwp_GwA_dPWksAwl";
  const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, tasks = [], filterStatus = "all", booted = false;
  const $ = id => document.getElementById(id);
  const err = e => e?.message || "Error desconocido";
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
  async function load() {
    if(!user){msg("Inicia sesión para consultar tus tareas.",true);return;}
    const {data,error}=await db.from("tasks").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
    if(error){msg("No se pudieron cargar tareas: "+err(error),true);return;}
    tasks=data||[];render();
  }
  function render() {
    const list=$("taskList");if(!list)return;list.replaceChildren();renderChart();
    const q=$("searchInput").value.trim().toLowerCase(),cat=$("filterCategory").value,sort=$("sortBy").value;
    let shown=tasks.filter(t=>(filterStatus==="all"||t.status===filterStatus)&&(cat==="all"||(t.category||"general")===cat)&&(!q||(t.title||"").toLowerCase().includes(q)||(t.description||"").toLowerCase().includes(q)));
    shown.sort((a,b)=>sort==="due_asc"?(a.due_date||"9999").localeCompare(b.due_date||"9999"):(b.created_at||"").localeCompare(a.created_at||""));
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
  function showPanel(session){const gate=$("authGate"),shell=$("appShell");if(session&&session.user){user=session.user;gate.classList.add("hidden");shell.classList.remove("hidden");load();}else{user=null;tasks=[];shell.classList.add("hidden");gate.classList.remove("hidden");}}
  async function login(event){event.preventDefault();const button=$("loginButton"),notice=$("loginMessage");button.disabled=true;button.textContent="Entrando…";notice.textContent="Conectando con Supabase…";const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});button.disabled=false;button.textContent="Entrar";if(error){notice.textContent="No se pudo iniciar sesión: "+err(error);return;}notice.textContent="Sesión iniciada.";showPanel(data.session);}
  function bootAuth(){
    if(!db){$("loginMessage").textContent="No se pudo cargar Supabase.";return;}
    if(booted)return;booted=true;
    $("loginForm").addEventListener("submit",login);
    $("logoutButton").onclick=async()=>{const {error}=await db.auth.signOut();if(error)$("loginMessage").textContent=err(error);showPanel(null);};
    db.auth.onAuthStateChange((event,session)=>setTimeout(()=>showPanel(session),0));
    db.auth.getSession().then(({data,error})=>{if(error){$("loginMessage").textContent=err(error);showPanel(null);}else showPanel(data.session);});
  }
  window.initAetherTasks=function(){
    if(!db)return;
    $("saveTaskButton").onclick=save;$("cancelEditBtn").onclick=reset;$("searchInput").oninput=render;$("filterCategory").onchange=render;$("sortBy").onchange=render;
    [["stAll","all"],["stPending","pending"],["stProgress","in_progress"],["stCompleted","completed"]].forEach(([id,value])=>$(id).onclick=()=>{filterStatus=value;render();});
    if(user)load();
  };
  bootAuth();})();
