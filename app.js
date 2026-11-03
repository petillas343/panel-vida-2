/* AETHER Tasks: sesión Supabase y gestión de tareas. RLS protege cada fila. */
(function () {
  "use strict";
  var URL = "https://dzyhecukaiujbuvsemtf.supabase.co";
  var KEY = "sb_publishable_Iv1sS0zzisomBIRZwp_GwA_dPWksAwl";
  var db = window.supabase && window.supabase.createClient ? window.supabase.createClient(URL, KEY) : null;
  var user = null, tasks = [], statusFilter = "all";
  var $ = function (id) { return document.getElementById(id); };
  var errText = function (e) { return e && e.message ? e.message : "Error desconocido"; };

  function showMessage(id, text, error) {
    var box = $(id);
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("hidden", !text);
    if (text) box.className = "mt-4 mb-3 p-3 rounded-xl border text-xs font-mono break-words " +
      (error ? "bg-rose-500/20 border-rose-500/50 text-rose-200" : "bg-emerald-500/20 border-emerald-500/50 text-emerald-200");
  }
  function setStatus(text, color) {
    var node = $("connectionStatus");
    if (node) { node.textContent = "● " + text; node.className = "text-xs font-mono " + color; }
  }
  function signedOut() {
    user = null; tasks = [];
    $("authSection").classList.remove("hidden");
    $("appSection").classList.add("hidden");
    $("logoutButton").classList.add("hidden");
    setStatus("SIN SESIÓN", "text-amber-400");
  }
  async function signedIn(activeUser) {
    user = activeUser;
    $("authSection").classList.add("hidden");
    $("appSection").classList.remove("hidden");
    $("logoutButton").classList.remove("hidden");
    $("userEmail").textContent = activeUser.email || "Cuenta activa";
    setStatus("CARGANDO TAREAS", "text-cyan-300");
    await loadTasks();
  }
  async function auth(mode) {
    var email = $("authEmail").value.trim(), password = $("authPassword").value;
    if (!email || password.length < 6) {
      showMessage("authMessageBox", "Escribe un email válido y una contraseña de al menos 6 caracteres.", true); return;
    }
    showMessage("authMessageBox", mode === "login" ? "Iniciando sesión…" : "Creando cuenta…", false);
    var response = mode === "login"
      ? await db.auth.signInWithPassword({ email: email, password: password })
      : await db.auth.signUp({ email: email, password: password });
    if (response.error) { showMessage("authMessageBox", "No se pudo completar el acceso: " + errText(response.error), true); return; }
    if (mode === "signup" && !response.data.session) {
      showMessage("authMessageBox", "Cuenta creada. Confirma el correo recibido y después inicia sesión.", false); return;
    }
    if (response.data.user) await signedIn(response.data.user);
  }
  async function loadTasks() {
    if (!user) return;
    var r = await db.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (r.error) { showMessage("taskMessageBox", "No se pudieron cargar las tareas: " + errText(r.error), true); setStatus("ERROR", "text-rose-400"); return; }
    tasks = r.data || [];
    showMessage("taskMessageBox", "", false);
    setStatus("ONLINE", "text-emerald-400");
    render();
  }
  function resetForm() {
    $("editTaskId").value = "";
    $("taskTitle").value = "";
    $("taskDescription").value = "";
    $("taskCategory").value = "general";
    $("taskPriority").value = "medium";
    $("taskStatus").value = "pending";
    $("taskDueDate").value = "";
    $("formHeading").textContent = "Nueva Tarea";
    $("saveTaskButton").textContent = "+ Guardar tarea en Supabase";
    $("cancelEditBtn").classList.add("hidden");
  }
  async function saveTask() {
    if (!user) return;
    var title = $("taskTitle").value.trim();
    if (!title) { showMessage("taskMessageBox", "Escribe un título para la tarea.", true); $("taskTitle").focus(); return; }
    var id = $("editTaskId").value;
    var payload = {
      title: title, description: $("taskDescription").value.trim(),
      category: $("taskCategory").value, priority: $("taskPriority").value,
      status: $("taskStatus").value, due_date: $("taskDueDate").value || null
    };
    showMessage("taskMessageBox", "Guardando tarea…", false);
    var r = id
      ? await db.from("tasks").update(payload).eq("id", id).eq("user_id", user.id).select().single()
      : await db.from("tasks").insert(payload).select().single();
    if (r.error) { showMessage("taskMessageBox", "No se pudo guardar: " + errText(r.error), true); return; }
    resetForm(); await loadTasks(); showMessage("taskMessageBox", "Tarea guardada.", false);
  }
  function editTask(t) {
    $("editTaskId").value = t.id;
    $("taskTitle").value = t.title || "";
    $("taskDescription").value = t.description || "";
    $("taskCategory").value = t.category || "general";
    $("taskPriority").value = t.priority || "medium";
    $("taskStatus").value = t.status || "pending";
    $("taskDueDate").value = t.due_date || "";
    $("formHeading").textContent = "Editando Tarea";
    $("saveTaskButton").textContent = "Guardar cambios";
    $("cancelEditBtn").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function setTaskStatus(t, value) {
    var r = await db.from("tasks").update({ status: value }).eq("id", t.id).eq("user_id", user.id);
    if (r.error) showMessage("taskMessageBox", "No se pudo actualizar: " + errText(r.error), true);
    else await loadTasks();
  }
  async function deleteTask(t) {
    if (!window.confirm("¿Borrar la tarea «" + t.title + "»?")) return;
    var r = await db.from("tasks").delete().eq("id", t.id).eq("user_id", user.id);
    if (r.error) showMessage("taskMessageBox", "No se pudo borrar: " + errText(r.error), true);
    else await loadTasks();
  }
  function isOverdue(t) {
    if (!t.due_date || t.status === "completed") return false;
    var d = new Date(), today = [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
    return t.due_date < today;
  }
  function render() {
    var list = $("taskList"); if (!list) return;
    list.replaceChildren();
    $("sidebarTaskCount").textContent = tasks.length;
    $("kpiPending").textContent = tasks.filter(function(t){return t.status==="pending";}).length;
    $("kpiInProgress").textContent = tasks.filter(function(t){return t.status==="in_progress";}).length;
    $("kpiCompleted").textContent = tasks.filter(function(t){return t.status==="completed";}).length;
    $("kpiOverdue").textContent = tasks.filter(isOverdue).length;
    var q = $("searchInput").value.trim().toLowerCase(), cat = $("filterCategory").value, pri = $("filterPriority").value, sort = $("sortBy").value;
    var rows = tasks.filter(function(t) {
      return (statusFilter==="all" || t.status===statusFilter) &&
        (cat==="all" || (t.category||"general")===cat) && (pri==="all" || t.priority===pri) &&
        (!q || (t.title||"").toLowerCase().includes(q) || (t.description||"").toLowerCase().includes(q));
    });
    var weights = {high:3,medium:2,low:1};
    rows.sort(function(a,b) {
      if (sort==="priority_desc") return (weights[b.priority]||2)-(weights[a.priority]||2);
      if (sort==="due_asc") return (a.due_date||"9999-12-31").localeCompare(b.due_date||"9999-12-31");
      return (b.created_at||"").localeCompare(a.created_at||"");
    });
    $("emptyState").classList.toggle("hidden", rows.length>0);
    rows.forEach(function(t) {
      var done=t.status==="completed", late=isOverdue(t);
      var row=document.createElement("div");
      row.className="task-row p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 "+(done?"completed ":"")+(late?"overdue":"");
      var left=document.createElement("div"); left.className="flex items-start gap-3 flex-1 min-w-0";
      var cb=document.createElement("input"); cb.type="checkbox"; cb.checked=done; cb.className="mt-1 w-4 h-4 accent-purple-500 cursor-pointer";
      cb.setAttribute("aria-label","Marcar tarea como completada");
      cb.onchange=function(){setTaskStatus(t,cb.checked?"completed":"pending");};
      var content=document.createElement("div"); content.className="min-w-0 flex-1";
      var title=document.createElement("p"); title.className="task-title text-sm font-bold text-white break-words"; title.textContent=t.title||""; content.appendChild(title);
      if(t.description){var desc=document.createElement("p");desc.className="text-xs text-slate-400 mt-1 break-words";desc.textContent=t.description;content.appendChild(desc);}
      var meta=document.createElement("div"); meta.className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-mono";
      [[ "px-2 py-0.5 rounded bg-purple-500/20 text-purple-200",t.status==="in_progress"?"⚡ EN CURSO":done?"✅ HECHA":"⏳ PENDIENTE"],
       ["px-2 py-0.5 rounded bg-white/10 text-slate-200","PRIO: "+(t.priority||"medium").toUpperCase()],
       ["px-2 py-0.5 rounded bg-white/5 text-slate-300",(t.category||"general").toUpperCase()]].forEach(function(x){
        var b=document.createElement("span");b.className=x[0];b.textContent=x[1];meta.appendChild(b);
      });
      if(t.due_date){var due=document.createElement("span");due.className="px-2 py-0.5 rounded "+(late?"bg-rose-500/30 text-rose-200 font-bold":"bg-white/5 text-slate-400");due.textContent=(late?"⚠ VENCIDA: ":"📅 ")+t.due_date;meta.appendChild(due);}
      content.appendChild(meta);left.append(cb,content);
      var actions=document.createElement("div");actions.className="flex flex-wrap items-center gap-1.5 self-end sm:self-center";
      if(!done){var prog=document.createElement("button");prog.type="button";prog.className="btn-filter";prog.textContent=t.status==="in_progress"?"⏸ Pausar":"⚡ En curso";prog.onclick=function(){setTaskStatus(t,t.status==="in_progress"?"pending":"in_progress");};actions.appendChild(prog);}
      var edit=document.createElement("button");edit.type="button";edit.className="btn-filter";edit.textContent="Editar";edit.onclick=function(){editTask(t);};
      var del=document.createElement("button");del.type="button";del.className="btn-filter text-rose-300";del.textContent="Borrar";del.onclick=function(){deleteTask(t);};
      actions.append(edit,del);row.append(left,actions);list.appendChild(row);
    });
  }
  function filter(value, button) {
    statusFilter=value;
    ["stAll","stPending","stProgress","stCompleted"].forEach(function(id){$(id).classList.toggle("active-filter",id===button);});
    render();
  }
  function init() {
    if (!db) {setStatus("ERROR DE CARGA","text-rose-400");showMessage("authMessageBox","No se pudo cargar Supabase. Comprueba la conexión y recarga la página.",true);return;}
    $("btnLogin").onclick=function(){auth("login");};
    $("btnSignup").onclick=function(){auth("signup");};
    $("saveTaskButton").onclick=saveTask; $("cancelEditBtn").onclick=resetForm;
    $("stAll").onclick=function(){filter("all","stAll");};
    $("stPending").onclick=function(){filter("pending","stPending");};
    $("stProgress").onclick=function(){filter("in_progress","stProgress");};
    $("stCompleted").onclick=function(){filter("completed","stCompleted");};
    $("searchInput").oninput=render; $("filterCategory").onchange=render;
    $("filterPriority").onchange=render; $("sortBy").onchange=render;
    $("logoutButton").onclick=async function(){var r=await db.auth.signOut();if(r.error)showMessage("taskMessageBox","No se pudo cerrar sesión: "+errText(r.error),true);else signedOut();};
    db.auth.onAuthStateChange(function(event,session){
      window.setTimeout(function(){if(session&&session.user)signedIn(session.user);else if(event==="SIGNED_OUT")signedOut();},0);
    });
    db.auth.getSession().then(function(r){
      if(r.error){showMessage("authMessageBox","No se pudo recuperar la sesión: "+errText(r.error),true);signedOut();}
      else if(r.data.session)signedIn(r.data.session.user);else signedOut();
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
