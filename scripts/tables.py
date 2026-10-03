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


class _Tokens(HTMLParser):
    """Flat stream of text chunks and image sources, independent of the markup."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items, self._skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        elif tag == "img":
            a = dict(attrs)
            src = a.get("src") or a.get("data-src") or ""
            if src:
                self.items.append(("img", src))

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        t = re.sub(r"\s+", " ", data).strip()
        if t and not self._skip:
            self.items.append(("txt", t))


_INT = re.compile(r"^[-+]?\d+$")
_GOALS = re.compile(r"^(\d+)\s*-\s*(\d+)$")


def parse_tokens(html):
    """Fallback: walk text chunks looking for rank, team, p, w, d, l, 'gf-ga', gd, pts, form."""
    tk = _Tokens()
    tk.feed(html)
    items = tk.items
    texts = [(i, v.translate(FA2EN).replace("−", "-")) for i, (k, v) in enumerate(items) if k == "txt"]
    merged = []
    for t in texts:  # "13", "-", "5" -> "13-5"
        if len(merged) >= 2 and merged[-1][1] == "-" and re.fullmatch(r"\d+", merged[-2][1]) and re.fullmatch(r"\d+", t[1]):
            merged[-2:] = [(merged[-2][0], merged[-2][1] + "-" + t[1])]
        else:
            merged.append(t)
    texts = merged
    rows, j, want = [], 0, 1
    while j < len(texts) - 8:
        vals = [v for _, v in texts[j:j + 9]]
        if (vals[0] == str(want) and not _INT.match(vals[1]) and all(_INT.match(x) for x in vals[2:6])
                and _GOALS.match(vals[6]) and _INT.match(vals[7]) and _INT.match(vals[8])):
            start, end = texts[j][0], texts[j + 1][0]
            logo = next((items[k][1] for k in range(start, end + 1) if items[k][0] == "img"), "")
            g = _GOALS.match(vals[6])
            form, k = [], j + 9
            while k < len(texts) and len(form) < 5:
                letters = re.findall(r"\b([WDL])\b", texts[k][1].upper())
                if not letters or not re.fullmatch(r"[WDLwdl\s]+", texts[k][1]):
                    break
                form += letters
                k += 1
            rows.append({"rank": want, "team": vals[1], "logo": logo, "p": int(vals[2]), "w": int(vals[3]),
                         "d": int(vals[4]), "l": int(vals[5]), "gf": int(g.group(1)), "ga": int(g.group(2)),
                         "gd": int(vals[7]), "pts": int(vals[8]), "form": form[:5]})
            want += 1
            j = k
            continue
        j += 1
    return rows


def parse(html):
    rows, updated = _parse_table(html)
    if len(rows) < 6:
        alt = parse_tokens(html)
        if len(alt) > len(rows):
            rows = alt
    return rows, updated


def _parse_table(html):
    p = _Tables()
    p.feed(html)
    best = None
    for table in p.tables:
        head = next((i for i, row in enumerate(table) if any("امتیاز" in c["text"] for c in row)), None)
        if head is None:
            continue
        rows = []
        for r in table[head + 1:]:
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
            i = html.find("امتیاز")
            (out / f"debug_{lid}.txt").write_text(html[max(0, i - 3000):i + 6000], encoding="utf-8")
            continue
        (out / f"{lid}.json").write_text(json.dumps({"id": lid, "title": title, "updated": updated, "rows": rows},
                                                    ensure_ascii=False), encoding="utf-8")
        index.append({"id": lid, "title": title})
        print(f"table {lid} {title}: {len(rows)} teams")
    if index:
        (out / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
