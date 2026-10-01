#/bin/sh

# Exit on error
set -e

docker build -t ffprobe-wasm .
docker create -ti --name ffprobe-wasm-container ffprobe-wasm
docker cp ffprobe-wasm-container:/build/dist .
docker rm -fv ffprobe-wasm-container

node scripts/replace.js
cp dist/* src
ls src
cp src/*.d.* dist

# Build browser/node workers
npm i
npm run build
