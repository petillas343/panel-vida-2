(function() {
  var SUPABASE_URL = "https://dzyhecukaiujbuvsemtf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Iv1sS0zzisomBIRZwp_GwA_dPWksAwl";

  var sessionToken = null;
  var currentUser = null;
  var tasks = [];
  var statusFilter = "all";

  function el(id) {
    return document.getElementById(id);
  }

  function setMsg(boxId, text, isErr) {
    var box = el(boxId);
    if (!box) return;
    if (!text) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    box.textContent = text;
    box.className = "mt-4 mb-3 p-3 rounded-xl border text-xs font-mono break-words " +
      (isErr
        ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
        : "bg-emerald-500/20 border-emerald-500/50 text-emerald-200");
  }

  // Confirmar visualmente que app.js se ha cargado
  if (el("connectionStatus")) {
    el("connectionStatus").textContent = "● JS ACTIVE v2.0";
    el("connectionStatus").className = "text-xs font-mono text-emerald-400";
  }

  async function runAuth(mode) {
    var email = el("authEmail").value.trim();
    var password = el("authPassword").value;

    if (!email || password.length < 6) {
      setMsg("authMessageBox", "Escribe un correo válido y contraseña de mínimo 6 caracteres.", true);
      return;
    }

    var path = (mode === "login") ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
    setMsg("authMessageBox", "Conectando con Supabase...", false);

    try {
      var res = await fetch(SUPABASE_URL + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY
        },
        body: JSON.stringify({ email: email, password: password })
      });

      var data = await res.json();

      if (!res.ok) {
        var errText = data.msg || data.error_description || data.message || JSON.stringify(data);
        setMsg("authMessageBox", "Error: " + errText, true);
        return;
      }

      if (data.access_token && data.user) {
        sessionToken = data.access_token;
        currentUser = data.user;
        try {
          localStorage.setItem("aether_token", sessionToken);
          localStorage.setItem("aether_user", JSON.stringify(currentUser));
        } catch (e) {}
        openDashboard();
      } else {
        setMsg("authMessageBox", "Cuenta creada. Toca ahora el botón 1 (Iniciar sesión).", false);
      }
    } catch (err) {
      setMsg("authMessageBox", "Error de red: " + err.message, true);
    }
  }

  function openDashboard() {
    el("authSection").classList.add("hidden");
    el("appSection").classList.remove("hidden");
    el("logoutButton").classList.remove("hidden");
    el("userEmail").textContent = currentUser.email || "Activo";
    el("connectionStatus").textContent = "● ONLINE v2.0";
    fetchTasks();
  }

  async function fetchTasks() {
    if (!sessionToken) return;
    try {
      var res = await fetch(SUPABASE_URL + "/rest/v1/tasks?select=*&order=created_at.desc", {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + sessionToken
        }
      });

      if (res.status === 401) {
        el("logoutButton").click();
        return;
      }

      var data = await res.json();
      if (!res.ok) {
        setMsg("taskMessageBox", "Error leyendo tareas: " + (data.message || res.status), true);
        return;
      }

      tasks = Array.isArray(data) ? data : [];
      setMsg("taskMessageBox", "", false);
      renderTasks();
    } catch (e) {
      setMsg("taskMessageBox", "Error de red: " + e.message, true);
    }
  }

  async function saveTask() {
    var title = el("taskTitle").value.trim();
    if (!title) {
      setMsg("taskMessageBox", "Ponle un título a la tarea.", true);
      return;
    }

    var editId = el("editTaskId").value;
    var payload = {
      title: title,
      description: el("taskDescription").value.trim(),
      category: el("taskCategory").value,
      priority: el("taskPriority").value,
      status: el("taskStatus").value,
      due_date: el("taskDueDate").value || null
    };

    if (!editId) {
      payload.user_id = currentUser.id;
    }

    var url = SUPABASE_URL + "/rest/v1/tasks" + (editId ? "?id=eq." + editId : "");
    var method = editId ? "PATCH" : "POST";

    setMsg("taskMessageBox", "Guardando...", false);

    try {
      var res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + sessionToken,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload)
      });

      var data = await res.json();

      if (!res.ok && data.message && data.message.indexOf("category") !== -1) {
        delete payload.category;
        res = await fetch(url, {
          method: method,
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + sessionToken,
            "Prefer": "return=representation"
          },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      }

      if (!res.ok) {
        setMsg("taskMessageBox", "Error guardando: " + (data.message || JSON.stringify(data)), true);
        return;
      }

      resetForm();
      fetchTasks();
    } catch (e) {
      setMsg("taskMessageBox", "Error al guardar: " + e.message, true);
    }
  }

  function startEditTask(task) {
    el("editTaskId").value = task.id;
    el("taskTitle").value = task.title || "";
    el("taskDescription").value = task.description || "";
    el("taskCategory").value = task.category || "general";
    el("taskPriority").value = task.priority || "medium";
    el("taskStatus").value = task.status || "pending";
    el("taskDueDate").value = task.due_date || "";

    el("formHeading").textContent = "Editando Tarea";
    el("saveTaskButton").textContent = "Guardar cambios";
    el("cancelEditBtn").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    el("editTaskId").value = "";
    el("taskTitle").value = "";
    el("taskDescription").value = "";
    el("taskCategory").value = "general";
    el("taskPriority").value = "medium";
    el("taskStatus").value = "pending";
    el("taskDueDate").value = "";
    el("formHeading").textContent = "Nueva Tarea";
    el("saveTaskButton").textContent = "+ Guardar tarea en Supabase";
    el("cancelEditBtn").classList.add("hidden");
  }

  async function setTaskStatus(id, newStatus) {
    await fetch(SUPABASE_URL + "/rest/v1/tasks?id=eq." + id, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + sessionToken
      },
      body: JSON.stringify({ status: newStatus })
    });
    fetchTasks();
  }

  async function delTask(task) {
    if (!window.confirm("¿Borrar la tarea '" + task.title + "'?")) return;
    await fetch(SUPABASE_URL + "/rest/v1/tasks?id=eq." + task.id, {
      method: "DELETE",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + sessionToken
      }
    });
    fetchTasks();
  }

  function isOverdue(task) {
    if (!task.due_date || task.status === "completed") return false;
    var today = new Date().toISOString().split("T")[0];
    return task.due_date < today;
  }

  function renderTasks() {
    var list = el("taskList");
    list.innerHTML = "";

    var q = el("searchInput").value.trim().toLowerCase();
    var catFilter = el("filterCategory").value;
    var prioFilter = el("filterPriority").value;
    var sortMode = el("sortBy").value;

    el("sidebarTaskCount").textContent = tasks.length;
    el("kpiPending").textContent = tasks.filter(function(t) { return t.status === "pending"; }).length;
    el("kpiInProgress").textContent = tasks.filter(function(t) { return t.status === "in_progress"; }).length;
    el("kpiCompleted").textContent = tasks.filter(function(t) { return t.status === "completed"; }).length;
    el("kpiOverdue").textContent = tasks.filter(isOverdue).length;

    var shown = tasks.filter(function(t) {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (catFilter !== "all" && (t.category || "general") !== catFilter) return false;
      if (prioFilter !== "all" && t.priority !== prioFilter) return false;
      if (q) {
        var mTitle = (t.title || "").toLowerCase().indexOf(q) !== -1;
        var mDesc = (t.description || "").toLowerCase().indexOf(q) !== -1;
        if (!mTitle && !mDesc) return false;
      }
      return true;
    });

    var prioWeight = { high: 3, medium: 2, low: 1 };
    shown.sort(function(a, b) {
      if (sortMode === "priority_desc") return (prioWeight[b.priority] || 2) - (prioWeight[a.priority] || 2);
      if (sortMode === "due_asc") return (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31");
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    el("emptyState").classList.toggle("hidden", shown.length > 0);

    shown.forEach(function(t) {
      var isDone = (t.status === "completed");
      var overdue = isOverdue(t);

      var row = document.createElement("div");
      row.className = "task-row p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 " +
        (isDone ? "completed " : "") + (overdue ? "overdue" : "");

      var left = document.createElement("div");
      left.className = "flex items-start gap-3 flex-1 min-w-0";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isDone;
      cb.className = "mt-1 w-4 h-4 accent-purple-500 cursor-pointer";
      cb.onchange = function() {
        setTaskStatus(t.id, cb.checked ? "completed" : "pending");
      };

      var txt = document.createElement("div");
      txt.className = "min-w-0 flex-1";

      var title = document.createElement("p");
      title.className = "task-title text-sm font-bold text-white break-words";
      title.textContent = t.title;
      txt.appendChild(title);

      if (t.description) {
        var desc = document.createElement("p");
        desc.className = "text-xs text-slate-400 mt-1 break-words";
        desc.textContent = t.description;
        txt.appendChild(desc);
      }

      var meta = document.createElement("div");
      meta.className = "flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-mono";

      var stBadge = document.createElement("span");
      stBadge.className = "px-2 py-0.5 rounded bg-purple-500/20 text-purple-200";
      stBadge.textContent = (t.status === "in_progress") ? "⚡ EN CURSO" : (isDone ? "✅ HECHA" : "⏳ PENDIENTE");
      meta.appendChild(stBadge);

      var prBadge = document.createElement("span");
      prBadge.className = "px-2 py-0.5 rounded bg-white/10 text-slate-200";
      prBadge.textContent = "PRIO: " + (t.priority || "medium").toUpperCase();
      meta.appendChild(prBadge);

      var catBadge = document.createElement("span");
      catBadge.className = "px-2 py-0.5 rounded bg-white/5 text-slate-300";
      catBadge.textContent = (t.category || "general").toUpperCase();
      meta.appendChild(catBadge);

      if (t.due_date) {
        var dueBadge = document.createElement("span");
        dueBadge.className = "px-2 py-0.5 rounded " +
          (overdue ? "bg-rose-500/30 text-rose-200 font-bold" : "bg-white/5 text-slate-400");
        dueBadge.textContent = (overdue ? "⚠ VENCIDA: " : "📅 ") + t.due_date;
        meta.appendChild(dueBadge);
      }

      txt.appendChild(meta);
      left.appendChild(cb);
      left.appendChild(txt);

      var actions = document.createElement("div");
      actions.className = "flex flex-wrap items-center gap-1.5 self-end sm:self-center";

      if (!isDone) {
        var progBtn = document.createElement("button");
        progBtn.type = "button";
        progBtn.className = "btn-filter";
        progBtn.textContent = (t.status === "in_progress") ? "⏸ Pausar" : "⚡ En curso";
        progBtn.onclick = function() {
          setTaskStatus(t.id, (t.status === "in_progress") ? "pending" : "in_progress");
        };
        actions.appendChild(progBtn);
      }

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-filter";
      editBtn.textContent = "Editar";
      editBtn.onclick = function() { startEditTask(t); };
      actions.appendChild(editBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-filter text-rose-300";
      delBtn.textContent = "Borrar";
      delBtn.onclick = function() { delTask(t); };
      actions.appendChild(delBtn);

      row.appendChild(left);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function setStatusTab(st, btnId) {
    statusFilter = st;
    ["stAll", "stPending", "stProgress", "stCompleted"].forEach(function(id) {
      el(id).classList.toggle("active-filter", id === btnId);
    });
    renderTasks();
  }

  el("btnLogin").onclick = function() { runAuth("login"); };
  el("btnSignup").onclick = function() { runAuth("signup"); };
  el("saveTaskButton").onclick = saveTask;
  el("cancelEditBtn").onclick = resetForm;

  el("stAll").onclick = function() { setStatusTab("all", "stAll"); };
  el("stPending").onclick = function() { setStatusTab("pending", "stPending"); };
  el("stProgress").onclick = function() { setStatusTab("in_progress", "stProgress"); };
  el("stCompleted").onclick = function() { setStatusTab("completed", "stCompleted"); };

  el("searchInput").oninput = renderTasks;
  el("filterCategory").onchange = renderTasks;
  el("filterPriority").onchange = renderTasks;
  el("sortBy").onchange = renderTasks;

  el("logoutButton").onclick = function() {
    try { localStorage.clear(); } catch (e) {}
    sessionToken = null;
    currentUser = null;
    el("appSection").classList.add("hidden");
    el("logoutButton").classList.add("hidden");
    el("authSection").classList.remove("hidden");
  };

  try {
    var savedTok = localStorage.getItem("aether_token");
    var savedUsr = JSON.parse(localStorage.getItem("aether_user") || "null");
    if (savedTok && savedUsr) {
      sessionToken = savedTok;
      currentUser = savedUsr;
      openDashboard();
    }
  } catch (e) {}
})();
