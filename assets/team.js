/* نبض ورزش: team page built from the league table + today's matches */
const FORMW = {W: ["ب", "w"], D: ["م", "d"], L: ["ش", "l"]};
const same = (a, b) => norm(a).replace(/\s/g, "") === norm(b).replace(/\s/g, "");

(async function init() {
  const q = new URLSearchParams(location.search);
  const lid = q.get("l"), name = q.get("t") || "";
  const box = document.getElementById("team");
  let t;
  try { t = await getJSON(`data/tables/${encodeURIComponent(lid)}.json?t=${Date.now()}`); }
  catch (e) { box.innerHTML = `<div class="empty">اطلاعات این تیم پیدا نشد.</div>`; return; }
  const rows = t.rows || [];
  const r = rows.find(x => same(x.team, name));
  if (!r) { box.innerHTML = `<div class="empty">اطلاعات این تیم پیدا نشد.</div>`; return; }
  document.title = `${r.team} | جدول، امتیاز و نتایج اخیر | نبض ورزش`;

  const p = r.p || 0;
  const pct = v => p ? Math.round(100 * v / p) : 0;
  const per = v => p ? (v / p).toFixed(2) : "0";
  const leader = rows[0] || r;
  const gap = r.rank === 1 ? (rows[1] ? r.pts - rows[1].pts : 0) : leader.pts - r.pts;
  const form = (r.form || []).map(f => FORMW[f] ? `<i class="fd big ${FORMW[f][1]}">${FORMW[f][0]}</i>` : "").join("");
  const lo = Math.max(0, r.rank - 3), near = rows.slice(lo, lo + 5);

  box.innerHTML = `
    <section class="mh">
      <div class="lg">${esc(t.title)}</div>
      <div class="t">${logo(r.logo, r.team)}<span style="font-size:22px">${esc(r.team)}</span></div>
      <div class="rank-badge">رتبه <b>${FA(r.rank)}</b> با <b>${FA(r.pts)}</b> امتیاز</div>
      <div class="status">${r.rank === 1 ? (gap > 0 ? `${FA(gap)} امتیاز بالاتر از تیم دوم` : "صدرنشین") : `${FA(gap)} امتیاز فاصله تا صدر`}</div>
      <div class="formrow">${form}</div>
    </section>
    <div class="info">
      <div>بازی<b>${FA(p)}</b></div>
      <div>برد / مساوی / باخت<b>${FA(r.w)} / ${FA(r.d)} / ${FA(r.l)}</b></div>
      <div>درصد برد<b>${FA(pct(r.w))}٪</b></div>
      <div>گل زده (میانگین)<b>${FA(r.gf ?? "-")} (${FA(per(r.gf || 0))})</b></div>
      <div>گل خورده (میانگین)<b>${FA(r.ga ?? "-")} (${FA(per(r.ga || 0))})</b></div>
      <div>تفاضل گل<b class="ltr">${FA(r.gd > 0 ? "+" + r.gd : r.gd)}</b></div>
    </div>
    <div id="today-match"></div>
    <section class="sec"><h2>جایگاه در جدول</h2>
      <div class="tscroll"><table class="mini">${near.map(x => `<tr class="${same(x.team, r.team) ? "me" : ""}">
        <td class="rk">${FA(x.rank)}</td>
        <td class="tm"><a href="team.html?l=${t.id}&t=${encodeURIComponent(x.team)}">${logo(x.logo, x.team)}<span>${esc(x.team)}</span></a></td>
        <td>${FA(x.p)}</td><td class="pts">${FA(x.pts)}</td></tr>`).join("")}</table></div>
      <a class="more" href="tables.html?l=${t.id}">جدول کامل ${esc(t.title)} ←</a>
    </section>`;

  /* today's match for this team, if any */
  try {
    const today = await getJSON("data/today.json?t=" + Date.now());
    const m = (today.matches || []).find(x => same(x.hostName, r.team) || same(x.guestName, r.team));
    if (m) {
      const sc = scorePair(m);
      document.getElementById("today-match").innerHTML = `<section class="sec"><h2>بازی امروز</h2>
        <a class="row" href="match.html?id=${encodeURIComponent(m.sportId)}" style="display:grid">
          <div class="st ${isLive(m) ? "live" : ""}">${esc(statusText(m))}</div>
          <div class="team home">${logo(m.hostLogo, m.hostName)}<span>${esc(m.hostName)}</span></div>
          <div class="score">${sc ? FA(sc[0] + " - " + sc[1]) : "-"}</div>
          <div class="team away">${logo(m.guestLogo, m.guestName)}<span>${esc(m.guestName)}</span></div>
          <div>${watchUrl(m) ? `<span class="watch">تماشا</span>` : ""}</div>
        </a></section>`;
    }
  } catch (e) {}
})();
