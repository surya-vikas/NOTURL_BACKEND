const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const UrlModel = require('../models/URL');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');
const { serializeUrl } = require('../utils/serializers');
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const SHORT_ID_LENGTH = 8;
const MAX_SHORT_ID_ATTEMPTS = 7;
const CUSTOM_ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '');
const normalizedBaseUrl = trimTrailingSlashes(BASE_URL);

const normalizeOriginalUrl = (originalUrl) => {
  const candidate = String(originalUrl || '').trim();
  if (!candidate) {
    throw new ApiError('Original URL is required', 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(candidate);
  } catch (error) {
    throw new ApiError('Please provide a valid URL', 400);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ApiError('URL must start with http:// or https://', 400);
  }

  return parsedUrl.toString();
};

const normalizeCustomAlias = (customAlias) => {
  const candidate = String(customAlias || '').trim();
  if (!candidate) {
    return null;
  }

  if (!CUSTOM_ALIAS_PATTERN.test(candidate)) {
    throw new ApiError(
      'Custom alias must be 3-32 characters using letters, numbers, "-" or "_".',
      400
    );
  }

  return candidate;
};

const generateUniqueShortId = async () => {
  for (let attempt = 0; attempt < MAX_SHORT_ID_ATTEMPTS; attempt += 1) {
    const candidate = nanoid(SHORT_ID_LENGTH);
    const existing = await UrlModel.exists({ shortId: candidate });
    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError('Could not generate a unique short URL ID', 500);
};

const createShortUrl = asyncHandler(async (req, res) => {
  const normalizedOriginalUrl = normalizeOriginalUrl(req.body.originalUrl);
  const requestedAlias = normalizeCustomAlias(req.body.customAlias);

  const createUrlRecord = async (candidateShortId) => {
    const shortUrl = `${normalizedBaseUrl}/${candidateShortId}`;
    return UrlModel.create({
      originalUrl: normalizedOriginalUrl,
      shortId: candidateShortId,
      shortUrl,
      user: req.user._id,
    });
  };

  let shortId = requestedAlias;
  if (shortId) {
    const existingAlias = await UrlModel.exists({ shortId });
    if (existingAlias) {
      throw new ApiError('Alias key already taken. Try another alias or generate a random one.', 409);
    }
  } else {
    shortId = await generateUniqueShortId();
  }

  let url;
  try {
    url = await createUrlRecord(shortId);
  } catch (error) {
    if (error?.code === 11000 && requestedAlias) {
      throw new ApiError('Alias key already taken. Try another alias or generate a random one.', 409);
    }

    throw error;
  }

  const message = requestedAlias
    ? 'Short URL created successfully with your alias.'
    : 'Short URL created successfully.';

  sendSuccess(res, {
    statusCode: 201,
    message,
    url: serializeUrl(url),
    requestedAlias,
  });
});

const getUserUrls = asyncHandler(async (req, res) => {
  const urls = await UrlModel.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, {
    statusCode: 200,
    message: 'URLs fetched successfully.',
    urls: urls.map(serializeUrl),
  });
});

const deleteUrl = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError('Invalid URL id', 400);
  }

  const deletedUrl = await UrlModel.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!deletedUrl) {
    throw new ApiError('URL not found', 404);
  }

  sendSuccess(res, {
    statusCode: 200,
    message: 'URL deleted successfully.',
  });
});

const updateUrl = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError('Invalid URL id', 400);
  }

  const normalizedOriginalUrl = normalizeOriginalUrl(req.body.originalUrl);

  const updatedUrl = await UrlModel.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { originalUrl: normalizedOriginalUrl },
    { new: true }
  );

  if (!updatedUrl) {
    throw new ApiError('URL not found', 404);
  }

  sendSuccess(res, {
    statusCode: 200,
    message: 'URL updated successfully.',
    url: serializeUrl(updatedUrl),
  });
});

const updateUrlStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError('Invalid URL id', 400);
  }

  const isActive = req.body.isActive;
  if (typeof isActive !== 'boolean') {
    throw new ApiError('isActive must be a boolean value', 400);
  }

  const updatedUrl = await UrlModel.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isActive },
    { new: true }
  );

  if (!updatedUrl) {
    throw new ApiError('URL not found', 404);
  }

  sendSuccess(res, {
    statusCode: 200,
    message: isActive ? 'URL activated successfully.' : 'URL suspended successfully.',
    url: serializeUrl(updatedUrl),
  });
});

const redirectToOriginalUrl = asyncHandler(async (req, res) => {
  const shortId = String(req.params.shortId || '').trim();
  if (!shortId) {
    throw new ApiError('Short URL id is required', 400);
  }

  const activeUrl = await UrlModel.findOneAndUpdate(
    { shortId, isActive: true },
    { $inc: { clicks: 1 } },
    { new: true }
  );

  if (activeUrl) {
    return res.redirect(activeUrl.originalUrl);
  }

  const inactiveUrl = await UrlModel.findOne({ shortId }).lean();
  if (inactiveUrl && inactiveUrl.isActive === false) {
    return res.status(410).send('This link is inactive');
  }

  throw new ApiError('Short URL not found', 404);
});

module.exports = {
  createShortUrl,
  getUserUrls,
  deleteUrl,
  updateUrl,
  updateUrlStatus,
  redirectToOriginalUrl,
};
