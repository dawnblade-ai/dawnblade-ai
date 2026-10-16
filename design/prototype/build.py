#!/usr/bin/env python3
"""Build the Stage prototype page: one self-contained HTML file.

    python3 design/prototype/build.py <game.json> <work-dir> <out.html>

<game.json> comes from record.js. Card art is fetched from the public CDN into
<work-dir>, shrunk to 300 px wide and embedded as data: URIs, because the page
must stand alone (an artifact host blocks external images). Art is never
committed to the repo. Needs curl and ImageMagick's convert.
"""
import base64, json, os, subprocess, sys

CDN = "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/"
HERE = os.path.dirname(os.path.abspath(__file__))

def main(game_path, work, out):
    os.makedirs(work, exist_ok=True)
    g = json.load(open(game_path))
    urls = {}
    for c in list(g["cards"].values()) + g["heroes"]:
        u = c.get("img")
        if u:
            urls[os.path.basename(u)] = u if u.startswith("http") else CDN + u
    art = {}
    for name, url in sorted(urls.items()):
        src, small = os.path.join(work, "src_" + name), os.path.join(work, "r_" + name)
        if not os.path.exists(src):
            subprocess.run(["curl", "-sf", "-o", src, url], check=True)
        if not os.path.exists(small):
            subprocess.run(["convert", src, "-resize", "300x", "-quality", "70", small], check=True)
        art[name] = "data:image/webp;base64," + base64.b64encode(open(small, "rb").read()).decode()
    tpl = open(os.path.join(HERE, "stage.tpl.html")).read()
    page = (tpl.replace("/*__DATA__*/null", json.dumps(g, separators=(",", ":")))
               .replace("/*__ART__*/null", json.dumps(art, separators=(",", ":"))))
    assert "/*__" not in page, "a placeholder was not filled"
    open(out, "w").write(page)
    print("wrote", out, len(page), "bytes,", len(art), "images")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
