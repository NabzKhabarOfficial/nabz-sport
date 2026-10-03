/* نبض ورزش: shared helpers */
const API = "https://web-api.varzesh3.com/v1.0/livescore";
const FA = s => String(s ?? "").replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const SPORT = {1: ["⚽", "فوتبال"], 2: ["⚽", "فوتسال"], 3: ["🏐", "والیبال"], 4: ["🏀", "بسکتبال"], 5: ["🤾", "هندبال"]};
const BIG = /(لیگ برتر|لالیگا|سری آ|بوندس|لوشامپیونه|لیگ قهرمانان|لیگ اروپا|لیگ ملت|جام جهانی|جام ملت|المپیک|ناگویا|آسیایی|جام حذفی|سوپرجام|قهرمانی جهان)/;
const MINOR = /(زنان|امید|جوانان|نوجوانان| 2$| 2 |لیگ یک|لیگ دو|دسته)/;

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c])); }
function norm(s) { return String(s ?? "").replace(/\u200c/g, " ").replace(/\s+/g, " ").trim(); }

async function getJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {signal: ctl.signal, cache: "no-store"});
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* Live first (straight from the source), our own 5-minute snapshot as fallback. */
async function loadWithFallback(liveUrl, localUrl) {
  try { return {data: await getJSON(liveUrl, 6000), live: true}; }
  catch (e) { return {data: await getJSON(localUrl + "?t=" + Date.now(), 10000), live: false}; }
}

function setSync(live) {
  const el = document.getElementById("sync");
  if (!el) return;
  el.className = "sync " + (live ? "on" : "off");
  el.title = live ? "زنده: به‌روزرسانی هر ۳۰ ثانیه" : "به‌روزرسانی هر چند دقیقه";
}

function logo(url, name) {
  const ch = esc(norm(name).charAt(0) || "?");
  if (!url) return `<span class="logo ph">${ch}</span>`;
  return `<img class="logo" loading="lazy" referrerpolicy="no-referrer" src="${esc(url)}" alt="" onerror="this.outerHTML='<span class=&quot;logo ph&quot;>${ch}</span>'">`;
}

function isIran(m) { return /ایران/.test(norm(m.hostName) + " " + norm(m.guestName)); }
function isLive(m) { return !!m.isLive || m.status === 2; }
function isDone(m) { return m.status === 7; }

function scorePair(m) {
  if (m.sport !== 3 && m.matchGoals && m.matchGoals.host != null) return [m.matchGoals.host, m.matchGoals.guest];
  if (m.goals && m.goals.host != null) return [m.goals.host, m.goals.guest];
  const clean = v => String(v ?? "").replace(/\s*\(.*\)\s*/, "").trim();
  const h = clean(m.sport === 3 ? m.hostPoint : m.hostGoals);
  const g = clean(m.sport === 3 ? m.guestPoint : m.guestGoals);
  return (h === "" || g === "") ? null : [h, g];
}

/* Penalty shoot-out score, whichever shape the source uses. */
function penPair(m) {
  if (m.penaltyGoals && m.penaltyGoals.host != null) return [m.penaltyGoals.host, m.penaltyGoals.guest];
  if (m.penalties && m.penalties.host != null) return [m.penalties.host, m.penalties.guest];
  if (m.hasPenalty && m.hostPenalty != null) return [m.hostPenalty, m.guestPenalty];
  return null;
}

function statusText(m) {
  if (isLive(m)) {
    if (m.statusTitle) return m.statusTitle;
    return m.liveTime ? FA(m.liveTime) + "'" : "زنده";
  }
  if (isDone(m)) return m.statusTitle || "پایان";
  if (m.statusTitle) return m.statusTitle;
  return FA(m.time || "");
}

function watchUrl(m) {
  const u = String(m.liveStreamSource || "");
  return /^https:\/\/(www\.)?anten\.ir\//.test(u) ? u : "";
}

function reporter(m) {
  try {
    const u = decodeURIComponent(m.liveStreamSource || "");
    const r = u.match(/\(گزارش[-\s]([^)]+)\)/);
    return r ? r[1].replace(/-/g, " ") : "";
  } catch (e) { return ""; }
}

function todayLabel() {
  try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran"}).format(new Date()); }
  catch (e) { return ""; }
}
