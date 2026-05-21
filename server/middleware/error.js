export function notFoundHandler(request, response, next) {
  const error = new Error(`Route not found: ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return response.status(400).json({ message: "Selfie image must be smaller than 5MB." });
  }

  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500
      ? "Unexpected server error. Please restart the local API and try again."
      : error.message || "Unexpected server error.";

  return response.status(statusCode).json({
    message
  });
}
