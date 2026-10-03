/* نبض ورزش: match page */
const ID = new URLSearchParams(location.search).get("id") || "";
const [KIND, NUM] = ID.split("-");
let TIMER = null;

const EV_ICON = {1: "⚽", 2: "🟨", 4: "🔁", 6: "🎯"};

function evRow(e) {
  let icon = EV_ICON[e.eventType] || "•", main = "", sub = "";
  if (e.eventType === 1) { main = e.strickerName || ""; if (e.assisterName) sub = "پاس گل: " + e.assisterName; if (e.goalType === 1) sub = "پنالتی"; if (e.goalType === 2) sub = "گل به خودی"; }
  else if (e.eventType === 2) { icon = e.cardType === 2 || e.cardType === 3 ? "🟥" : "🟨"; main = e.offendingPlayerName || ""; }
  else if (e.eventType === 4) { main = e.incomingPlayerName ? "⬆ " + e.incomingPlayerName : ""; sub = e.outgoingPlayerName ? "⬇ " + e.outgoingPlayerName : ""; }
  else { main = e.description || ""; }
  const res = (e.eventType === 1 && e.matchResult) ? `<span class="res">${FA(e.matchResult.host)}-${FA(e.matchResult.guest)}</span>` : "";
  const cell = `<div>${icon} ${esc(main)}${res}${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`;
  return `<div class="ev"><div class="h">${e.side === 0 ? cell : ""}</div><div class="min">${FA(e.time || "")}'</div><div class="g">${e.side === 1 ? cell : ""}</div></div>`;
}

function shootout(list) {
  if (!list.length) return "";
  const rows = list.sort((a, b) => (a.priority - b.priority) || (a.side - b.side)).map(e => {
    const ok = e.penaltyResult === 1;
    const cell = `<div>${ok ? "✅" : "❌"} ${esc(e.kickerName || "")}</div>`;
    return `<div class="ev"><div class="h">${e.side === 0 ? cell : ""}</div><div class="min">${FA(e.priority)}</div><div class="g">${e.side === 1 ? cell : ""}</div></div>`;
  }).join("");
  return `<section class="sec"><h2>🎯 ضربات پنالتی</h2>${rows}</section>`;
}

function render(m, lg, events) {
  const live = isLive(m), sc = scorePair(m);
  document.title = `${norm(m.hostName)} - ${norm(m.guestName)} | نبض ورزش`;
  const w = watchUrl(m), rep = reporter(m);
  const cta = (w && !isDone(m)) ? `<a class="cta" href="${esc(w)}" target="_blank" rel="nofollow noopener">▶ تماشای پخش زنده در آنتن ${rep ? `<small>· گزارش ${esc(rep)}</small>` : ""}</a>` : "";
  const pens = (m.hasPenalty && m.hostPenalty != null) ? `<div class="pens">پنالتی: ${FA(m.hostPenalty)} - ${FA(m.guestPenalty)}</div>` : "";
  const info = [
    ["رقابت", norm(lg ? lg.title : "")],
    ["زمان", (m.scheduledStartDate ? FA(norm(m.scheduledStartDate)) + " · " : "") + FA(m.time || "")],
    ["ورزشگاه", m.stadium || ""],
    ["داور", m.referee || ""],
  ].filter(x => x[1]).map(x => `<div>${x[0]}<b>${esc(x[1])}</b></div>`).join("");
  const regular = events.filter(e => e.eventType !== 6).sort((a, b) => a.rawTime - b.rawTime);
  const firstHalf = regular.filter(e => e.scope === 2), rest = regular.filter(e => e.scope !== 2);
  const timeline = regular.length ? `<section class="sec"><h2>📋 رویدادهای بازی</h2>${firstHalf.length ? `<div class="half">نیمه اول</div>${firstHalf.map(evRow).join("")}` : ""}${rest.length ? `<div class="half">نیمه دوم</div>${rest.map(evRow).join("")}` : ""}</section>` : "";
  document.getElementById("match").innerHTML = `
    <section class="mh">
      <div class="lg">${esc(norm(lg ? lg.title : ""))}</div>
      <div class="teams">
        <div class="t">${logo(m.hostLogo, m.hostName)}<span>${esc(m.hostName)}</span></div>
        <div><div class="big${live ? " live" : ""}">${sc ? `${FA(sc[0])} - ${FA(sc[1])}` : FA(m.time || "")}</div>
          <div class="status${live ? " live" : ""}">${esc(sc ? statusText(m) : (m.scheduledStartDate ? FA(norm(m.scheduledStartDate)) : ""))}</div>${pens}</div>
        <div class="t">${logo(m.guestLogo, m.guestName)}<span>${esc(m.guestName)}</span></div>
      </div>
      ${cta}
    </section>
    <div class="info">${info}</div>
    ${timeline}
    ${shootout(events.filter(e => e.eventType === 6))}
    ${!regular.length && !sc ? `<div class="empty">بازی هنوز شروع نشده است.</div>` : ""}`;
}

async function refresh() {
  try {
    const t = await loadWithFallback(API + "/today", "data/today.json");
    const m = (t.data.matches || []).find(x => x.sportId === ID);
    if (!m) { document.getElementById("match").innerHTML = `<div class="empty">این بازی در فهرست امروز نیست.</div>`; return; }
    const lg = (t.data.leagues || []).find(l => l.id === m.leagueId);
    let events = [];
    if (m.hasEvents && KIND === "football") {
      try { events = (await loadWithFallback(`${API}/football/matches/${NUM}/events`, `data/m/${ID}.json`)).data || []; }
      catch (e) { events = []; }
    }
    render(m, lg, Array.isArray(events) ? events : []);
    setSync(t.live);
    clearTimeout(TIMER);
    TIMER = setTimeout(refresh, isLive(m) ? (t.live ? 30000 : 90000) : 180000);
  } catch (e) {
    document.getElementById("match").innerHTML = `<div class="empty">اتصال برقرار نشد. چند لحظه دیگر دوباره امتحان کنید.</div>`;
    clearTimeout(TIMER); TIMER = setTimeout(refresh, 60000);
  }
}
refresh();
