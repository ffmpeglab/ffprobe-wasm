#include <vector>
#include <string>
#include <vector>
#include <inttypes.h>
#include <emscripten.h>
#include <emscripten/bind.h>

using namespace emscripten;

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/bprint.h>
#include <libavutil/imgutils.h>
};

const std::string c_avformat_version() {
    return AV_STRINGIFY(LIBAVFORMAT_VERSION);
}

const std::string c_avcodec_version() {
    return AV_STRINGIFY(LIBAVCODEC_VERSION);
}

const std::string c_avutil_version() {
    return AV_STRINGIFY(LIBAVUTIL_VERSION);
}

typedef struct Tag {
  std::string key;
  std::string value;
} Tag;

typedef struct Stream {
  int id;
  float start_time;
  float duration;
  int codec_type;
  std::string codec_name;
  std::string format;
  float bit_rate;
  std::string profile;
  int level;
  int width;
  int height;
  int channels;
  int sample_rate;
  int frame_size;
  std::vector<Tag> tags;
} Stream;

typedef struct Chapter {
  int id;
  std::string time_base;
  float start;
  float end;
  std::vector<Tag> tags;
} Chapter;

typedef struct Frame {
  int frame_number;
  char pict_type;
  int pts;
  int dts;
  int pos;
  int pkt_size;
} Frame;

typedef struct FileInfoResponse {
  std::string name;
  float bit_rate;
  float duration;
  std::string url;
  int nb_streams;
  int flags;
  std::vector<Stream> streams;
  int nb_chapters;
  std::vector<Chapter> chapters;
} FileInfoResponse;

typedef struct FramesResponse {
  std::vector<Frame> frames;
  int nb_frames;
  int gop_size;
  float duration;
  double time_base;
  double avg_frame_rate;
} FramesResponse;

FileInfoResponse get_file_info(std::string filename) {
    av_log_set_level(AV_LOG_QUIET); // No logging output for libav.

    FILE *file = fopen(filename.c_str(), "rb");
    if (!file) {
      printf("cannot open file\n");
    }
    fclose(file);

    AVFormatContext *pFormatContext = avformat_alloc_context();
    if (!pFormatContext) {
      printf("ERROR: could not allocate memory for Format Context\n");
    }

    // Open the file and read header.
    int ret;
    if ((ret = avformat_open_input(&pFormatContext, filename.c_str(), NULL, NULL)) < 0) {
        printf("ERROR: %s\n", av_err2str(ret));
    }

    // Get stream info from format.
    if (avformat_find_stream_info(pFormatContext, NULL) < 0) {
      printf("ERROR: could not get stream info\n");
    }

    // Initialize response struct with format data.
    // AVFormatContext::duration can be AV_NOPTS_VALUE for still images
    // (JPEG/PNG/BMP/static WebP). Casting that sentinel to float produces a
    // huge negative number, so normalize it to 0.
    FileInfoResponse r = {
      .name = pFormatContext->iformat->name,
      .bit_rate = (float)pFormatContext->bit_rate,
      .duration = pFormatContext->duration == AV_NOPTS_VALUE
          ? 0.0f
          : (float)pFormatContext->duration,
      .url = pFormatContext->url ? pFormatContext->url : "",
      .nb_streams = (int)pFormatContext->nb_streams,
      .flags = pFormatContext->flags,
      .nb_chapters = (int)pFormatContext->nb_chapters
    };

    // Loop through the streams.
    for (int i = 0; i < pFormatContext->nb_streams; i++) {
      AVCodecParameters *pLocalCodecParameters = pFormatContext->streams[i]->codecpar;

      // Convert codec_tag to a 4-char string. Empty for formats that don't
      // set a tag (image2, raw streams, some TS).
      uint32_t n = pLocalCodecParameters->codec_tag;
      char fourcc[5];
      for (int j = 0; j < 4; ++j) {
        fourcc[j] = (n >> (j * 8) & 0xFF);
      }
      fourcc[4] = 0x00; // NULL terminator.

      // av_get_pix_fmt_name returns NULL for AV_PIX_FMT_NONE (all audio
      // streams, and some video streams). Assigning NULL to std::string is
      // UB, so substitute an empty string.
      const char *pix_fmt_name =
          av_get_pix_fmt_name((AVPixelFormat)pLocalCodecParameters->format);

      // avcodec_profile_name returns NULL for FF_PROFILE_UNKNOWN (JPEG,
      // PNG, and many others). Same treatment.
      const char *profile_name =
          avcodec_profile_name(pLocalCodecParameters->codec_id,
                               pLocalCodecParameters->profile);

      // Stream timestamps are AV_NOPTS_VALUE for containers that don't
      // carry them (image2, raw streams). Normalize to 0.
      int64_t st = pFormatContext->streams[i]->start_time;
      int64_t du = pFormatContext->streams[i]->duration;

      Stream stream = {
        .id = (int)pFormatContext->streams[i]->id,
        .start_time = st == AV_NOPTS_VALUE ? 0.0f : (float)st,
        .duration = du == AV_NOPTS_VALUE ? 0.0f : (float)du,
        .codec_type = (int)pLocalCodecParameters->codec_type,
        .codec_name = std::string(fourcc),
        .format = pix_fmt_name ? std::string(pix_fmt_name) : std::string(),
        .bit_rate = (float)pLocalCodecParameters->bit_rate,
        .profile = profile_name ? std::string(profile_name) : std::string(),
        .level = (int)pLocalCodecParameters->level,
        .width = (int)pLocalCodecParameters->width,
        .height = (int)pLocalCodecParameters->height,
        .channels = (int)pLocalCodecParameters->channels,
        .sample_rate = (int)pLocalCodecParameters->sample_rate,
        .frame_size = (int)pLocalCodecParameters->frame_size,
      };

      // Add tags to stream.
      const AVDictionaryEntry *tag = NULL;
      while ((tag = av_dict_get(pFormatContext->streams[i]->metadata, "", tag, AV_DICT_IGNORE_SUFFIX))) {
        Tag t = {
          .key = tag->key,
          .value = tag->value,
        };
        stream.tags.push_back(t);
      }

      r.streams.push_back(stream);
      // NOTE: `fourcc` is a stack array; the original `free(fourcc)` here was
      // undefined behaviour. Removed.
    }

    // Loop through the chapters (if any).
    for (int i = 0; i < pFormatContext->nb_chapters; i++) {
      AVChapter *chapter = pFormatContext->chapters[i];

      // Format timebase string to buf.
      AVBPrint buf;
      av_bprint_init(&buf, 0, AV_BPRINT_SIZE_AUTOMATIC);
      av_bprintf(&buf, "%d/%d", chapter->time_base.num, chapter->time_base.den);

      Chapter c = {
        .id = (int)chapter->id,
        .time_base = std::string(buf.str),
        .start = (float)chapter->start,
        .end = (float)chapter->end,
      };

      // Add tags to chapter.
      const AVDictionaryEntry *tag = NULL;
      while ((tag = av_dict_get(chapter->metadata, "", tag, AV_DICT_IGNORE_SUFFIX))) {
        Tag t = {
          .key = tag->key,
          .value = tag->value,
        };
        c.tags.push_back(t);
      }

      r.chapters.push_back(c);
    }

    avformat_close_input(&pFormatContext);
    return r;
}

FramesResponse get_frames(std::string filename, int timestamp) {
    av_log_set_level(AV_LOG_QUIET); // No logging output for libav.

    FILE *file = fopen(filename.c_str(), "rb");
    if (!file) {
      printf("cannot open file\n");
    }
    fclose(file);

    AVFormatContext *pFormatContext = avformat_alloc_context();
    if (!pFormatContext) {
      printf("ERROR: could not allocate memory for Format Context\n");
    }

    // Open the file and read header.
    int ret;
    if ((ret = avformat_open_input(&pFormatContext, filename.c_str(), NULL, NULL)) < 0) {
        printf("ERROR: %s\n", av_err2str(ret));
    }

    // Get stream info from format.
    if (avformat_find_stream_info(pFormatContext, NULL) < 0) {
      printf("ERROR: could not get stream info\n");
    }

    // Pick the first video stream. Any stream-counting happens further down
    // once we know we actually have a video stream to work with.
    AVCodec *pCodec = NULL;
    AVCodecParameters *pCodecParameters = NULL;
    int video_stream_index = -1;

    for (int i = 0; i < pFormatContext->nb_streams; i++) {
      AVCodecParameters *pLocalCodecParameters = pFormatContext->streams[i]->codecpar;
      AVCodec *pLocalCodec = avcodec_find_decoder(pLocalCodecParameters->codec_id);
      if (pLocalCodecParameters->codec_type == AVMEDIA_TYPE_VIDEO
          && video_stream_index == -1) {
        video_stream_index = i;
        pCodec             = pLocalCodec;
        pCodecParameters   = pLocalCodecParameters;
      }
    }

    // No video stream — bail out cleanly instead of indexing streams[-1].
    if (video_stream_index == -1) {
      FramesResponse empty;
      avformat_close_input(&pFormatContext);
      return empty;
    }

    AVStream *video_stream = pFormatContext->streams[video_stream_index];
    AVRational stream_time_base = video_stream->time_base;
    AVRational avg_frame_rate   = video_stream->avg_frame_rate;

    // Still images report avg_frame_rate = 0/0. av_q2d() on that is NaN, and
    // NaN propagates through every arithmetic op downstream.
    bool has_fps = avg_frame_rate.num > 0 && avg_frame_rate.den > 0;

    // Heuristic: a still image has at most one frame and no fps. True for
    // JPEG/PNG/BMP/static WebP, false for videos and animated GIF/WebP.
    bool single_frame = video_stream->nb_frames <= 1 && !has_fps;

    FramesResponse r;
    r.time_base      = av_q2d(stream_time_base);
    r.avg_frame_rate = has_fps ? av_q2d(avg_frame_rate) : 0.0;
    r.nb_frames      = single_frame ? 1 : (int)video_stream->nb_frames;

    // Fallback frame count for containers that don't set nb_frames
    // (MKV/WebM). Only meaningful when fps and container duration are both
    // sane — otherwise we'd be multiplying garbage by garbage.
    if (r.nb_frames == 0
        && has_fps
        && pFormatContext->duration != AV_NOPTS_VALUE
        && pFormatContext->duration > 0) {
      double seconds = (double)pFormatContext->duration / 1000000.0;
      double fps = (double)avg_frame_rate.num / (double)avg_frame_rate.den;
      r.nb_frames = (int)(seconds * fps);
    }

    // Stream duration, falling back to container duration. Both are
    // AV_NOPTS_VALUE for still images.
    r.duration = video_stream->duration == AV_NOPTS_VALUE
        ? 0.0f
        : (float)video_stream->duration;
    if (r.duration == 0.0f
        && pFormatContext->duration != AV_NOPTS_VALUE
        && pFormatContext->duration > 0) {
      r.duration = (float)(pFormatContext->duration * r.time_base);
    }

    AVCodecContext *pCodecContext = avcodec_alloc_context3(pCodec);
    avcodec_parameters_to_context(pCodecContext, pCodecParameters);
    avcodec_open2(pCodecContext, pCodec, NULL);

    AVPacket *pPacket = av_packet_alloc();
    AVFrame *pFrame = av_frame_alloc();

    int max_packets_to_process = 1000;
    int frame_count = 0;
    int key_frames = 0;

    // Seek to the requested timestamp, but only for real videos. A still
    // image has a single packet at t=0; seeking to a nonzero timestamp just
    // makes libav skip it.
    int seek_target = single_frame ? 0 : timestamp;
    av_seek_frame(pFormatContext, video_stream_index, seek_target, AVSEEK_FLAG_ANY);

    // Read video frames.
    while (av_read_frame(pFormatContext, pPacket) >= 0) {
      if (pPacket->stream_index == video_stream_index) {
          int response = 0;
          response = avcodec_send_packet(pCodecContext, pPacket);

          if (response >= 0) {
            response = avcodec_receive_frame(pCodecContext, pFrame);
            if (response == AVERROR(EAGAIN) || response == AVERROR_EOF) {
              continue;
            }

            // Track keyframes so we paginate by each GOP.
            if (pFrame->key_frame == 1) key_frames++;

            // Break at the next keyframe found.
            if (key_frames > 1) break;

            Frame f = {
              .frame_number = frame_count,
              .pict_type = (char) av_get_picture_type_char(pFrame->pict_type),
              .pts = (int) pPacket->pts,
              .dts = (int) pPacket->dts,
              .pos = (int) pPacket->pos,
              .pkt_size = pFrame->pkt_size,
            };
            r.frames.push_back(f);

            if (--max_packets_to_process <= 0) break;
          }
        frame_count++;
      }
      av_packet_unref(pPacket);
    }

    // gop_size used to count packets processed; frame_count drifts from the
    // actual number of frames returned. Report the real count instead.
    r.gop_size = (int)r.frames.size();

    avformat_close_input(&pFormatContext);
    av_packet_free(&pPacket);
    av_frame_free(&pFrame);
    avcodec_free_context(&pCodecContext);

    return r;
}

EMSCRIPTEN_BINDINGS(constants) {
    function("avformat_version", &c_avformat_version);
    function("avcodec_version", &c_avcodec_version);
    function("avutil_version", &c_avutil_version);
}

EMSCRIPTEN_BINDINGS(structs) {
  emscripten::value_object<Tag>("Tag")
  .field("key", &Tag::key)
  .field("value", &Tag::value)
  ;
  register_vector<Tag>("Tag");

  emscripten::value_object<Stream>("Stream")
  .field("id", &Stream::id)
  .field("start_time", &Stream::start_time)
  .field("duration", &Stream::duration)
  .field("codec_type", &Stream::codec_type)
  .field("codec_name", &Stream::codec_name)
  .field("format", &Stream::format)
  .field("bit_rate", &Stream::bit_rate)
  .field("profile", &Stream::profile)
  .field("level", &Stream::level)
  .field("width", &Stream::width)
  .field("height", &Stream::height)
  .field("channels", &Stream::channels)
  .field("sample_rate", &Stream::sample_rate)
  .field("frame_size", &Stream::frame_size)
  .field("tags", &Stream::tags)
  ;
  register_vector<Stream>("Stream");

  emscripten::value_object<Chapter>("Chapter")
  .field("id", &Chapter::id)
  .field("time_base", &Chapter::time_base)
  .field("start", &Chapter::start)
  .field("end", &Chapter::end)
  .field("tags", &Chapter::tags)
  ;
  register_vector<Chapter>("Chapter");

  emscripten::value_object<Frame>("Frame")
  .field("frame_number", &Frame::frame_number)
  .field("pict_type", &Frame::pict_type)
  .field("pts", &Frame::pts)
  .field("dts", &Frame::dts)
  .field("pos", &Frame::pos)
  .field("pkt_size", &Frame::pkt_size);
  register_vector<Frame>("Frame");

  emscripten::value_object<FileInfoResponse>("FileInfoResponse")
  .field("name", &FileInfoResponse::name)
  .field("duration", &FileInfoResponse::duration)
  .field("bit_rate", &FileInfoResponse::bit_rate)
  .field("url", &FileInfoResponse::url)
  .field("nb_streams", &FileInfoResponse::nb_streams)
  .field("flags", &FileInfoResponse::flags)
  .field("streams", &FileInfoResponse::streams)
  .field("nb_chapters", &FileInfoResponse::nb_chapters)
  .field("chapters", &FileInfoResponse::chapters)
  ;
  function("get_file_info", &get_file_info);

  emscripten::value_object<FramesResponse>("FramesResponse")
  .field("frames", &FramesResponse::frames)
  .field("nb_frames", &FramesResponse::nb_frames)
  .field("gop_size", &FramesResponse::gop_size)
  .field("duration", &FramesResponse::duration)
  .field("time_base", &FramesResponse::time_base)
  .field("avg_frame_rate", &FramesResponse::avg_frame_rate)
  ;
  function("get_frames", &get_frames);
}