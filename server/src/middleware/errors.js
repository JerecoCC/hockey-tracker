class HttpError extends Error {
  constructor(status, message, { cause, expose = status < 500 } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'HttpError';
    this.status = status;
    this.expose = expose;
  }
}

const asyncRoute = (handler, { mapError } = {}) =>
  function asyncRouteHandler(req, res, next) {
    return Promise.resolve()
      .then(() => handler(req, res, next))
      .catch((error) => {
        next(mapError ? mapError(error) : error);
      });
  };

function notFoundHandler(_req, res) {
  return res.status(404).json({ error: 'Route not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const candidateStatus = Number(error?.status ?? error?.statusCode);
  const status =
    Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
      ? candidateStatus
      : 500;
  const expose = error?.expose === true || status < 500;
  const message = expose && typeof error?.message === 'string'
    ? error.message
    : 'Internal server error';

  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} failed:`, error);
  }

  return res.status(status).json({ error: message });
}

module.exports = {
  HttpError,
  asyncRoute,
  errorHandler,
  notFoundHandler,
};
