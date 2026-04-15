const ApiError = require('../utils/apiError');
const { sendError } = require('../utils/response');

const notFound = (req, res, next) => {
  next(new ApiError(`Route not found: ${req.originalUrl}`, 404));
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Database validation failed';
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate value detected';
  }

  return sendError(res, {
    statusCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
