import subprocess, shutil, re
root = "/home/user/dawnblade-ai/.claude/worktrees/agent-af076a8a208569be0/"
J = root + "engine/judge.js"; S = root + "engine/sparring.js"
subs = [
 ("paid instants tried", J, "      && !(+x.c.cost > 0)\n", "\n"),
 ("fits ignored", J, "if(x.uid === except || (fits && !fits(x.uid, except))) return m;", "if(x.uid === except) return m;"),
 ("gain threshold 0", J, "if(gain >= 1 && (!top", "if(gain >= 0 && (!top"),
 ("non-instants tried", J, "TY.isInstant(x.c) && !TY.isAttack(x.c) && !TY.isAR(x.c) && !TY.isDR(x.c)\n      && !(+x.c.cost > 0)", "!TY.isAttack(x.c) && !TY.isAR(x.c) && !TY.isDR(x.c)\n      && !(+x.c.cost > 0)"),
 ("reader writes", J, "  const sd = at(g, seat);\n  const best = (st, except)", "  const sd = at(g, seat); (sd.hand || []).push(null);\n  const best = (st, except)"),
 ("search seat takes the branch", S, "if(instFirstOn(g, seat) && !IN_SEARCH && !laGated(g, seat, o)){", "if(instFirstOn(g, seat)){"),
 ("gate always on", S, "if(!v || v === \"none\" || !fixOn(g, seat)) return false;", "if(!fixOn(g, seat)) return false; if(!v) return true;"),
 ("hero list ignored", S, "  return !!(sd && v.split(\",\").indexOf(sd.heroKey) >= 0);\n};\n/* A card or ability that would land", "  return true;\n};\n/* A card or ability that would land"),
]
for name, path, old, new in subs:
    src = open(path).read()
    if src.count(old) != 1:
        print("MISS (anchor count %d): %s" % (src.count(old), name)); continue
    shutil.copy(path, "/tmp/claude-0/bak.js")
    open(path, "w").write(src.replace(old, new))
    r = subprocess.run(["node", "--test", root + "test/instantfirst.test.js"], capture_output=True, text=True, cwd=root)
    m = re.findall(r"^# fail (\d+)", r.stdout, re.M)
    bad = re.findall(r"^not ok \d+ - (.*)$", r.stdout, re.M)
    print("%-32s fail=%s  bit: %s" % (name, m[0] if m else "?", "; ".join(b[:50] for b in bad[:3])))
    shutil.copy("/tmp/claude-0/bak.js", path)
