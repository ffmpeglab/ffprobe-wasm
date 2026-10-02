dist/ffprobe-wasm.js: src/ffprobe-wasm-wrapper.cpp
	mkdir -p dist && \
	emcc --bind \
	  -O2 \
	  -L/opt/ffmpeg/lib \
	  -I/opt/ffmpeg/include/ \
	  -s EXPORTED_RUNTIME_METHODS="[FS, cwrap, ccall, getValue, setValue, writeAsciiToMemory]" \
	  -s INITIAL_MEMORY=268435456 \
	  -s ALLOW_TABLE_GROWTH=1 \
	  -lworkerfs.js \
	  -lavcodec -lavformat -lavfilter -lavdevice -lswresample -lswscale -lavutil -lm -lx264 \
	  -o dist/ffprobe-wasm.js \
	  src/ffprobe-wasm-wrapper.cpp