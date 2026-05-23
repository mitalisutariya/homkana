/**
 * ApiError - Custom error class for API responses
 */
class ApiError extends Error {
  constructor(statusCode, message = 'Internal Server Error', errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
