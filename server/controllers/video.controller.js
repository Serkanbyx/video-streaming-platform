import Video from '../models/Video.js';

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const GENERIC_FAILURE_MESSAGE = 'Processing failed';

export const getStatus = async (req, res, next) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId })
      .select('videoId status processingError author')
      .lean();

    if (!video) throw httpError(404, 'Video not found');

    const viewer = req.user;
    const isAuthor = viewer && String(video.author) === String(viewer._id);
    const isAdmin = viewer?.role === 'admin';

    let processingError = null;
    if (video.status === 'failed') {
      processingError =
        isAuthor || isAdmin
          ? video.processingError || GENERIC_FAILURE_MESSAGE
          : GENERIC_FAILURE_MESSAGE;
    }

    res.json({
      success: true,
      data: {
        videoId: video.videoId,
        status: video.status,
        processingError,
      },
    });
  } catch (err) {
    next(err);
  }
};
