#/bin/sh

# Exit on error
set -e
rm -rf ./dist
docker build -t ffprobe-wasm .
docker create -ti --name ffprobe-wasm-container ffprobe-wasm
docker cp ffprobe-wasm-container:/build/dist .
docker rm -fv ffprobe-wasm-container

node scripts/replace.js
cp dist/* src
ls src
# Build browser/node workers
npm i
npm run build
cp src/*.d.* dist