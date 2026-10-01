#/bin/sh

# Exit on error
set -e

docker build -t ffprobe-wasm .
docker-compose run ffprobe-wasm make

node scripts/replace.js
cp dist/* src
ls src
# Build browser/node workers
npm i
npm run build

cp src/*.d.* dist

