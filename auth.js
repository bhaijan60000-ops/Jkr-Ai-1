/* JKR AI - Real Login Patch (Firebase Auth + Firestore)
   Setup: 1) Paste your firebaseConfig below.
          2) Add <script src="auth.js"></script> before </body> in index.html.
*/
(function () {
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAt1u8Xt3PCg_pOhiAd4PwL_-FCN5Mf9FI",
  authDomain: "jkr-ai.firebaseapp.com",
  projectId: "jkr-ai",
  storageBucket: "jkr-ai.firebasestorage.app",
  messagingSenderId: "769372108757",
  appId: "1:769372108757:web:292b9082552a474a30af5c",
  measurementId: "G-7BHRV2ZDJH"
};

  const V = "10.12.2";
  const base = "https://www.gstatic.com/firebasejs/" + V + "/";
  function load(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // ---------- UI ----------
  const css = `
  #jkrAuth{position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#1a1650,#3b1f8f);display:none;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif}
  #jkrAuth .box{background:#fff;border-radius:24px;padding:24px;width:100%;max-width:380px;box-shadow:0 20px 60px #0006}
  #jkrAuth h2{margin:0 0 4px;color:#1a1650}
  #jkrAuth p{margin:0 0 16px;color:#6b6b8d;font-size:14px}
  #jkrAuth input{width:100%;box-sizing:border-box;padding:14px;margin-bottom:10px;border:1.5px solid #e4e0ff;border-radius:14px;font-size:16px}
  #jkrAuth button{width:100%;padding:14px;border:0;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:10px}
  #jkrAuth .pri{background:linear-gradient(135deg,#6a35f0,#8b45e8);color:#fff}
  #jkrAuth .goo{background:#f5f3ff;color:#1a1650;border:1.5px solid #e4e0ff}
  #jkrAuth .lnk{background:none;color:#6a35f0;font-weight:600;font-size:14px;padding:6px;margin:0}
  #jkrAuth .err{color:#d32f2f;font-size:13px;min-height:18px;margin-bottom:8px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const ov = document.createElement("div");
  ov.id = "jkrAuth";
  ov.innerHTML = `
  <div class="box">
    <h2 id="aT">Login</h2>
    <p id="aS">JKR AI mein khush aamdeed</p>
    <input id="aE" type="email" placeholder="Email" autocomplete="email">
    <input id="aP" type="password" placeholder="Password (min 6)" autocomplete="current-password">
    <div class="err" id="aErr"></div>
    <button class="pri" id="aGo">Login</button>
    <button class="goo" id="aG">Google se login</button>
    <button class="lnk" id="aSw">Naya account banayen</button>
    <button class="lnk" id="aF">Password bhool gaye?</button>
  </div>`;
  document.body.appendChild(ov);
  const $ = id => document.getElementById(id);
  let mode = "login";

  function setMode(m) {
    mode = m;
    $("aT").textContent = m === "login" ? "Login" : "Sign up";
    $("aGo").textContent = m === "login" ? "Login" : "Account banayen";
    $("aSw").textContent = m === "login" ? "Naya account banayen" : "Pehle se account hai? Login";
    $("aErr").textContent = "";
  }

  function msg(e) {
    const c = (e && e.code) || "";
    if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Email ya password ghalat hai.";
    if (c.includes("email-already")) return "Ye email pehle se registered hai.";
    if (c.includes("weak-password")) return "Password kam az kam 6 characters ka rakhen.";
    if (c.includes("invalid-email")) return "Email sahi nahi hai.";
    if (c.includes("network")) return "Internet check karen.";
    return "Masla aaya: " + (e.message || c);
  }

  // ---------- Firebase ----------
  Promise.all([load(base + "firebase-app-compat.js")])
    .then(() => Promise.all([load(base + "firebase-auth-compat.js"), load(base + "firebase-firestore-compat.js")]))
    .then(init)
    .catch(() => { $("aErr").textContent = "Firebase load nahi hua. Internet check karen."; ov.style.display = "flex"; });

  function init() {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    auth.useDeviceLanguage();

    $("aSw").onclick = () => setMode(mode === "login" ? "signup" : "login");

    $("aGo").onclick = async () => {
      const e = $("aE").value.trim(), p = $("aP").value;
      $("aErr").textContent = "";
      try {
        if (mode === "login") await auth.signInWithEmailAndPassword(e, p);
        else {
          const cr = await auth.createUserWithEmailAndPassword(e, p);
          try { await cr.user.sendEmailVerification(); } catch (_) {}
        }
      } catch (x) { $("aErr").textContent = msg(x); }
    };

    $("aG").onclick = async () => {
      try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
      catch (x) {
        if ((x.code || "").includes("popup")) { try { await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); } catch (y) { $("aErr").textContent = msg(y); } }
        else $("aErr").textContent = msg(x);
      }
    };

    $("aF").onclick = async () => {
      const e = $("aE").value.trim();
      if (!e) { $("aErr").textContent = "Pehle email likhen."; return; }
      try { await auth.sendPasswordResetEmail(e); $("aErr").style.color = "#2e7d32"; $("aErr").textContent = "Reset link email par bhej diya."; }
      catch (x) { $("aErr").style.color = "#d32f2f"; $("aErr").textContent = msg(x); }
    };

    auth.onAuthStateChanged(user => {
      if (user) {
        ov.style.display = "none";
        window.JKR_USER = { uid: user.uid, name: user.displayName || user.email.split("@")[0], email: user.email };
        // Fill the existing Account modal fields if present
        document.querySelectorAll('input').forEach(i => {
          const l = (i.placeholder || i.id || i.name || "").toLowerCase();
          if (l.includes("email") && !i.id.startsWith("a")) i.value = user.email;
          if (l.includes("name") && !i.id.startsWith("a")) i.value = window.JKR_USER.name;
        });
        window.dispatchEvent(new CustomEvent("jkr-login", { detail: window.JKR_USER }));
      } else {
        window.JKR_USER = null;
        ov.style.display = "flex";
      }
    });

    // ---------- Cloud history API ----------
    // Save:  JKR_saveHistory(chatsArray)    Load: await JKR_loadHistory()
    window.JKR_saveHistory = async (chats) => {
      if (!window.JKR_USER) return;
      await db.collection("users").doc(window.JKR_USER.uid).set({ chats: JSON.stringify(chats), updated: Date.now() }, { merge: true });
    };
    window.JKR_loadHistory = async () => {
      if (!window.JKR_USER) return null;
      const d = await db.collection("users").doc(window.JKR_USER.uid).get();
      return d.exists ? JSON.parse(d.data().chats || "[]") : null;
    };
    window.JKR_logout = () => auth.signOut().then(() => window.dispatchEvent(new Event("jkr-logout")));
  }
})();
