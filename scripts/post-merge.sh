#!/bin/bash
set -e

npm install

if [ -f package.json ] && node -e "process.exit(((require('./package.json').scripts||{})['db:push'])?0:1)"; then
  npm run db:push --silent || npm run db:push --silent -- --force || true
else
  echo "post-merge: no db:push script defined — skipping (tables are initialized by the app on boot)."
fi
