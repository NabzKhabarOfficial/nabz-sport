/* نبض ورزش: home page (today's matches) */
let DATA = null, FILTER = "all", TIMER = null;

function leagueBig(title) { return BIG.test(title) && !MINOR.test(title); }

function rowHTML(m) {
  const sc = scorePair(m), live = isLive(m), done = isDone(m);
  const hw = done && m.winner === 0 && m.winnerId === m.hostId, gw = done && m.winnerId === m.guestId;
  const pp = penPair(m);
  const pen = pp ? `<span class="pen">پنالتی ${FA(pp[0])}-${FA(pp[1])}</span>` : "";
  const scoreHTML = sc ? `<div class="score${live ? " live" : ""}">${FA(sc[0])} - ${FA(sc[1])}${pen}</div>` : `<div class="score" style="color:var(--muted);font-size:14px">-</div>`;
  const w = watchUrl(m);
  const watch = (w && !done) ? `<a class="watch" href="${esc(w)}" target="_blank" rel="nofollow noopener">▶ تماشا</a>` : `<span></span>`;
  return `<div class="row${isIran(m) ? " iran" : ""}" role="link" tabindex="0" data-href="match.html?id=${encodeURIComponent(m.sportId)}">
    <div class="st${live ? " live" : ""}">${esc(statusText(m))}</div>
    <div class="team home${hw ? " win" : ""}">${logo(m.hostLogo, m.hostName)}<span>${esc(m.hostName)}</span></div>
    ${scoreHTML}
    <div class="team away${gw ? " win" : ""}">${logo(m.guestLogo, m.guestName)}<span>${esc(m.guestName)}</span></div>
    ${watch}
  </div>`;
}

function render() {
  const box = document.getElementById("list");
  if (!DATA) return;
  const leagues = new Map((DATA.leagues || []).map(l => [l.id, l]));
  const matches = (DATA.matches || []).slice().sort((a, b) => String(a.scheduledStartOn).localeCompare(String(b.scheduledStartOn)));
  document.getElementById("live-count").textContent = (() => { const n = matches.filter(isLive).length; return n ? FA(n) : ""; })();
  const groups = new Map();
  for (const m of matches) {
    const lg = leagues.get(m.leagueId) || {title: "سایر", sport: m.sport};
    const title = norm(lg.title);
    if (FILTER === "live" && !isLive(m)) continue;
    if (FILTER === "iran" && !isIran(m)) continue;
    if (/^[0-9]$/.test(FILTER) && String(m.sport) !== FILTER) continue;
    if (FILTER === "big" && !(leagueBig(title) || isIran(m))) continue;
    if (!groups.has(m.leagueId)) groups.set(m.leagueId, {lg, title, items: [], score: 0});
    const g = groups.get(m.leagueId);
    g.items.push(m);
    g.score = Math.max(g.score, (isIran(m) ? 100 : 0) + (leagueBig(title) ? 10 : 0) + (isLive(m) ? 5 : 0));
  }
  const ordered = [...groups.values()].sort((a, b) => b.score - a.score);
  if (!ordered.length) {
    box.innerHTML = `<div class="empty">${FILTER === "live" ? "الان بازی زنده‌ای در جریان نیست." : "بازی‌ای برای این فیلتر پیدا نشد."}</div>`;
    return;
  }
  box.innerHTML = ordered.map(g => {
    const sp = SPORT[g.lg.sport] || SPORT[1];
    const lgLogo = g.lg.logo ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(g.lg.logo)}" alt="" onerror="this.remove()">` : "";
    return `<section class="league"><div class="league-h">${lgLogo}<span>${esc(g.title)}</span><span class="sp">${sp[0]} ${sp[1]}</span></div>${g.items.map(rowHTML).join("")}</section>`;
  }).join("");
}

async function refresh() {
  try {
    const r = await loadWithFallback(API + "/today", "data/today.json");
    DATA = r.data; setSync(r.live); render();
    clearTimeout(TIMER);
    TIMER = setTimeout(refresh, r.live ? 30000 : 90000);
  } catch (e) {
    if (!DATA) document.getElementById("list").innerHTML = `<div class="empty">اتصال برقرار نشد. چند لحظه دیگر دوباره امتحان کنید.</div>`;
    clearTimeout(TIMER); TIMER = setTimeout(refresh, 60000);
  }
}

document.getElementById("today-label").textContent = todayLabel();
document.getElementById("filters").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  document.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === b));
  FILTER = b.dataset.f; render();
});
document.getElementById("list").addEventListener("click", e => {
  if (e.target.closest(".watch")) return;
  const r = e.target.closest(".row[data-href]"); if (r) location.href = r.dataset.href;
});
document.getElementById("list").addEventListener("keydown", e => {
  const r = e.target.closest(".row[data-href]"); if (r && e.key === "Enter") location.href = r.dataset.href;
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
refresh();
