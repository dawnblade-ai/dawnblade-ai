#!/bin/sh
# THE PAGE, DRIVABLE AT PHONE DIMENSIONS, WITH NO NETWORK AT RUN TIME (v4.88).
#
# Builds a scratch copy of the REAL page — index.html and engine/ from the
# working tree, untouched except for four one-line substitutions — and serves
# it on 127.0.0.1:8765. CLAUDE.md, "AND THE PAGE CAN BE DRIVEN AT PHONE
# DIMENSIONS", is the recipe this script writes down.
#
#   sh tools/phone/serve.sh <scratch-dir>          first time: installs + fetches
#   sh tools/phone/serve.sh <scratch-dir> refresh  after an edit: recopy, no fetch
#
# It is NOT part of `npm test` and never will be: the suite stays green on a
# fresh clone with no `npm install` (v3.00), and this wants React, Babel,
# Playwright and a 23MB database download. Everything it installs goes into
# the scratch directory — never into the repo.
set -e
S=${1:?usage: sh tools/phone/serve.sh <scratch-dir> [refresh]}
R=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$S/serve/vendor"
if [ "$2" != "refresh" ]; then
  npm install --no-save --prefix "$S" react@18.2.0 react-dom@18.2.0 @babel/standalone playwright >/dev/null
  cp "$S/node_modules/react/umd/react.production.min.js"         "$S/serve/vendor/react.js"
  cp "$S/node_modules/react-dom/umd/react-dom.production.min.js" "$S/serve/vendor/react-dom.js"
  cp "$S/node_modules/@babel/standalone/babel.min.js"            "$S/serve/vendor/babel.js"
  DB=$(sed -n 's/^window.DBSRC = "\(.*\)";/\1/p' "$R/index.html")
  curl -sS -o "$S/serve/card.json" "$DB"
fi
rm -rf "$S/serve/engine" && cp -r "$R/engine" "$S/serve/engine"
sed -e 's|https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js|vendor/react.js|' \
    -e 's|https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js|vendor/react-dom.js|' \
    -e 's|https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js|vendor/babel.js|' \
    -e 's|^window.DBSRC = ".*";|window.DBSRC = "card.json";|' \
    "$R/index.html" > "$S/serve/index.html"
# FOUR substitutions or the page is not the page: a missed one loads from the
# network and a sandbox reports that as a blank screen, not as an error.
[ "$(grep -c 'vendor/\|DBSRC = "card.json"' "$S/serve/index.html")" = 4 ] || { echo "a substitution missed — the CDN or DBSRC line moved"; exit 1; }
if ! curl -s -o /dev/null http://127.0.0.1:8765/index.html; then
  (cd "$S/serve" && nohup python3 -m http.server 8765 --bind 127.0.0.1 >"$S/http.log" 2>&1 &)
  sleep 1
fi
echo "serving $S/serve on http://127.0.0.1:8765/index.html"
