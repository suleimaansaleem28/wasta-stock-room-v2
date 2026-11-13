(() => {
  const root = document.getElementById("stock-root");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "1";
  root.innerHTML = `
<nav class="nav gut"><div class="inner">
  <span class="mark"><span class="logo" role="img" aria-label="WASTA"></span><small>Inventory</small></span>
  <div class="navr">
    <button class="btn ghost" id="unlockBtn" type="button">Unlock editing</button>
    <button class="btn ghost" id="lockBtn" type="button" hidden>Lock</button>
    <button class="btn primary" id="addBtn" type="button" hidden>+ Add piece</button>
  </div>
</div></nav>
<section class="band gut"><div class="inner">
  <div>
    <span class="eyebrow">❄ Winter 2026</span>
    <h1>Stock Room</h1>
    <p>Hoodie season. Every piece, every color, every size, so you know what's on the rail before anyone asks.</p>
  </div>
  <span class="status-line" id="statusLine">Loading stock…</span>
</div></section>
<div class="wrap">
  <section class="stats" id="stats" aria-label="Summary"></section>
  <section class="bar" aria-label="Find stock">
    <input type="search" id="q" placeholder="Search design, color, style…" aria-label="Search">
    <select id="groupF" aria-label="Group by"><option value="design">Group by design</option><option value="garment">Group by garment</option></select>
    <select id="sizeF" aria-label="Size needed"><option value="">Any size</option></select>
    <select id="statusF" aria-label="Stock status">
      <option value="">All stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Has sold-out sizes</option>
    </select>
    <label class="small" for="lowAt">Low at ≤ <input type="number" id="lowAt" min="0" value="3"></label>
    <div class="chips" id="chips" aria-label="Garment type"></div>
    <div class="seg" role="group" aria-label="Arrange by"><button type="button" data-view="product" id="vProd">By product</button><button type="button" data-view="size" id="vSize">By size</button></div>
    <label class="toggle" for="showOut" id="showOutWrap"><input type="checkbox" id="showOut"> Show sold-out</label>
  </section>
  <main id="list" style="display:flex;flex-direction:column;gap:18px"></main>
</div>
<div class="scrim" id="dlg" hidden>
  <form class="sheet" id="form" novalidate>
    <h3 id="dlgTitle">Add a piece</h3>
    <div class="fields">
      <label class="f"><span>Garment</span><input type="text" id="fGarment" list="dlGarment" placeholder="Hoodie" autocomplete="off"></label>
      <label class="f"><span>Style / type</span><input type="text" id="fStyle" list="dlStyle" placeholder="Pullover, Zip-up, Heavyweight…" autocomplete="off"></label>
      <div class="f"><span>Color</span><div class="colorrow"><input type="text" id="fColor" list="dlColor" placeholder="Black" autocomplete="off" aria-label="Color name"><input type="color" id="fHex" value="#151714" aria-label="Swatch color"></div></div>
      <label class="f"><span>Design / drop</span><input type="text" id="fDesign" placeholder="Lahore, Karachi…" autocomplete="off"></label>
    </div>
    <div class="f"><span>Sizes and how many you have</span>
      <div class="sizepick" id="sizePick"></div>
      <div class="addsize"><input type="text" id="newSize" placeholder="e.g. 3XL" aria-label="Add another size"><button class="btn" type="button" id="addSizeBtn">Add size</button></div>
      <p class="hint">Tick the sizes this piece comes in. Leave a box at 0 if it's sold out.</p>
    </div>
    <p class="err" id="formErr" hidden></p>
    <div class="actions">
      <button class="btn danger" type="button" id="delBtn" hidden>Delete piece</button>
      <div class="r"><button class="btn" type="button" id="cancelBtn">Cancel</button><button class="btn primary" type="submit" id="saveBtn">Save</button></div>
    </div>
  </form>
</div>
<div class="scrim" id="pinDlg" hidden>
  <form class="sheet small" id="pinForm" novalidate>
    <h3>Team PIN</h3>
    <p class="hint">Enter the team PIN to change counts on this device. Anyone can view stock without it.</p>
    <label class="f"><span>PIN</span><input type="password" id="pinInput" class="pinbox" inputmode="numeric" autocomplete="off" maxlength="12"></label>
    <p class="err" id="pinErr" hidden></p>
    <div class="actions"><div class="r"><button class="btn" type="button" id="pinCancel">Cancel</button><button class="btn primary" type="submit" id="pinGo">Unlock</button></div></div>
  </form>
</div>
<datalist id="dlGarment"></datalist><datalist id="dlStyle"></datalist><datalist id="dlColor"></datalist>
<div class="toast" id="toast" hidden></div>`;

  const BASE_SIZES = ["XS","S","M","L","XL","2XL"];
  const DEFAULT_ON = ["S","M","L","XL"];
  const RANKS = ["XXS","XS","S","M","L","XL","2XL","XXL","3XL","XXXL","4XL","5XL"];
  const SIZE_RANK = s => { const i = RANKS.indexOf(String(s).toUpperCase()); return i === -1 ? 50 : i; };
  const COLOR_GUESS = {black:"#151714",white:"#f7f7f5",grey:"#8a8d88",gray:"#8a8d88","heather grey":"#a8aaa6",charcoal:"#3b3e3a",navy:"#1d2a4d","navy blue":"#1d2a4d",blue:"#2b5bd7",red:"#b62a24",maroon:"#5e1a1f",burgundy:"#5e1a1f",green:"#2f6b3a",olive:"#5d6236",forest:"#22432b",brown:"#5c3e2a",cream:"#efe6d2",tan:"#c8a97e",beige:"#d9c8a9",sand:"#d4c3a0",pink:"#e8a3b5",purple:"#5b3a8c",orange:"#e0752d",yellow:"#e9c53a",teal:"#1f7a78"};
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const ls = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

  const state = { items: [], lowAt: 3, groupBy: ls.get("wasta-groupBy") === "garment" ? "garment" : "design", view: ls.get("wasta-view") === "size" ? "size" : "product",
    garment: "", q: "", size: "", status: "", showOut: false, pin: ls.get("wasta-pin") || "", canWrite: false, loaded: false, failed: false,
    code: ls.get("wasta-code") || "", gated: !ls.get("wasta-code") };
  $("groupF").value = state.groupBy;

  // ---- database (Supabase) ----
  const cfg = window.STOCK_CONFIG || {};
  const BASE = String(cfg.supabaseUrl || "").replace(/\/+$/, "");
  const KEY = String(cfg.supabaseKey || "");
  const configured = /^https:\/\//.test(BASE) && KEY && !/PASTE_/.test(KEY);
  const headers = () => { const h = { apikey: KEY, "content-type": "application/json" }; if (KEY.startsWith("eyJ")) h.authorization = "Bearer " + KEY; return h; };
  const ERRORS = { bad_pin: "That PIN isn't right. Check with your team and try again.", locked: "Too many wrong PINs. Editing is paused for 15 minutes.",
    not_found: "That size isn't listed for this piece anymore. Refreshing.", missing_fields: "Add a garment, a color and at least one size.", bad_amount: "That amount isn't allowed." };
  async function rpc(fn, args){
    const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers(), body: JSON.stringify({ p_pin: state.pin, ...args }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error("Couldn't save that change. Check your connection and try again.");
    return j;
  }
  let inFlight = 0, lastWrite = 0;
  async function post(fn, args){
    inFlight++; lastWrite = Date.now();
    try {
      const j = await rpc(fn, args);
      if (!j.ok) { if (j.error === "bad_pin") lockEditing(); throw new Error(ERRORS[j.error] || "Couldn't save that change. Try again."); }
      return j;
    } finally { inFlight--; lastWrite = Date.now(); }
  }
  async function getStock(code){
    const r = await fetch(`${BASE}/rest/v1/rpc/get_stock`, { method: "POST", headers: headers(), cache: "no-store", body: JSON.stringify({ p_code: code }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error("load failed");
    return j;
  }
  async function fetchAll(){
    const j = await getStock(state.code);
    if (!j.ok) { const e = new Error(j.error); e.code = j.error; throw e; }
    return {
      items: (j.items || []).map(r => ({ id: r.id, garment: r.garment, style: r.style, design: r.design, color: r.color, colorHex: r.color_hex,
        sizeOrder: r.size_order ? r.size_order.split(",") : [], sizes: Object.fromEntries((r.stock || []).map(s => [s.size, s.qty])), created: r.created })),
      lowAt: Number(j.lowAt ?? 3) || 0,
    };
  }
  function lockView(msg){
    clearTimeout(pollT); state.code = ""; ls.set("wasta-code", null); state.gated = true; state.items = [];
    state.gateMsg = msg || ""; applyLock();
  }
  let pollT;
  const quiet = () => inFlight === 0 && Date.now() - lastWrite > 1500;
  async function load(force){
    clearTimeout(pollT);
    if (!configured) { state.loaded = true; state.failed = true; render(); setStatus(); return; }
    if (state.gated) { render(); setStatus(); return; }
    try {
      if (force || quiet()) {
        let j;
        try { j = await fetchAll(); }
        catch (e) { if (e.code === "bad_code") { lockView("The passkey changed. Enter the new one."); return; } if (e.code === "locked") { state.failed = true; } throw e; }
        if (force || quiet()) {
          state.items = j.items; state.loaded = true; state.failed = false;
          if (document.activeElement !== $("lowAt")) { state.lowAt = j.lowAt; $("lowAt").value = state.lowAt; }
          softRender();
        }
      }
    } catch { state.failed = true; if (!state.loaded) { state.loaded = true; render(); } }
    setStatus();
    pollT = setTimeout(() => load(false), document.hidden ? 20000 : 4000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });
  function setStatus(){
    $("statusLine").textContent = !configured ? "Setup needed" : state.gated ? "Locked · passkey needed" : state.failed ? "Can't reach stock right now · retrying" : state.canWrite ? "Live · editing unlocked" : "Live · view only";
  }

  // ---- editing lock ----
  function applyLock(){
    $("unlockBtn").hidden = state.canWrite || !configured || state.gated; $("lockBtn").hidden = !state.canWrite || state.gated; $("addBtn").hidden = !state.canWrite || state.gated;
    setStatus(); render();
  }
  function lockEditing(){ state.canWrite = false; state.pin = ""; ls.set("wasta-pin", null); applyLock(); }
  async function verify(pin){
    const r = await fetch(`${BASE}/rest/v1/rpc/check_pin`, { method: "POST", headers: headers(), body: JSON.stringify({ p_pin: pin }) });
    if (!r.ok) throw new Error("network");
    return r.json();
  }
  $("unlockBtn").addEventListener("click", () => { $("pinErr").hidden = true; $("pinInput").value = ""; $("pinDlg").hidden = false; setTimeout(() => $("pinInput").focus(), 0); });
  $("lockBtn").addEventListener("click", () => { lockEditing(); toast("Editing locked on this device"); });
  $("pinCancel").addEventListener("click", () => { $("pinDlg").hidden = true; });
  $("pinDlg").addEventListener("click", e => { if (e.target === $("pinDlg")) $("pinDlg").hidden = true; });
  $("pinForm").addEventListener("submit", async e => {
    e.preventDefault();
    const pin = $("pinInput").value.trim(); if (!pin) return;
    $("pinGo").disabled = true;
    try {
      const j = await verify(pin);
      if (j.ok) { state.pin = pin; state.canWrite = true; ls.set("wasta-pin", pin); $("pinDlg").hidden = true; applyLock(); toast("Editing unlocked"); }
      else { $("pinErr").textContent = ERRORS[j.error] || ERRORS.bad_pin; $("pinErr").hidden = false; }
    } catch { $("pinErr").textContent = "Couldn't check the PIN. Check your connection."; $("pinErr").hidden = false; }
    finally { $("pinGo").disabled = false; }
  });

  // ---- helpers ----
  const sizesOf = it => (Array.isArray(it.sizeOrder) && it.sizeOrder.length ? it.sizeOrder : Object.keys(it.sizes || {})).slice().sort((a,b) => SIZE_RANK(a) - SIZE_RANK(b));
  const qtyOf = (it, s) => Math.max(0, Number(it.sizes?.[s] ?? 0) || 0);
  const levelOf = n => n <= 0 ? "out" : (n <= state.lowAt ? "low" : "ok");
  const itemStatus = it => { const lv = sizesOf(it).map(s => levelOf(qtyOf(it, s))); if (!lv.length || lv.every(l => l === "out")) return "out"; if (lv.includes("out")) return "partial"; if (lv.includes("low")) return "low"; return "ok"; };
  const titleOf = it => [it.design, [it.color, it.style, it.garment].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const subOf = it => it.design ? [it.style, it.garment].filter(Boolean).join(" ") : "No design noted";
  const swatch = it => esc(it.colorHex || COLOR_GUESS[(it.color || "").toLowerCase()] || "#888");
  const cell = (it, s, n, idp, ro, hi) => `
    <div class="sz ${levelOf(n)} ${hi ? "hi" : ""}"><span class="lab">${esc(s)}${n <= 0 ? " · OUT" : ""}</span>
      <div class="ctl"><button type="button" data-step="-1" data-s="${esc(s)}" aria-label="One less ${esc(s)}" ${ro}>−</button>
      <input type="number" inputmode="numeric" min="0" step="1" value="${n}" data-s="${esc(s)}" id="${idp}-${esc(it.id)}-${esc(s)}" aria-label="${esc(titleOf(it))} size ${esc(s)} quantity" ${ro ? "readonly" : ""}>
      <button type="button" data-step="1" data-s="${esc(s)}" aria-label="One more ${esc(s)}" ${ro}>+</button></div></div>`;

  // ---- render ----
  function render(){
    $("stats").hidden = state.gated; document.querySelector(".bar").hidden = state.gated;
    if (state.gated && configured) {
      if (!$("gateForm")) {
        $("list").innerHTML = `<form class="empty" id="gateForm" novalidate>
          <h3>Enter passkey</h3><p>This stock room is for the WASTA team. Enter the passkey to see what's in stock.</p>
          <label class="f" style="width:min(320px,100%)"><span class="sr" style="position:absolute;left:-9999px">Passkey</span><input type="password" id="gateInput" class="pinbox" autocomplete="current-password" style="letter-spacing:.12em;font-size:26px!important" placeholder="passkey"></label>
          <p class="err" id="gateErr" ${state.gateMsg ? "" : "hidden"}>${esc(state.gateMsg || "")}</p>
          <button class="btn primary" type="submit" id="gateGo">Open stock room</button></form>`;
        setTimeout(() => { const i = $("gateInput"); if (i) i.focus(); }, 0);
      }
      return;
    }
    const items = state.items;
    let units = 0, cells = 0, low = 0, out = 0;
    items.forEach(it => sizesOf(it).forEach(s => { const n = qtyOf(it, s); units += n; cells++; const l = levelOf(n); if (l === "low") low++; if (l === "out") out++; }));
    $("stats").innerHTML = `
      <div class="stat"><b>${units}</b><span>pieces on hand</span></div>
      <div class="stat"><b>${items.length}</b><span>products · ${cells} size slots</span></div>
      <button class="stat low" type="button" data-jump="low"><b>${low}</b><span>sizes running low</span></button>
      <button class="stat out" type="button" data-jump="out"><b>${out}</b><span>sizes sold out</span></button>`;
    const garments = [...new Set(items.map(i => i.garment).filter(Boolean))].sort();
    $("chips").innerHTML = [["", "All"], ...garments.map(g => [g, g])].map(([v, l]) => `<button type="button" class="chip" data-g="${esc(v)}" aria-pressed="${state.garment === v}">${esc(l)}</button>`).join("");
    const allSizes = [...new Set(items.flatMap(sizesOf))].sort((a,b) => SIZE_RANK(a) - SIZE_RANK(b));
    $("sizeF").innerHTML = `<option value="">Any size</option>` + allSizes.map(s => `<option value="${esc(s)}">Size ${esc(s)} in stock</option>`).join("");
    $("sizeF").value = allSizes.includes(state.size) ? state.size : "";
    $("dlGarment").innerHTML = [...new Set(["Hoodie","Crewneck","T-shirt","Sweatpants","Hat", ...garments])].map(g => `<option value="${esc(g)}">`).join("");
    $("dlStyle").innerHTML = [...new Set(["Pullover","Zip-up","Heavyweight","Oversized", ...items.map(i => i.style).filter(Boolean)])].map(g => `<option value="${esc(g)}">`).join("");
    $("dlColor").innerHTML = [...new Set([...items.map(i => i.color).filter(Boolean), "Black","White","Sand","Green","Brown","Navy Blue","Maroon"])].map(g => `<option value="${esc(g)}">`).join("");
    $("vSize").setAttribute("aria-pressed", state.view === "size"); $("vProd").setAttribute("aria-pressed", state.view === "product");
    $("showOutWrap").hidden = state.view !== "size"; $("groupF").hidden = state.view !== "product";

    const q = state.q.trim().toLowerCase();
    const shown = items.filter(it => {
      if (state.garment && it.garment !== state.garment) return false;
      if (q && ![it.garment, it.style, it.color, it.design].join(" ").toLowerCase().includes(q)) return false;
      if (state.size && !(sizesOf(it).includes(state.size) && qtyOf(it, state.size) > 0)) return false;
      const st = itemStatus(it);
      if (state.status === "in" && st === "out") return false;
      if (state.status === "low" && !sizesOf(it).some(s => levelOf(qtyOf(it, s)) === "low")) return false;
      if (state.status === "out" && !sizesOf(it).some(s => qtyOf(it, s) <= 0)) return false;
      return true;
    });
    const list = $("list");
    if (!configured) { list.innerHTML = `<div class="empty"><h3>Almost ready</h3><p>Add your Supabase project URL and key to config.js, then upload the site again.</p></div>`; return; }
    if (!state.loaded) { list.innerHTML = `<div class="empty"><h3>Loading stock…</h3><p>Pulling the latest counts.</p></div>`; return; }
    if (state.failed && !items.length) { list.innerHTML = `<div class="empty"><h3>Can't reach stock</h3><p>Check your connection. The page keeps trying on its own.</p></div>`; return; }
    if (!items.length) { list.innerHTML = `<div class="empty"><h3>No pieces yet</h3><p>Unlock editing with the team PIN, then add your first piece.</p></div>`; return; }
    if (!shown.length) { list.innerHTML = `<div class="empty"><h3>Nothing matches</h3><p>Try another size, color or garment, or clear the search.</p><button class="btn" type="button" data-reset>Clear filters</button></div>`; return; }
    const ro = state.canWrite ? "" : "disabled";

    if (state.view === "size") {
      const sizeList = state.size ? [state.size] : [...new Set(shown.flatMap(sizesOf))].sort((a,b) => SIZE_RANK(a) - SIZE_RANK(b));
      const sorted = shown.slice().sort((a,b) => (a.garment||"").localeCompare(b.garment||"") || (a.design||"").localeCompare(b.design||"") || (a.color||"").localeCompare(b.color||""));
      list.innerHTML = sizeList.map(s => {
        const rows = sorted.filter(it => sizesOf(it).includes(s));
        const inStock = rows.filter(it => qtyOf(it, s) > 0), outRows = rows.filter(it => qtyOf(it, s) <= 0);
        const pcs = inStock.reduce((t, it) => t + qtyOf(it, s), 0);
        const visible = state.showOut ? [...inStock, ...outRows] : inStock;
        const byG = new Map(); visible.forEach(it => { const g = it.garment || "Other"; if (!byG.has(g)) byG.set(g, []); byG.get(g).push(it); });
        const body = visible.length ? [...byG].map(([g, arr]) => `<p class="subhead">${esc(g)} · ${arr.reduce((t, it) => t + qtyOf(it, s), 0)} pcs</p><div class="minis">` + arr.map(it => { const n = qtyOf(it, s); return `
          <article class="item mini ${n <= 0 ? "zero" : ""}" data-id="${esc(it.id)}">
            <div class="who"><span class="sw" style="background:${swatch(it)}"></span><div class="t"><div class="name">${esc(it.design || it.color)}</div><div class="meta">${esc([it.color, it.style, it.garment].filter(Boolean).join(" "))}</div></div></div>
            ${cell(it, s, n, "m", ro, false)}
          </article>`; }).join("") + `</div>`).join("") : `<p class="hint">Nothing in stock in ${esc(s)}${outRows.length ? ` · ${outRows.length} sold out (tick Show sold-out to see them)` : ""}.</p>`;
        return `<section class="group"><div class="sizehead"><span class="big">${esc(s)}</span><small>${pcs} pcs in stock · ${inStock.length} products${outRows.length ? ` · ${outRows.length} sold out` : ""}</small></div>${body}</section>`;
      }).join("");
      return;
    }

    const byDesign = state.groupBy === "design", groups = new Map();
    const cmp = (a, b, k) => (a[k]||"").localeCompare(b[k]||"");
    shown.slice().sort((a,b) => byDesign ? (cmp(a,b,"design") || cmp(a,b,"garment") || cmp(a,b,"color") || cmp(a,b,"style")) : (cmp(a,b,"garment") || cmp(a,b,"design") || cmp(a,b,"color") || cmp(a,b,"style")))
      .forEach(it => { const g = byDesign ? (it.design || "No design") : (it.garment || "Other"); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    const cardTitle = it => byDesign && it.design ? [it.color, it.style, it.garment].filter(Boolean).join(" ") : titleOf(it);
    const cardSub = it => byDesign ? (it.design ? "" : "No design noted") : subOf(it);
    list.innerHTML = [...groups].map(([g, arr]) => {
      const gUnits = arr.reduce((t, it) => t + sizesOf(it).reduce((u, s) => u + qtyOf(it, s), 0), 0);
      return `<section class="group"><h2>${esc(g)}<small>${arr.length} ${arr.length === 1 ? "product" : "products"} · ${gUnits} pcs</small></h2>` + arr.map(it => {
        const total = sizesOf(it).reduce((u, s) => u + qtyOf(it, s), 0), st = itemStatus(it);
        const pill = st === "ok" ? `<span class="pill ok">In stock</span>` : st === "low" ? `<span class="pill low">Running low</span>` : st === "partial" ? `<span class="pill low">Some sizes out</span>` : `<span class="pill out">Sold out</span>`;
        return `<article class="item" data-id="${esc(it.id)}">
          <div class="who"><span class="sw" style="background:${swatch(it)}"></span><div class="t"><div class="name">${esc(cardTitle(it) || "Untitled")}</div>${cardSub(it) ? `<div class="meta">${esc(cardSub(it))}</div>` : ""}</div></div>
          <div class="sizes">${sizesOf(it).map(s => cell(it, s, qtyOf(it, s), "q", ro, state.size === s)).join("")}</div>
          <div class="side"><div class="total"><b>${total}</b>total</div>${pill}${state.canWrite ? `<button class="icon" type="button" data-edit aria-label="Edit ${esc(titleOf(it))}" title="Edit">✎</button>` : ""}</div>
        </article>`;
      }).join("") + `</section>`;
    }).join("");
  }
  let needsRender = false;
  function softRender(){ const a = document.activeElement; if (a && a.matches && a.matches(".sz input")) { needsRender = true; return; } render(); }

  // ---- count changes ----
  const deltas = new Map(), dTimers = new Map();
  function setLocal(id, s, n){ const it = state.items.find(i => i.id === id); if (it) it.sizes = { ...it.sizes, [s]: n }; }
  function queueDelta(id, s, d){
    const k = id + "|" + s; deltas.set(k, (deltas.get(k) || 0) + d); lastWrite = Date.now();
    clearTimeout(dTimers.get(k));
    dTimers.set(k, setTimeout(async () => {
      const delta = deltas.get(k) || 0; deltas.delete(k); if (!delta) return;
      try { const j = await post("adjust_stock", { p_item: id, p_size: s, p_delta: delta }); if (!deltas.get(k)) { setLocal(id, s, j.qty); softRender(); } }
      catch (e) { toast(e.message); load(true); }
    }, 300));
  }
  $("list").addEventListener("click", e => {
    if (e.target.closest("[data-reset]")) { state.q = ""; state.size = ""; state.status = ""; state.garment = ""; $("q").value = ""; $("statusF").value = ""; render(); return; }
    const art = e.target.closest(".item"); if (!art) return;
    const id = art.dataset.id, it = state.items.find(i => i.id === id); if (!it) return;
    if (e.target.closest("[data-edit]")) return openDialog(it);
    const b = e.target.closest("[data-step]"); if (!b || !state.canWrite) return;
    const s = b.dataset.s, step = Number(b.dataset.step), cur = qtyOf(it, s), n = Math.max(0, cur + step);
    if (n === cur) return;
    setLocal(id, s, n); queueDelta(id, s, n - cur); render();
    const btn = document.querySelector(`.item[data-id="${CSS.escape(id)}"] [data-step="${step}"][data-s="${CSS.escape(s)}"]`); btn && btn.focus();
  });
  $("list").addEventListener("change", async e => {
    const inp = e.target.closest(".sz input"); if (!inp || !state.canWrite) return;
    const id = inp.closest(".item").dataset.id, s = inp.dataset.s;
    const n = Math.max(0, Math.min(100000, Math.floor(Number(inp.value) || 0))); inp.value = n;
    setLocal(id, s, n);
    try { const j = await post("adjust_stock", { p_item: id, p_size: s, p_delta: n, p_absolute: true }); setLocal(id, s, j.qty); softRender(); }
    catch (er) { toast(er.message); load(true); }
  });
  $("list").addEventListener("submit", async e => {
    if (e.target.id !== "gateForm") return;
    e.preventDefault();
    const code = $("gateInput").value.trim(); if (!code) return;
    const err = $("gateErr"); $("gateGo").disabled = true;
    try {
      const j = await getStock(code);
      if (j.ok) { state.code = code; ls.set("wasta-code", code); state.gated = false; state.gateMsg = ""; state.loaded = false; applyLock(); load(true); return; }
      err.textContent = j.error === "locked" ? "Too many wrong tries. Wait 15 minutes, then try again." : "That passkey isn't right. Check with your team.";
      err.hidden = false;
    } catch { err.textContent = "Couldn't check the passkey. Check your connection."; err.hidden = false; }
    const go = $("gateGo"); if (go) go.disabled = false;
  });
  $("list").addEventListener("keydown", e => { const inp = e.target.closest(".sz input"); if (inp && e.key === "Enter") inp.blur(); });
  $("list").addEventListener("focusin", e => { if (e.target.matches(".sz input") && state.canWrite) e.target.select(); });
  $("list").addEventListener("focusout", e => {
    if (e.target.matches(".sz input")) setTimeout(() => { const a = document.activeElement; if (needsRender && !(a && a.matches && a.matches(".sz input"))) { needsRender = false; render(); } }, 0);
  });

  // ---- filters ----
  $("stats").addEventListener("click", e => { const j = e.target.closest("[data-jump]"); if (!j) return; state.status = j.dataset.jump; $("statusF").value = state.status; render(); });
  $("chips").addEventListener("click", e => { const c = e.target.closest("[data-g]"); if (!c) return; state.garment = c.dataset.g; render(); });
  $("q").addEventListener("input", e => { state.q = e.target.value; render(); });
  $("sizeF").addEventListener("change", e => { state.size = e.target.value; render(); });
  $("statusF").addEventListener("change", e => { state.status = e.target.value; render(); });
  $("groupF").addEventListener("change", e => { state.groupBy = e.target.value; ls.set("wasta-groupBy", state.groupBy); render(); });
  document.querySelector(".seg").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (!b) return; state.view = b.dataset.view; ls.set("wasta-view", state.view); render(); });
  $("showOut").addEventListener("change", e => { state.showOut = e.target.checked; render(); });
  let lowT;
  $("lowAt").addEventListener("input", e => {
    const v = Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0))); state.lowAt = v; render();
    clearTimeout(lowT);
    if (state.canWrite) lowT = setTimeout(() => post("set_low_at", { p_value: v }).catch(er => toast(er.message)), 700);
  });

  // ---- add / edit dialog ----
  let editing = null, pickSizes = [];
  $("addBtn").addEventListener("click", () => openDialog());
  function openDialog(it){
    if (!state.canWrite) return;
    editing = it || null;
    $("dlgTitle").textContent = it ? "Edit piece" : "Add a piece";
    $("fGarment").value = it ? (it.garment || "") : (state.garment || "Hoodie");
    $("fStyle").value = it?.style || ""; $("fColor").value = it?.color || "";
    $("fHex").value = it?.colorHex || "#151714"; $("fDesign").value = it?.design || "";
    const have = it ? sizesOf(it) : DEFAULT_ON;
    pickSizes = [...new Set([...BASE_SIZES, ...have])].sort((a,b) => SIZE_RANK(a) - SIZE_RANK(b)).map(s => ({ s, on: have.includes(s), n: it ? qtyOf(it, s) : 0 }));
    drawPick();
    $("delBtn").hidden = !it; $("delBtn").classList.remove("armed"); $("delBtn").textContent = "Delete piece";
    $("formErr").hidden = true; $("dlg").hidden = false;
    setTimeout(() => $(it ? "fStyle" : "fDesign").focus(), 0);
  }
  function drawPick(){
    $("sizePick").innerHTML = pickSizes.map((p, i) => `<label class="${p.on ? "on" : ""}"><span class="k"><input type="checkbox" data-i="${i}" ${p.on ? "checked" : ""}>${esc(p.s)}</span><input type="number" min="0" inputmode="numeric" data-n="${i}" value="${p.n}" aria-label="Quantity ${esc(p.s)}" ${p.on ? "" : "disabled"}></label>`).join("");
  }
  $("sizePick").addEventListener("change", e => { const c = e.target.closest("[data-i]"); if (c) { pickSizes[c.dataset.i].on = c.checked; drawPick(); } });
  $("sizePick").addEventListener("input", e => { const n = e.target.closest("[data-n]"); if (n) pickSizes[n.dataset.n].n = Math.max(0, Math.floor(Number(n.value) || 0)); });
  $("sizePick").addEventListener("focusin", e => { if (e.target.matches("[data-n]")) e.target.select(); });
  $("addSizeBtn").addEventListener("click", () => {
    const v = $("newSize").value.trim().toUpperCase().replace(/[^A-Z0-9 .\-]/g, "").slice(0, 8); if (!v) return;
    const ex = pickSizes.find(p => p.s === v); if (ex) ex.on = true; else pickSizes.push({ s: v, on: true, n: 0 });
    pickSizes.sort((a,b) => SIZE_RANK(a.s) - SIZE_RANK(b.s)); $("newSize").value = ""; drawPick();
  });
  $("newSize").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("addSizeBtn").click(); } });
  $("fColor").addEventListener("input", e => { const g = COLOR_GUESS[e.target.value.trim().toLowerCase()]; if (g) $("fHex").value = g; });
  const closeDialog = () => { $("dlg").hidden = true; editing = null; };
  $("cancelBtn").addEventListener("click", closeDialog);
  $("dlg").addEventListener("click", e => { if (e.target === $("dlg")) closeDialog(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("dlg").hidden) closeDialog(); $("pinDlg").hidden = true; } });
  $("delBtn").addEventListener("click", async () => {
    const b = $("delBtn");
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Tap again to delete"; return; }
    const it = editing; closeDialog();
    state.items = state.items.filter(i => i.id !== it.id); render();
    try { await post("delete_item", { p_item: it.id }); toast(`Deleted ${titleOf(it)}`); } catch (e) { toast(e.message); }
    load(true);
  });
  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const garment = $("fGarment").value.trim(), style = $("fStyle").value.trim(), color = $("fColor").value.trim(), design = $("fDesign").value.trim();
    const on = pickSizes.filter(p => p.on);
    const err = !garment ? "Add a garment, like Hoodie." : !color ? "Add a color, like Black." : !on.length ? "Pick at least one size." : "";
    if (err) { $("formErr").textContent = err; $("formErr").hidden = false; return; }
    const key = x => [x.garment, x.style, x.color, x.design].map(v => (v || "").toLowerCase()).join("|");
    if (state.items.find(i => i.id !== editing?.id && key(i) === key({ garment, style, color, design }))) { $("formErr").textContent = "That exact piece is already listed. Edit its counts instead."; $("formErr").hidden = false; return; }
    const item = { id: editing?.id || "", garment, style, color, design, colorHex: $("fHex").value, sizeOrder: on.map(p => p.s), sizes: Object.fromEntries(on.map(p => [p.s, p.n])) };
    $("saveBtn").disabled = true;
    try { await post("save_item", { p_item: item }); toast(editing ? "Saved" : `Added ${[design, color, garment].filter(Boolean).join(" ")}`); closeDialog(); await load(true); }
    catch (er) { $("formErr").textContent = er.message; $("formErr").hidden = false; }
    finally { $("saveBtn").disabled = false; }
  });

  let toastT;
  function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

  // ---- snow ----
  (() => {
    const band = document.querySelector(".band .inner"); if (!band || !window.ResizeObserver) return;
    const c = document.createElement("canvas"); c.id = "snow"; c.setAttribute("aria-hidden", "true"); band.prepend(c);
    const x = c.getContext("2d"); let W = 0, H = 0, flakes = [];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    function size(){ const r = band.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0);
      flakes = Array.from({ length: Math.round(W * H / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + .6, s: Math.random() * .5 + .25, w: Math.random() * Math.PI * 2, o: Math.random() * .5 + .35 })); draw(); }
    function draw(){ x.clearRect(0, 0, W, H); for (const f of flakes) { x.beginPath(); x.arc(f.x, f.y, f.r, 0, Math.PI * 2); x.fillStyle = `rgba(235,244,255,${f.o})`; x.fill(); } }
    function tick(){ if (!reduce.matches && !document.hidden) { for (const f of flakes) { f.y += f.s; f.w += .012; f.x += Math.sin(f.w) * .3; if (f.y > H + 3) { f.y = -3; f.x = Math.random() * W; } } draw(); } requestAnimationFrame(tick); }
    new ResizeObserver(size).observe(band); size(); requestAnimationFrame(tick);
  })();

  // ---- boot ----
  render();
  (async () => {
    if (state.pin && configured) { try { const j = await verify(state.pin); if (j.ok) state.canWrite = true; else lockEditing(); } catch {} }
    applyLock(); load(true);
  })();
})();
