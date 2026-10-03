"""League tables from varzesh3 league pages (server-rendered HTML).

Standard library only (html.parser), so the workflow needs no extra packages.
"""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

LEAGUES = [
    (6, "لیگ برتر ایران"),
    (3, "لیگ برتر انگلیس"),
    (2, "لالیگا اسپانیا"),
    (4, "سری آ ایتالیا"),
    (1, "بوندسلیگا آلمان"),
    (5, "لیگ یک فرانسه"),
    (7, "اردیویسه هلند"),
]
PAGE = "https://www.varzesh3.com/football/league/{id}/"
FA2EN = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


class _Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self._row, self._cell, self._depth = [], None, None, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._depth += 1
            self.tables.append([])
        elif not self._depth:
            return
        elif tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = {"text": [], "imgs": [], "classes": []}
        elif self._cell is not None:
            if tag == "img":
                self._cell["imgs"].append(a.get("src") or a.get("data-src") or "")
                if a.get("alt"):
                    self._cell["classes"].append("alt:" + a["alt"])
            if a.get("class"):
                self._cell["classes"].append(a["class"])
            if a.get("title"):
                self._cell["classes"].append("title:" + a["title"])

    def handle_endtag(self, tag):
        if not self._depth:
            return
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._cell["text"] = re.sub(r"\s+", " ", " ".join(self._cell["text"])).strip()
            self._row.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.tables[-1].append(self._row)
            self._row = None
        elif tag == "table":
            self._depth -= 1

    def handle_data(self, data):
        if self._cell is not None:
            self._cell["text"].append(data)


def _num(s):
    s = str(s or "").translate(FA2EN).replace("−", "-").strip()
    m = re.search(r"-?\d+", s)
    return int(m.group()) if m else None


def _form(cell):
    letters = re.findall(r"\b([WDL])\b", cell["text"].upper())
    if letters:
        return letters[-5:]
    out = []
    for c in cell["classes"]:
        c = c.lower()
        if any(k in c for k in ("win", "برد")):
            out.append("W")
        elif any(k in c for k in ("draw", "مساوی", "تساوی")):
            out.append("D")
        elif any(k in c for k in ("lose", "loss", "باخت")):
            out.append("L")
    return out[-5:]


def parse(html):
    p = _Tables()
    p.feed(html)
    best = None
    for table in p.tables:
        if not table or not any("امتیاز" in c["text"] for c in table[0]):
            continue
        rows = []
        for r in table[1:]:
            if len(r) < 9:
                continue
            rank = _num(r[0]["text"])
            name = r[1]["text"]
            if rank is None or not name:
                continue
            gf = ga = None
            g = re.findall(r"\d+", r[6]["text"].translate(FA2EN))
            if len(g) == 2:
                gf, ga = int(g[0]), int(g[1])
            rows.append({
                "rank": rank, "team": name, "logo": next((i for i in r[1]["imgs"] if i), ""),
                "p": _num(r[2]["text"]), "w": _num(r[3]["text"]), "d": _num(r[4]["text"]),
                "l": _num(r[5]["text"]), "gf": gf, "ga": ga, "gd": _num(r[7]["text"]),
                "pts": _num(r[8]["text"]), "form": _form(r[9]) if len(r) > 9 else [],
            })
        if rows and (best is None or len(rows) > len(best)):
            best = rows
    m = re.search(r"آخرین به ?روز ?رسانی\s*:?\s*([^<\n]{4,40})", re.sub(r"<[^>]+>", "\n", html))
    return best or [], (m.group(1).strip() if m else "")


def build(get_html, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for lid, title in LEAGUES:
        html = get_html(PAGE.format(id=lid))
        if not html:
            continue
        try:
            rows, updated = parse(html)
        except Exception as exc:
            print(f"table {lid} parse failed: {exc}")
            rows, updated = [], ""
        if len(rows) < 6:
            print(f"table {lid}: no usable rows")
            # keep a sample so the page structure can be inspected from the deployed site
            (out / f"debug_{lid}.html").write_text(html[:300000], encoding="utf-8")
            continue
        (out / f"{lid}.json").write_text(json.dumps({"id": lid, "title": title, "updated": updated, "rows": rows},
                                                    ensure_ascii=False), encoding="utf-8")
        index.append({"id": lid, "title": title})
        print(f"table {lid} {title}: {len(rows)} teams")
    if index:
        (out / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
