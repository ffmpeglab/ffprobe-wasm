#/bin/sh

# Exit on error
set -e

mkdir -p dist
docker build -t ffprobe-wasm .
docker create -ti --name ffprobe-wasm-container ffprobe-wasm
docker cp ffprobe-wasm-container:/build/dist/ src
docker rm -fv ffprobe-wasm-container

node scripts/replace.js
cp src/*.d.* dist

# Build browser/node workers
npm i
npm run build

# Remove unnecessary files
rm dist/browser-vite.* dist/ffprobe-wasm.d.mts dist/ffprobe-wasm.mjs dist/worker-browser.*
