#include <string>
#include <sstream>
#include <cstdint>
#include <vector>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

using namespace emscripten;

extern "C"
{
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/display.h>
#include <libavutil/pixdesc.h>
#include <libavcodec/codec_id.h>
#include "video_codec_string.h"
#include "audio_codec_string.h"
};

typedef struct Tag
{
    std::string key;
    std::string value;
} Tag;

typedef struct WebAVStream
{
    int index;
    int id;
    /** Codec Info from codecpar */
    int codec_type;
    std::string codec_type_string;
    std::string codec_name;
    std::string codec_string;
    std::string profile;
    int level;
    std::string bit_rate;
    int extradata_size;
    std::vector<uint8_t> extradata;
    val get_extradata() const{
        return val(typed_memory_view(extradata.size(), extradata.data()));
    }
    /** Video-specific Info */
    int width;
    int height;
    std::string pix_fmt;
    std::string color_primaries;
    std::string color_transfer;
    std::string color_space;
    std::string color_range;
    std::string r_frame_rate;
    std::string avg_frame_rate;
    std::string sample_aspect_ratio;
    std::string display_aspect_ratio;
    double rotation;
    /** Audio-specific Info */
    int channels;
    int sample_rate;
    std::string sample_fmt;
    /** Other Common Info */
    double start_time;
    double duration;
    std::string nb_frames;
    std::vector<Tag> tags;
    val get_tags() const {
        val tags = val::object();
        for (const Tag &tag : this->tags) {
            tags.set(tag.key, tag.value);
        }
        return tags;
    }
} WebAVStream;

typedef struct WebAVPacket
{
    int keyframe;
    double timestamp;
    double duration;
    int size;
    std::vector<uint8_t> data;
    val get_data() const{
        return val(typed_memory_view(data.size(), data.data()));
    }
} WebAVPacket;

typedef struct WebAVStreamList
{
    int size;
    std::vector<WebAVStream> streams;
} WebAVStreamList;

typedef struct WebAVPacketList
{
    int size;
    std::vector<WebAVPacket> packets;
} WebAVPacketList;

typedef struct WebMediaInfo
{
    std::string format_name;
    double start_time;
    double duration;
    std::string bit_rate;
    int nb_streams;
    int nb_chapters;
    int flags;
    std::vector<WebAVStream> streams;
} WebMediaInfo;

double get_rotation(AVStream *stream) {
   for (int i = 0; i < stream->codecpar->nb_coded_side_data; i++) {
        AVPacketSideData *sd = &stream->codecpar->coded_side_data[i];

        if (sd->type == AV_PKT_DATA_DISPLAYMATRIX && sd->size >= 9*4) {
            double rotation = av_display_rotation_get((int32_t *)sd->data);
            if (std::isnan(rotation))
                rotation = 0;
            
            return rotation;
        }
    }

    return 0;
}

std::string gen_rational_str(AVRational rational, char sep)
{
    std::ostringstream oss;
    oss << rational.num << sep << rational.den;
    return oss.str();
}

inline std::string safe_str(const char* str) {
    return str ? str : "";
}

void gen_web_packet(WebAVPacket &web_packet, AVPacket *packet, AVStream *stream)
{
    double packet_timestamp = 0;

    if (packet->pts != AV_NOPTS_VALUE) {
        packet_timestamp = packet->pts * av_q2d(stream->time_base);
    }
    else if (packet->dts != AV_NOPTS_VALUE) {
        // Some formats such as AVI do not have PTS and use DTS instead
        packet_timestamp = packet->dts * av_q2d(stream->time_base);
    }

    web_packet.keyframe = packet->flags & AV_PKT_FLAG_KEY;
    web_packet.timestamp = packet_timestamp;
    web_packet.duration = packet->duration * av_q2d(stream->time_base);
    web_packet.size = packet->size;
    if (packet->size > 0)
    {
        web_packet.data = std::vector<uint8_t>(packet->data, packet->data + packet->size);
    }
    else
    {
        web_packet.data = std::vector<uint8_t>();
    }
}

void gen_web_stream(WebAVStream &web_stream, AVStream *stream, AVFormatContext *fmt_ctx)
{
    web_stream.index = stream->index;
    web_stream.id = stream->id;

    // Initialize codec info
    AVCodecParameters *par = stream->codecpar;
    web_stream.codec_type = (int)par->codec_type;
    web_stream.codec_type_string = safe_str(av_get_media_type_string(par->codec_type));
    
    const AVCodecDescriptor* desc = avcodec_descriptor_get(par->codec_id);
    web_stream.codec_name = safe_str(desc ? desc->name : "");

    // Initialize video-specific values
    web_stream.width = 0;
    web_stream.height = 0;
    web_stream.color_primaries = "";
    web_stream.color_transfer = "";
    web_stream.color_space = "";
    web_stream.color_range = "";
    web_stream.pix_fmt = "";
    web_stream.r_frame_rate = "0/0";
    web_stream.avg_frame_rate = "0/0";
    web_stream.rotation = 0;
    web_stream.sample_aspect_ratio = "N/A";
    web_stream.display_aspect_ratio = "N/A";
    // Initialize audio-specific values
    web_stream.channels = 0;
    web_stream.sample_rate = 0;
    web_stream.sample_fmt = "";

    char codec_string[40];

    if (par->codec_type == AVMEDIA_TYPE_VIDEO)
    {
        // Video-specific properties
        web_stream.width = par->width;
        web_stream.height = par->height;
        web_stream.color_primaries = safe_str(av_color_primaries_name(par->color_primaries));
        web_stream.color_transfer = safe_str(av_color_transfer_name(par->color_trc));
        web_stream.color_space = safe_str(av_color_space_name(par->color_space));
        web_stream.color_range = safe_str(av_color_range_name(par->color_range));
        web_stream.pix_fmt = safe_str(av_get_pix_fmt_name((AVPixelFormat)par->format));
        web_stream.r_frame_rate = gen_rational_str(stream->r_frame_rate, '/');
        web_stream.avg_frame_rate = gen_rational_str(stream->avg_frame_rate, '/');
        web_stream.rotation = get_rotation(stream);
        
        AVRational sar = av_guess_sample_aspect_ratio(fmt_ctx, stream, NULL);
        if (sar.num) {
            AVRational dar;
            av_reduce(&dar.num, &dar.den, par->width * sar.num, par->height * sar.den, 1024 * 1024);
            web_stream.sample_aspect_ratio = gen_rational_str(sar, ':');
            web_stream.display_aspect_ratio = gen_rational_str(dar, ':');
        }
        
        set_video_codec_string(codec_string, sizeof(codec_string), par, &stream->avg_frame_rate);
    }
    else if (par->codec_type == AVMEDIA_TYPE_AUDIO)
    {
        // Audio-specific properties
        web_stream.channels = par->ch_layout.nb_channels;
        web_stream.sample_rate = par->sample_rate;
        web_stream.sample_fmt = safe_str(av_get_sample_fmt_name((AVSampleFormat)par->format));
        set_audio_codec_string(codec_string, sizeof(codec_string), par);
    }
    else
    {
        strcpy(codec_string, "undf");
    }

    // Common properties for all types
    web_stream.codec_string = safe_str(codec_string);
    web_stream.profile = safe_str(avcodec_profile_name(par->codec_id, par->profile));
    web_stream.level = par->level;
    web_stream.bit_rate = std::to_string(par->bit_rate);
    
    web_stream.extradata_size = par->extradata_size;
    if (par->extradata_size > 0)
    {
        web_stream.extradata = std::vector<uint8_t>(par->extradata, par->extradata + par->extradata_size);
    }
    else
    {
        web_stream.extradata = std::vector<uint8_t>();
    }

    web_stream.start_time = stream->start_time * av_q2d(stream->time_base);
    web_stream.duration = stream->duration > 0 ? stream->duration * av_q2d(stream->time_base) : fmt_ctx->duration * av_q2d(AV_TIME_BASE_Q); // TODO: some file type can not get stream duration

    int64_t nb_frames = stream->nb_frames;

    // vp8 codec does not have nb_frames
    if (nb_frames == 0)
    {
        nb_frames = (fmt_ctx->duration * (double)stream->avg_frame_rate.num) / ((double)stream->avg_frame_rate.den * AV_TIME_BASE);
    }
    web_stream.nb_frames = std::to_string(nb_frames);

    AVDictionaryEntry *tag = NULL;
    while ((tag = av_dict_get(stream->metadata, "", tag, AV_DICT_IGNORE_SUFFIX)))
    {
        Tag t = {
            .key = safe_str(tag->key),
            .value = safe_str(tag->value)
        };
        web_stream.tags.push_back(t);
    }
}

WebAVStream get_av_stream(std::string filename, int type, int wanted_stream_nb)
{
    AVFormatContext *fmt_ctx = NULL;
    int ret;

    if ((ret = avformat_open_input(&fmt_ctx, filename.c_str(), NULL, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot open input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot open input file");
    }

    if ((ret = avformat_find_stream_info(fmt_ctx, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find stream information\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find stream information");
    }

    int stream_index = av_find_best_stream(fmt_ctx, (AVMediaType)type, wanted_stream_nb, -1, NULL, 0);

    if (stream_index < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find wanted stream in the input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find wanted stream in the input file");
    }

    AVStream *stream = fmt_ctx->streams[stream_index];
    WebAVStream web_stream;

    gen_web_stream(web_stream, stream, fmt_ctx);

    avformat_close_input(&fmt_ctx);

    return web_stream;
}

WebAVStreamList get_av_streams(std::string filename)
{
    AVFormatContext *fmt_ctx = NULL;
    int ret;

    if ((ret = avformat_open_input(&fmt_ctx, filename.c_str(), NULL, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot open input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot open input file");
    }

    if ((ret = avformat_find_stream_info(fmt_ctx, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find stream information\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find stream information");
    }

    int num_streams = fmt_ctx->nb_streams;

    WebAVStreamList stream_list = {
        .size = num_streams,
        .streams = std::vector<WebAVStream>(num_streams),
    };

    for (int stream_index = 0; stream_index < num_streams; stream_index++)
    {
        AVStream *stream = fmt_ctx->streams[stream_index];

        gen_web_stream(stream_list.streams[stream_index], stream, fmt_ctx);
    }

    avformat_close_input(&fmt_ctx);

    return stream_list;
}

WebMediaInfo get_media_info(std::string filename) {
    AVFormatContext *fmt_ctx = NULL;
    int ret;

    if ((ret = avformat_open_input(&fmt_ctx, filename.c_str(), NULL, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot open input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot open input file");
    }

    if ((ret = avformat_find_stream_info(fmt_ctx, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find stream information\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find stream information");
    }

    int num_streams = fmt_ctx->nb_streams;

    WebMediaInfo media_info = {
        .format_name = fmt_ctx->iformat->name,
        .start_time = fmt_ctx->start_time * av_q2d(AV_TIME_BASE_Q),
        .duration = fmt_ctx->duration * av_q2d(AV_TIME_BASE_Q),
        .bit_rate = std::to_string(fmt_ctx->bit_rate),
        .nb_streams = num_streams,
        .nb_chapters = (int)fmt_ctx->nb_chapters,
        .flags = fmt_ctx->flags,
        .streams = std::vector<WebAVStream>(num_streams),
    };

    for (int stream_index = 0; stream_index < num_streams; stream_index++)
    {
        AVStream *stream = fmt_ctx->streams[stream_index];

        gen_web_stream(media_info.streams[stream_index], stream, fmt_ctx);
    }

    avformat_close_input(&fmt_ctx);

    return media_info;
}

WebAVPacket get_av_packet(std::string filename, double timestamp, int type, int wanted_stream_nb, int seek_flag)
{
    AVFormatContext *fmt_ctx = NULL;
    int ret;

    if ((ret = avformat_open_input(&fmt_ctx, filename.c_str(), NULL, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot open input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot open input file");
    }

    if ((ret = avformat_find_stream_info(fmt_ctx, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find stream information\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find stream information");
    }

    int stream_index = av_find_best_stream(fmt_ctx, (AVMediaType)type, wanted_stream_nb, -1, NULL, 0);

    if (stream_index < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find wanted stream in the input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find wanted stream in the input file");
    }

    AVPacket *packet = NULL;
    packet = av_packet_alloc();

    if (!packet)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot allocate packet\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot allocate packet");
    }

    int64_t int64_timestamp = (int64_t)(timestamp * AV_TIME_BASE);
    int64_t seek_time_stamp = av_rescale_q(int64_timestamp, AV_TIME_BASE_Q, fmt_ctx->streams[stream_index]->time_base);

    if ((ret = av_seek_frame(fmt_ctx, stream_index, seek_time_stamp, seek_flag)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot seek to the specified timestamp\n");
        avformat_close_input(&fmt_ctx);
        av_packet_unref(packet);
        av_packet_free(&packet);
        throw std::runtime_error("Cannot seek to the specified timestamp");
    }

    while (av_read_frame(fmt_ctx, packet) >= 0)
    {
        if (packet->stream_index == stream_index)
        {
            break;
        }
        av_packet_unref(packet);
    }

    if (!packet)
    {
        av_log(NULL, AV_LOG_ERROR, "Failed to get av packet at timestamp\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Failed to get av packet at timestamp");
    }

    WebAVPacket web_packet;

    gen_web_packet(web_packet, packet, fmt_ctx->streams[stream_index]);

    avformat_close_input(&fmt_ctx);
    av_packet_unref(packet);
    av_packet_free(&packet);

    return web_packet;
}

WebAVPacketList get_av_packets(std::string filename, double timestamp, int seek_flag)
{
    AVFormatContext *fmt_ctx = NULL;
    int ret;

    if ((ret = avformat_open_input(&fmt_ctx, filename.c_str(), NULL, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot open input file\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot open input file");
    }

    if ((ret = avformat_find_stream_info(fmt_ctx, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find stream information\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot find stream information");
    }

    int num_streams = fmt_ctx->nb_streams;
    int num_packets = num_streams;
    WebAVPacketList web_packet_list = {
        .size = num_packets,
        .packets = std::vector<WebAVPacket>(num_packets),
    };

    AVPacket *packet = NULL;
    packet = av_packet_alloc();

    if (!packet)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot allocate packet\n");
        avformat_close_input(&fmt_ctx);
        throw std::runtime_error("Cannot allocate packet");
    }

    for (int stream_index = 0; stream_index < num_streams; stream_index++)
    {
        int64_t int64_timestamp = (int64_t)(timestamp * AV_TIME_BASE);
        int64_t seek_time_stamp = av_rescale_q(int64_timestamp, AV_TIME_BASE_Q, fmt_ctx->streams[stream_index]->time_base);

        if ((ret = av_seek_frame(fmt_ctx, stream_index, seek_time_stamp, seek_flag)) < 0)
        {
            av_log(NULL, AV_LOG_ERROR, "Cannot seek to the specified timestamp\n");
            throw std::runtime_error("Cannot seek to the specified timestamp");
        }

        while (av_read_frame(fmt_ctx, packet) >= 0)
        {
            if (packet->stream_index == stream_index)
            {
                break;
            }
            av_packet_unref(packet);
        }

        if (!packet)
        {
            av_log(NULL, AV_LOG_ERROR, "Failed to get av packet at timestamp\n");
            throw std::runtime_error("Failed to get av packet at timestamp");
        }

        gen_web_packet(web_packet_list.packets[stream_index], packet, fmt_ctx->streams[stream_index]);
    }

    av_packet_unref(packet);
    av_packet_free(&packet);
    avformat_close_input(&fmt_ctx);

    return web_packet_list;
}

int read_av_packet(std::string filename, double start, double end, int type, int wanted_stream_nb, int seek_flag, val js_caller)
{
    AVFormatContext *fmt_ctx = NULL;
    int ret;

    if ((ret = avformat_open_input(&fmt_ctx, filename.c_str(), NULL, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot open input file\n");
        avformat_close_input(&fmt_ctx);
        return 0;
    }

    if ((ret = avformat_find_stream_info(fmt_ctx, NULL)) < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find stream information\n");
        avformat_close_input(&fmt_ctx);
        return 0;
    }

    int stream_index = av_find_best_stream(fmt_ctx, (AVMediaType)type, wanted_stream_nb, -1, NULL, 0);

    if (stream_index < 0)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot find wanted stream in the input file\n");
        avformat_close_input(&fmt_ctx);
        return 0;
    }

    AVPacket *packet = NULL;
    packet = av_packet_alloc();

    if (!packet)
    {
        av_log(NULL, AV_LOG_ERROR, "Cannot allocate packet\n");
        avformat_close_input(&fmt_ctx);
        return 0;
    }

    if (start > 0)
    {
        int64_t start_timestamp = (int64_t)(start * AV_TIME_BASE);
        int64_t rescaled_start_time_stamp = av_rescale_q(start_timestamp, AV_TIME_BASE_Q, fmt_ctx->streams[stream_index]->time_base);

        if ((ret = av_seek_frame(fmt_ctx, stream_index, rescaled_start_time_stamp, seek_flag)) < 0)
        {
            av_log(NULL, AV_LOG_ERROR, "Cannot seek to the specified timestamp\n");
            avformat_close_input(&fmt_ctx);
            av_packet_unref(packet);
            av_packet_free(&packet);
            return 0;
        }
    }

    while (av_read_frame(fmt_ctx, packet) >= 0)
    {
        if (packet->stream_index == stream_index)
        {
            if (end > 0)
            {
                int64_t end_timestamp = (int64_t)(end * AV_TIME_BASE);
                int64_t rescaled_end_timestamp = av_rescale_q(end_timestamp, AV_TIME_BASE_Q, fmt_ctx->streams[stream_index]->time_base);

                if (packet->pts > rescaled_end_timestamp)
                {
                    break;
                }
            }

            if (packet)
            {
                WebAVPacket web_packet;

                gen_web_packet(web_packet, packet, fmt_ctx->streams[stream_index]);

                // call js method to send packet
                val result = js_caller.call<val>("sendAVPacket", web_packet).await();
                int send_result = result.as<int>();

                if (send_result == 0)
                {
                    break;
                }
            }
            else
            {
                av_log(NULL, AV_LOG_ERROR, "Failed to get av packet at timestamp\n");
                break;
            }
        }
        av_packet_unref(packet);
    }

    // call js method to end send packet
    js_caller.call<val>("sendAVPacket", 0).await();

    avformat_close_input(&fmt_ctx);
    av_packet_unref(packet);
    av_packet_free(&packet);

    return 1;
}

void set_av_log_level(int level) {
    av_log_set_level(level);
}

EMSCRIPTEN_BINDINGS(web_demuxer)
{
    value_object<Tag>("Tag")
        .field("key", &Tag::key)
        .field("value", &Tag::value);
    
     class_<WebAVStream>("WebAVStream")
        .constructor<>()
        .property("index", &WebAVStream::index)
        .property("id", &WebAVStream::id)
        .property("codec_type", &WebAVStream::codec_type)
        .property("codec_type_string", &WebAVStream::codec_type_string)
        .property("codec_name", &WebAVStream::codec_name)
        .property("codec_string", &WebAVStream::codec_string)
        .property("profile", &WebAVStream::profile)
        .property("pix_fmt", &WebAVStream::pix_fmt)
        .property("level", &WebAVStream::level)
        .property("width", &WebAVStream::width)
        .property("height", &WebAVStream::height)
        .property("channels", &WebAVStream::channels)
        .property("sample_rate", &WebAVStream::sample_rate)
        .property("sample_fmt", &WebAVStream::sample_fmt)
        .property("bit_rate", &WebAVStream::bit_rate)
        .property("extradata_size", &WebAVStream::extradata_size)
        .property("extradata", &WebAVStream::get_extradata) // export extradata as typed_memory_view
        .property("r_frame_rate", &WebAVStream::r_frame_rate)
        .property("avg_frame_rate", &WebAVStream::avg_frame_rate)
        .property("sample_aspect_ratio", &WebAVStream::sample_aspect_ratio)
        .property("display_aspect_ratio", &WebAVStream::display_aspect_ratio)
        .property("start_time", &WebAVStream::start_time)
        .property("duration", &WebAVStream::duration)
        .property("rotation", &WebAVStream::rotation)
        .property("nb_frames", &WebAVStream::nb_frames)
        .property("tags", &WebAVStream::get_tags)
        .property("color_primaries", &WebAVStream::color_primaries)
        .property("color_transfer", &WebAVStream::color_transfer)
        .property("color_space", &WebAVStream::color_space)
        .property("color_range", &WebAVStream::color_range);


    value_object<WebAVStreamList>("WebAVStreamList")
        .field("size", &WebAVStreamList::size)
        .field("streams", &WebAVStreamList::streams);

    value_object<WebMediaInfo>("WebMediaInfo")
        .field("format_name", &WebMediaInfo::format_name)
        .field("start_time", &WebMediaInfo::start_time)
        .field("duration", &WebMediaInfo::duration)
        .field("bit_rate", &WebMediaInfo::bit_rate)
        .field("nb_streams", &WebMediaInfo::nb_streams)
        .field("nb_chapters", &WebMediaInfo::nb_chapters)
        .field("flags", &WebMediaInfo::flags)
        .field("streams", &WebMediaInfo::streams);

    class_<WebAVPacket>("WebAVPacket")
        .constructor<>()
        .property("keyframe", &WebAVPacket::keyframe)
        .property("timestamp", &WebAVPacket::timestamp)
        .property("duration", &WebAVPacket::duration)
        .property("size", &WebAVPacket::size)
        .property("data", &WebAVPacket::get_data); // export data as typed_memory_view

    value_object<WebAVPacketList>("WebAVPacketList")
        .field("size", &WebAVPacketList::size)
        .field("packets", &WebAVPacketList::packets);

    function("get_av_stream", &get_av_stream, return_value_policy::take_ownership());
    function("get_av_streams", &get_av_streams, return_value_policy::take_ownership());
    function("get_media_info", &get_media_info, return_value_policy::take_ownership());
    function("get_av_packet", &get_av_packet, return_value_policy::take_ownership());
    function("get_av_packets", &get_av_packets, return_value_policy::take_ownership());
    function("read_av_packet", &read_av_packet);
    function("set_av_log_level", &set_av_log_level);

    register_vector<uint8_t>("vector<uint8_t>");
    register_vector<Tag>("vector<Tag>");
    register_vector<WebAVStream>("vector<WebAVStream>");
    register_vector<WebAVPacket>("vector<WebAVPacket>");
}