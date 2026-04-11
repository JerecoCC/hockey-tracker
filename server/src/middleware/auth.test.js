'use strict';

const jwt = require('jsonwebtoken');
const { signToken, requireAuth, requireAdmin } = require('./auth');

const JWT_SECRET = process.env.JWT_SECRET || 'hockey-tracker-jwt-secret';

// ---------------------------------------------------------------------------
// Helper – build a minimal req/res/next triple
// ---------------------------------------------------------------------------
function makeReqRes(headers = {}) {
  const req = { headers, user: undefined };
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

// ---------------------------------------------------------------------------
// signToken
// ---------------------------------------------------------------------------
describe('signToken', () => {
  it('returns a string', () => {
    const token = signToken({ id: '1', email: 'a@b.com', role: 'user' });
    expect(typeof token).toBe('string');
  });

  it('encodes the payload and expires in 7d', () => {
    const payload = { id: 'uuid-123', email: 'test@test.com', role: 'admin' };
    const token = signToken(payload);
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    // exp should be ~7 days from now
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });
});

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------
describe('requireAuth', () => {
  it('calls next() when a valid Bearer token is provided', () => {
    const token = signToken({ id: '1', email: 'a@b.com', role: 'user' });
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('1');
  });

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = makeReqRes({});

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body.error).toMatch(/missing or invalid/i);
  });

  it('returns 401 when scheme is not Bearer', () => {
    const { req, res, next } = makeReqRes({ authorization: 'Basic abc123' });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('returns 401 for a tampered / invalid token', () => {
    const { req, res, next } = makeReqRes({ authorization: 'Bearer invalid.token.here' });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body.error).toMatch(/invalid or expired/i);
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ id: '1' }, JWT_SECRET, { expiresIn: -1 });
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------
describe('requireAdmin', () => {
  it('calls next() when the token contains role=admin', () => {
    const token = signToken({ id: '1', email: 'admin@a.com', role: 'admin' });
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when the token role is not admin', () => {
    const token = signToken({ id: '2', email: 'user@a.com', role: 'user' });
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._body.error).toMatch(/forbidden/i);
  });

  it('returns 401 when no token is provided', () => {
    const { req, res, next } = makeReqRes({});

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});
