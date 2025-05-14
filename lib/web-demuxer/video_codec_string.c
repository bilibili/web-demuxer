#include "video_codec_string.h"
#include "libavutil/avstring.h"
#include "libavutil/pixdesc.h"
#include "libavutil/pixfmt.h"
#include "libavcodec/get_bits.h"
#include "libavcodec/defs.h"

/**
 * avc codec string
 * 
 * inspired by:
 *  - ff_isom_write_avcc
 * 
 */
void set_avc_codec_string(char *str, size_t str_size, AVCodecParameters *par)
{
    av_strlcpy(str, "avc1", str_size);

    uint8_t *data = par->extradata;
    int size = par->extradata_size;

    // If no extradata is available (such as in AVI files)
    if (!data || !size)
    {
        if (par->profile != AV_PROFILE_UNKNOWN && par->level != AV_LEVEL_UNKNOWN)
        {
            av_strlcatf(str, str_size, ".%02x%02x%02x",
                        par->profile, 0x00, par->level); 
        }
        else
        {
            // If no profile/level info available, use baseline profile (42) and level 1.0 (28) as fallback
            av_strlcatf(str, str_size, ".%02x%02x%02x",
                        0x42, 0x00, 0x28);
        }
        return;
    }

    GetBitContext gb;
    init_get_bits8(&gb, data, size);

    if (size >= 4)
    {
        skip_bits(&gb, 8);

        uint8_t profile = get_bits(&gb, 8);
        uint8_t profile_compat = get_bits(&gb, 8);
        uint8_t level = get_bits(&gb, 8);

        av_strlcatf(str, str_size, ".%02x%02x%02x",
                    profile, profile_compat, level);
    }
}

/**
 * hevc codec string
 * 
 * inspired by:
 *  - ff_isom_write_hvcc
 *  - https://chromium.googlesource.com/chromium/src/media/+/refs/heads/main/base/video_codec_string_parsers.cc#549
 *  - https://github.com/gpac/mp4box.js/blob/fbc03484283e389eae011c99a7a21a09a5c45f40/src/box-codecs.js#L106
 * 
 */
void set_hevc_codec_string(char *str, size_t str_size, AVCodecParameters *par)
{
    av_strlcpy(str, "hev1", str_size);

    uint8_t *data = par->extradata;
    int size = par->extradata_size;
    GetBitContext gb;

    init_get_bits8(&gb, data, size);

    skip_bits(&gb, 8); // configurationVersion
    uint8_t general_profile_space = get_bits(&gb, 2);
    uint8_t general_tier_flag = get_bits1(&gb);
    uint8_t general_profile_idc = get_bits(&gb, 5);
    uint32_t general_profile_compatibility_flags = get_bits_long(&gb, 32);
    uint64_t general_constraint_indicator_flags = get_bits64(&gb, 48);
    uint8_t general_level_idc = get_bits(&gb, 8);

    char *general_profile_space_str = "";

    switch (general_profile_space)
    {
    case 0:
        general_profile_space_str = "";
        break;
    case 1:
        general_profile_space_str = "A";
        break;
    case 2:
        general_profile_space_str = "B";
        break;
    case 3:
        general_profile_space_str = "C";
        break;
    default:
        break;
    }

    int final_general_profile_compatibility_flags = 0;

    for (int i = 0; i < 32; i++)
    {
        final_general_profile_compatibility_flags |= general_profile_compatibility_flags & 1;
        if (i == 31)
            break;
        final_general_profile_compatibility_flags <<= 1;
        general_profile_compatibility_flags >>= 1;
    }

    av_strlcatf(str, str_size, ".%s%d.%x.%s%d",
                general_profile_space_str,
                general_profile_idc,
                final_general_profile_compatibility_flags,
                general_tier_flag == 0 ? "L" : "H",
                general_level_idc);

    uint8_t general_constraint_indicator_flags_list[6];

    for (int i = 5; i >= 0; i--)
    {
        general_constraint_indicator_flags_list[i] = general_constraint_indicator_flags & 0xFF;
        general_constraint_indicator_flags >>= 8;
    }

    int has_byte = 0;

    for (int i = 5; i >= 0; i--)
    {
        if (general_constraint_indicator_flags_list[i] || has_byte)
        {
            av_strlcatf(str, str_size, ".%x", general_constraint_indicator_flags_list[i]);
            has_byte = 1;
        }
    }
}

/**
 * av1 codec string
 * 
 * inspired by:
 *  - ff_isom_write_av1c
 *  - https://aomediacodec.github.io/av1-isobmff/#av1codecconfigurationbox-section
 *  - https://github.com/gpac/mp4box.js/blob/fbc03484283e389eae011c99a7a21a09a5c45f40/src/box-codecs.js#L251
 * 
 */
void set_av1_codec_string(char *str, size_t str_size, AVCodecParameters *par)
{
    av_strlcpy(str, "av01", str_size);

    uint8_t *data = par->extradata;
    int size = par->extradata_size;

    if (!size)
        return;

    GetBitContext gb;
    int ret, version = data[0] & 0x7F;

    if (version != 1 || size < 4)
        return;

    ret = init_get_bits8(&gb, data, 4);
    if (ret < 0)
        return;

    skip_bits(&gb, 8);
    uint8_t profile = get_bits(&gb, 3);
    uint8_t level = get_bits(&gb, 5);
    uint8_t tier = get_bits(&gb, 1);
    uint8_t bitdepth = get_bits(&gb, 1) * 2 + 8;
    bitdepth += get_bits(&gb, 1) * 2;
    uint8_t monochrome = get_bits(&gb, 1);
    uint8_t chroma_subsampling_x = get_bits(&gb, 1);
    uint8_t chroma_subsampling_y = get_bits(&gb, 1);
    uint8_t chroma_sample_position = get_bits(&gb, 2);

    av_strlcatf(str, str_size, ".%01u.%02u%s.%02u",
                profile, level, tier ? "H" : "M", bitdepth);
    
    // if (par->color_primaries != 2 && par->color_trc != 2 && par->color_space != 2)
    //     av_strlcatf(str, str_size, ".%01u.%01u%01u%01u.%02u.%02u.%02u.%01u",
    //                 monochrome,
    //                 chroma_subsampling_x, chroma_subsampling_y, chroma_sample_position,
    //                 par->color_primaries, par->color_trc, par->color_space, par->color_range);
}

// ================== VP9 ====================

#define VP9_SYNCCODE 0x498342

typedef struct VPCC
{
    int profile;
    int level;
    int bitdepth;
    int chroma_subsampling;
    int full_range_flag;
} VPCC;

enum VPX_CHROMA_SUBSAMPLING
{
    VPX_SUBSAMPLING_420_VERTICAL = 0,
    VPX_SUBSAMPLING_420_COLLOCATED_WITH_LUMA = 1,
    VPX_SUBSAMPLING_422 = 2,
    VPX_SUBSAMPLING_444 = 3,
};

static int get_vpx_chroma_subsampling(enum AVPixelFormat pixel_format,
                                      enum AVChromaLocation chroma_location)
{
    int chroma_w, chroma_h;
    if (av_pix_fmt_get_chroma_sub_sample(pixel_format, &chroma_w, &chroma_h) == 0)
    {
        if (chroma_w == 1 && chroma_h == 1)
        {
            return (chroma_location == AVCHROMA_LOC_LEFT)
                       ? VPX_SUBSAMPLING_420_VERTICAL
                       : VPX_SUBSAMPLING_420_COLLOCATED_WITH_LUMA;
        }
        else if (chroma_w == 1 && chroma_h == 0)
        {
            return VPX_SUBSAMPLING_422;
        }
        else if (chroma_w == 0 && chroma_h == 0)
        {
            return VPX_SUBSAMPLING_444;
        }
    }
    printf("Unsupported pixel format (%d)\n", pixel_format);
    return -1;
}

static int get_bit_depth(enum AVPixelFormat pixel_format)
{
    const AVPixFmtDescriptor *desc = av_pix_fmt_desc_get(pixel_format);
    if (desc == NULL)
    {
        printf("Unsupported pixel format (%d)\n", pixel_format);
        return -1;
    }
    return desc->comp[0].depth;
}

static int get_vpx_video_full_range_flag(enum AVColorRange color_range)
{
    return color_range == AVCOL_RANGE_JPEG;
}

// Find approximate VP9 level based on the Luma's Sample rate and Picture size.
static int get_vp9_level(AVCodecParameters *par, AVRational *frame_rate)
{
    int picture_size = par->width * par->height;
    int64_t sample_rate;

    // All decisions will be based on picture_size, if frame rate is missing/invalid
    if (!frame_rate || !frame_rate->den)
        sample_rate = 0;
    else
        sample_rate = ((int64_t)picture_size * frame_rate->num) / frame_rate->den;

    if (picture_size <= 0)
    {
        return 0;
    }
    else if (sample_rate <= 829440 && picture_size <= 36864)
    {
        return 10;
    }
    else if (sample_rate <= 2764800 && picture_size <= 73728)
    {
        return 11;
    }
    else if (sample_rate <= 4608000 && picture_size <= 122880)
    {
        return 20;
    }
    else if (sample_rate <= 9216000 && picture_size <= 245760)
    {
        return 21;
    }
    else if (sample_rate <= 20736000 && picture_size <= 552960)
    {
        return 30;
    }
    else if (sample_rate <= 36864000 && picture_size <= 983040)
    {
        return 31;
    }
    else if (sample_rate <= 83558400 && picture_size <= 2228224)
    {
        return 40;
    }
    else if (sample_rate <= 160432128 && picture_size <= 2228224)
    {
        return 41;
    }
    else if (sample_rate <= 311951360 && picture_size <= 8912896)
    {
        return 50;
    }
    else if (sample_rate <= 588251136 && picture_size <= 8912896)
    {
        return 51;
    }
    else if (sample_rate <= 1176502272 && picture_size <= 8912896)
    {
        return 52;
    }
    else if (sample_rate <= 1176502272 && picture_size <= 35651584)
    {
        return 60;
    }
    else if (sample_rate <= 2353004544 && picture_size <= 35651584)
    {
        return 61;
    }
    else if (sample_rate <= 4706009088 && picture_size <= 35651584)
    {
        return 62;
    }
    else
    {
        return 0;
    }
}

static int get_vpcc_features(AVCodecParameters *par, AVRational *frame_rate, VPCC *vpcc)
{
    int profile = par->profile;
    int level = par->level == AV_LEVEL_UNKNOWN ? get_vp9_level(par, frame_rate) : par->level;
    int bit_depth = get_bit_depth(par->format);
    int vpx_chroma_subsampling =
        get_vpx_chroma_subsampling(par->format, par->chroma_location);
    int vpx_video_full_range_flag =
        get_vpx_video_full_range_flag(par->color_range);

    if (bit_depth < 0 || vpx_chroma_subsampling < 0)
        return AVERROR_INVALIDDATA;

    if (profile == AV_PROFILE_UNKNOWN && bit_depth)
    {
        if (vpx_chroma_subsampling == VPX_SUBSAMPLING_420_VERTICAL ||
            vpx_chroma_subsampling == VPX_SUBSAMPLING_420_COLLOCATED_WITH_LUMA)
        {
            profile = (bit_depth == 8) ? AV_PROFILE_VP9_0 : AV_PROFILE_VP9_2;
        }
        else
        {
            profile = (bit_depth == 8) ? AV_PROFILE_VP9_1 : AV_PROFILE_VP9_3;
        }
    }

    if (profile == AV_PROFILE_UNKNOWN || !bit_depth)
        printf("VP9 profile and/or bit depth not set or could not be derived\n");

    vpcc->profile = profile;
    vpcc->level = level;
    vpcc->bitdepth = bit_depth;
    vpcc->chroma_subsampling = vpx_chroma_subsampling;
    vpcc->full_range_flag = vpx_video_full_range_flag;

    return 0;
}

/**
 * vp9 codec string
 * 
 * inspired by:
 *  - ff_isom_write_vpcc
 *  - https://github.com/webmproject/vp9-dash/blob/main/VPCodecISOMediaFileFormatBinding.md#codecs-parameter-string
 * 
 */
void set_vp9_codec_string(char *str, size_t str_size, AVCodecParameters *par, AVRational *frame_rate)
{
    av_strlcpy(str, "vp09", str_size);

    VPCC vpcc;

    int ret = get_vpcc_features(par, frame_rate, &vpcc);

    if (ret == 0)
        av_strlcatf(str, str_size, 
                ".%02d.%02d.%02d.%02d.%02d.%02d.%02d.%02d",
                vpcc.profile, vpcc.level, vpcc.bitdepth, vpcc.chroma_subsampling, par->color_primaries, par->color_trc, par->color_space, vpcc.full_range_flag);
}

// ================== Export ====================

void set_video_codec_string(char *str, size_t str_size, AVCodecParameters *par, AVRational *frame_rate)
{
    if (par->codec_id == AV_CODEC_ID_H264)
    {
        set_avc_codec_string(str, str_size, par);
    }
    else if (par->codec_id == AV_CODEC_ID_HEVC)
    {
        set_hevc_codec_string(str, str_size, par);
    }
    else if (par->codec_id == AV_CODEC_ID_AV1)
    {
        set_av1_codec_string(str, str_size, par);
    }
    else if (par->codec_id == AV_CODEC_ID_VP9)
    {
        set_vp9_codec_string(str, str_size, par, NULL);
    }
    else if (par->codec_id == AV_CODEC_ID_VP8)
    {
        av_strlcpy(str, "vp8", str_size);
    }
    else
    {
        av_strlcpy(str, "undf", str_size);
    }
}