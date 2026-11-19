#!/usr/bin/env node
/* ============================================================
   tools/supabase-deploy.js — ONE COMMAND: CUT, DEPLOY AND STAMP THE `table` FUNCTION

     node tools/supabase-deploy.js --dry-run   cut dist/ and print the files and the request, send nothing
     node tools/supabase-deploy.js             cut dist/, deploy through the Management API, then --stamp
     node tools/supabase-deploy.js --no-stamp  deploy without writing server/supabase/DEPLOYED.json

   It is server/supabase/DEPLOY.md "Path B" as code (written 2026-11-19 so a release thread
   stops re-deriving the multipart call): `POST /v1/projects/<ref>/functions/deploy?slug=table`,
   a `metadata` part ({"entrypoint_path":"index.ts","verify_jwt":false,"name":"table"}) and one
   `file` part per file of the FOLDER variant, named by its path relative to the function.
   The ACCESS TOKEN is never here: the environment's proxy injects it for api.supabase.com.
   curl (not Node's fetch) because curl follows HTTPS_PROXY and the proxy's CA bundle.
   After it: commit DEPLOYED.json, then `node tools/supabase-bundle.js --check` and
   `node tools/livecheck.js`.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");

const ROOT = path.join(__dirname, "..");
const REF = "fokcpzplomjsraquaaid";
const FN = "table";
const BUNDLE = path.join(__dirname, "supabase-bundle.js");
const FNDIR = path.join(ROOT, "server", "supabase", "dist", "supabase", "functions", FN);

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

const node = args => execFileSync(process.execPath, [BUNDLE].concat(args), {stdio: "inherit"});
node([]);   /* cut dist/ from this tree */

const files = [];
(function walk(d){
  for(const n of fs.readdirSync(d).sort()){
    const p = path.join(d, n);
    if(fs.statSync(p).isDirectory()) walk(p); else files.push(path.relative(FNDIR, p).split(path.sep).join("/"));
  }
})(FNDIR);
if(files.indexOf("index.ts") < 0){ console.error("no index.ts under " + FNDIR); process.exit(1); }

const meta = JSON.stringify({entrypoint_path: "index.ts", verify_jwt: false, name: FN});
const url = "https://api.supabase.com/v1/projects/" + REF + "/functions/deploy?slug=" + FN;
const args = ["-sS", "-X", "POST", url, "-w", "\n%{http_code}",
  "-F", "metadata=" + meta + ";type=application/json"]
  .concat(...files.map(f => ["-F", "file=@" + path.join(FNDIR, f) + ";filename=" + f]));

console.log("\n" + files.length + " files -> " + url);
if(DRY){ console.log("dry run: nothing sent"); process.exit(0); }

const out = execFileSync("curl", args, {encoding: "utf8", maxBuffer: 1 << 24});
const code = +out.trim().split("\n").pop();
const body = out.trim().split("\n").slice(0, -1).join("\n");
let j = null; try { j = JSON.parse(body); } catch(e){}
console.log("HTTP " + code + (j ? "  status " + j.status + "  version " + j.version + "  verify_jwt " + j.verify_jwt : "\n" + body.slice(0, 600)));
if(code < 200 || code >= 300 || !j || j.status !== "ACTIVE"){ console.error("deploy FAILED: nothing stamped"); process.exit(1); }
if(!argv.includes("--no-stamp")){ node(["--stamp"]); console.log("stamped: commit server/supabase/DEPLOYED.json"); }
