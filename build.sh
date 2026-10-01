#/bin/sh

# Exit on error
set -e

docker build -t ffprobe-wasm .
docker create -ti --name ffprobe-wasm-container ffprobe-wasm
docker cp ffprobe-wasm-container:/build/dist .
docker rm -fv ffprobe-wasm-container

cp dist/* src/
ls src
node scripts/replace.js
cp src/*.d.* dist

# Build browser/node workers
npm i
npm run build
