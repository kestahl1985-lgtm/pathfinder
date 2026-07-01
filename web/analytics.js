/* Vula — consent-gated Google Analytics (GA4).
   GA only loads AFTER the visitor accepts. Choice stored in localStorage.
   POPIA-conscious: no analytics cookies set until explicit consent. */
(function () {
  var GA_ID = "G-BKPL45YTGG";
  var KEY = "vula_analytics_consent"; // "granted" | "denied"

  function loadGA() {
    if (window.__vulaGALoaded) return;
    window.__vulaGALoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });
  }

  function setConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (v === "granted") loadGA();
  }

  function showBanner() {
    var bar = document.createElement("div");
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Cookie consent");
    bar.style.cssText =
      "position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:680px;margin:0 auto;" +
      "background:#0d1430;border:1px solid rgba(255,255,255,.12);border-radius:16px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.5);padding:18px 20px;color:#fff;" +
      "font-family:Inter,system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;";
    var txt = document.createElement("div");
    txt.style.cssText = "flex:1 1 320px;font-size:14px;line-height:1.5;color:#cdd3e8;";
    txt.innerHTML =
      "We use Google Analytics to understand how the site is used and improve it. " +
      "No analytics cookies are set unless you accept. See our " +
      '<a href="/cookies.html" style="color:#b6f400;text-decoration:underline;">Cookie Policy</a>.';
    var btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:10px;flex:0 0 auto;";

    function mkBtn(label, primary) {
      var b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        "cursor:pointer;border-radius:10px;padding:9px 18px;font-size:14px;font-weight:600;border:0;" +
        (primary
          ? "background:linear-gradient(180deg,#2be975,#25d366);color:#062b18;"
          : "background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14);");
      return b;
    }
    var accept = mkBtn("Accept", true);
    var decline = mkBtn("Decline", false);
    accept.onclick = function () { setConsent("granted"); bar.remove(); };
    decline.onclick = function () { setConsent("denied"); bar.remove(); };
    btns.appendChild(decline);
    btns.appendChild(accept);
    bar.appendChild(txt);
    bar.appendChild(btns);
    document.body.appendChild(bar);
  }

  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}

  if (choice === "granted") {
    loadGA();
  } else if (choice !== "denied") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner);
    } else {
      showBanner();
    }
  }
})();
