FROM emscripten/emsdk:6.0.9 AS build

# LLVM tools live in /emsdk/upstream/bin and are not on PATH
ENV PATH="/emsdk/upstream/bin:${PATH}"

ARG FFMPEG_VERSION=4.3.1
ARG ZLIB_VERSION=1.3.1
ARG PREFIX=/opt/ffmpeg
ARG MAKEFLAGS="-j4"

RUN apt-get update && apt-get install -y autoconf libtool build-essential

# zlib — FFmpeg's PNG decoder needs inflate()/crc32().
RUN cd /tmp && \
  wget https://zlib.net/fossils/zlib-${ZLIB_VERSION}.tar.gz && \
  tar xzf zlib-${ZLIB_VERSION}.tar.gz

RUN cd /tmp/zlib-${ZLIB_VERSION} && \
  emconfigure ./configure \
  --prefix=${PREFIX} \
  --static

RUN cd /tmp/zlib-${ZLIB_VERSION} && \
  emmake make -j4 && \
  emmake make install

# Get ffmpeg source.
RUN cd /tmp && \
  wget http://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.gz && \
  tar zxf ffmpeg-${FFMPEG_VERSION}.tar.gz && rm ffmpeg-${FFMPEG_VERSION}.tar.gz

ARG CFLAGS="-O3 -I${PREFIX}/include"
ARG LDFLAGS="-L${PREFIX}/lib -s INITIAL_MEMORY=33554432"

RUN cd /tmp/ffmpeg-${FFMPEG_VERSION} && \
  emconfigure ./configure \
  --prefix=${PREFIX} \
  --target-os=none \
  --arch=x86_32 \
  --enable-cross-compile \
  --disable-debug \
  --disable-x86asm \
  --disable-inline-asm \
  --disable-stripping \
  --disable-programs \
  --disable-doc \
  --disable-all \
  --disable-network \
  --disable-everything \
  --enable-avcodec \
  --enable-avformat \
  --enable-avutil \
  --enable-swscale \
  --enable-swresample \
  --enable-protocol=file \
  --enable-zlib \
  --enable-decoder=h264,aac,pcm_s16le,mp3,mjpeg,png,gif,bmp,tiff,webp \
  --enable-demuxer=mov,matroska,mp3,image2 \
  --enable-parser=h264,aac,mpegaudio,png \
  --extra-cflags="$CFLAGS" \
  --extra-cxxflags="$CFLAGS" \
  --extra-ldflags="$LDFLAGS" \
  --nm="llvm-nm -g" \
  --ar=emar \
  --as=llvm-as \
  --ranlib=llvm-ranlib \
  --cc=emcc \
  --cxx=em++

RUN cd /tmp/ffmpeg-${FFMPEG_VERSION} && \
  emmake make -j4 && \
  emmake make install

COPY ./src/ffprobe-wasm-wrapper.cpp /build/src/ffprobe-wasm-wrapper.cpp
COPY ./Makefile /build/Makefile

WORKDIR /build

RUN make