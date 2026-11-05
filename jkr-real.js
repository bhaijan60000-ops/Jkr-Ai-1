/* JKR AI - replaces the demo account with the real Firebase account + cloud sync.
   Load AFTER auth.js:  <script src="auth.js"></script><script src="jkr-real.js"></script> */
(function () {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let syncReady = false, timer = null;

  // Real account dialog (replaces the demo one)
  window.accountDialog = function () {
    const u = window.firebase && firebase.auth().currentUser;
    if (!u) return;
    modal(`<h3>👤 My Account</h3>
      <p class="muted">${u.emailVerified ? "✓ Email verified" : "Email not verified yet - check your inbox."}</p>
      <label>Name</label><input class="field" id="rName" value="${esc(u.displayName || "")}">
      <label>Email</label><input class="field" value="${esc(u.email)}" disabled>
      <div class="actions"><button class="soft" onclick="closeModal()">Close</button><button class="primary" id="rSave">Save name</button></div>
      <div class="actions"><button class="soft" id="rLogout">↪ Log out</button></div>`);
    $("rSave").onclick = async () => {
      const n = $("rName").value.trim() || u.email.split("@")[0];
      await u.updateProfile({ displayName: n });
      window.JKR_USER.name = n; setAvatar(); closeModal();
    };
    $("rLogout").onclick = () => { closeModal(); JKR_logout(); };
  };

  function setAvatar() {
    const n = (window.JKR_USER && window.JKR_USER.name) || "JK";
    const b = $("accountMenuBtn"); if (b) b.textContent = n.slice(0, 2).toUpperCase();
    profile = { name: window.JKR_USER ? window.JKR_USER.name : "", email: window.JKR_USER ? window.JKR_USER.email : "" };
  }

  // Sidebar Account button was bound to the old demo dialog
  const ab = $("accountBtn"); if (ab) ab.onclick = window.accountDialog;

  // Menu label + real sign out
  const si = document.querySelector('[data-action="account"]'); if (si) si.textContent = "👤 My Account";
  const so = document.querySelector('[data-action="signout"]');
  if (so) so.addEventListener("click", e => { e.stopImmediatePropagation(); JKR_logout(); }, true);

  // Cloud sync: load on login, save (debounced) on every save()
  window.addEventListener("jkr-login", async () => {
    setAvatar(); syncReady = false;
    try {
      const d = await JKR_loadHistory();
      if (d && !Array.isArray(d)) {
        chats = d.chats || []; projects = d.projects || []; library = d.library || [];
        store.set("history", chats); store.set("projects", projects); store.set("library", library);
        if (currentView === "history") renderHistory();
      }
    } catch (e) {}
    syncReady = true;
  });
  window.addEventListener("jkr-logout", () => { chats = []; projects = []; library = []; store.set("history", []); store.set("projects", []); store.set("library", []); });

  const _save = window.save;
  window.save = function () {
    _save();
    if (!syncReady) return;
    clearTimeout(timer);
    timer = setTimeout(() => JKR_saveHistory({ chats, projects, library }).catch(() => {}), 1500);
  };
})();
