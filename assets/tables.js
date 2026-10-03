/* نبض ورزش: league tables */
/* Zones per league: [continental top N, second-tier spots after that, relegation bottom N] */
const ZONES = {6: [2, 0, 2], 3: [4, 1, 3], 2: [4, 2, 3], 4: [4, 2, 3], 1: [4, 2, 2], 5: [3, 2, 2], 7: [2, 2, 2]};
const FORM = {W: ["ب", "w", "برد"], D: ["م", "d", "مساوی"], L: ["ش", "l", "باخت"]};

function zoneClass(lid, rank, total) {
  const z = ZONES[lid] || [0, 0, 0];
  if (rank <= z[0]) return "z-cl";
  if (rank <= z[0] + z[1]) return "z-el";
  if (rank > total - z[2]) return "z-rel";
  return "";
}

function formDots(form) {
  return (form || []).map(f => {
    const x = FORM[f];
    return x ? `<i class="fd ${x[1]}" title="${x[2]}">${x[0]}</i>` : "";
  }).join("");
}

function teamHref(lid, name) { return `team.html?l=${lid}&t=${encodeURIComponent(name)}`; }

function renderTable(t) {
  const rows = t.rows || [];
  const total = rows.length;
  const body = rows.map(r => {
    const gd = r.gd == null ? "" : (r.gd > 0 ? "+" + r.gd : String(r.gd));
    return `<tr class="${zoneClass(t.id, r.rank, total)}">
      <td class="rk">${FA(r.rank)}</td>
      <td class="tm"><a href="${teamHref(t.id, r.team)}">${logo(r.logo, r.team)}<span>${esc(r.team)}</span></a></td>
      <td>${FA(r.p)}</td><td class="hide-s">${FA(r.w)}</td><td class="hide-s">${FA(r.d)}</td><td class="hide-s">${FA(r.l)}</td>
      <td class="hide-s ltr">${r.gf == null ? "" : FA(r.gf + "-" + r.ga)}</td>
      <td class="ltr ${r.gd > 0 ? "pos" : r.gd < 0 ? "neg" : ""}">${FA(gd)}</td>
      <td class="pts">${FA(r.pts)}</td>
      <td><span class="form">${formDots(r.form)}</span></td>
    </tr>`;
  }).join("");
  const z = ZONES[t.id] || [0, 0, 0];
  const legend = [
    z[0] ? `<span><i class="lg z-cl"></i>${t.id === 6 ? "سهمیه آسیا" : "لیگ قهرمانان"}</span>` : "",
    z[1] ? `<span><i class="lg z-el"></i>لیگ اروپا</span>` : "",
    z[2] ? `<span><i class="lg z-rel"></i>سقوط</span>` : "",
  ].join("");
  return `<section class="league tbl">
    <div class="league-h">${esc(t.title)}<span class="sp">${t.updated ? "به‌روزرسانی: " + esc(FA(t.updated)) : ""}</span></div>
    <div class="tscroll"><table>
      <thead><tr><th>#</th><th class="tm">تیم</th><th>بازی</th><th class="hide-s">برد</th><th class="hide-s">مساوی</th><th class="hide-s">باخت</th><th class="hide-s">گل</th><th>تفاضل</th><th>امتیاز</th><th>۵ بازی اخیر</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <div class="legend">${legend}</div>
  </section>`;
}

async function showLeague(id) {
  const box = document.getElementById("table");
  document.querySelectorAll("#leagues .chip").forEach(c => c.classList.toggle("active", c.dataset.id === String(id)));
  try {
    const t = await getJSON(`data/tables/${id}.json?t=${Date.now()}`);
    box.innerHTML = renderTable(t);
    document.title = `جدول ${t.title} | نبض ورزش`;
    history.replaceState(null, "", `?l=${id}`);
  } catch (e) {
    box.innerHTML = `<div class="empty">جدول این لیگ فعلاً در دسترس نیست.</div>`;
  }
}

(async function init() {
  const nav = document.getElementById("leagues");
  let idx = [];
  try { idx = await getJSON("data/tables/index.json?t=" + Date.now()); } catch (e) {}
  if (!idx.length) {
    document.getElementById("table").innerHTML = `<div class="empty">جدول‌ها در حال آماده‌سازی است، چند دقیقه دیگر سر بزنید.</div>`;
    return;
  }
  nav.innerHTML = idx.map(l => `<button class="chip" data-id="${l.id}">${esc(l.title)}</button>`).join("");
  nav.addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) showLeague(b.dataset.id); });
  const want = new URLSearchParams(location.search).get("l");
  showLeague(idx.some(l => String(l.id) === want) ? want : idx[0].id);
})();
