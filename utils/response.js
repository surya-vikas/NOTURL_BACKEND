const sendSuccess = (res, options = {}) => {
  const { statusCode = 200, message = 'Success', ...payload } = options;
  return res.status(statusCode).json({
    success: true,
    message,
    ...payload,
  });
};

const sendError = (res, options = {}) => {
  const { statusCode = 500, message = 'Internal server error', ...payload } = options;
  return res.status(statusCode).json({
    success: false,
    message,
    ...payload,
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
