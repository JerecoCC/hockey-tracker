'use strict';

// Mock the db module BEFORE requiring any route that depends on it
jest.mock('../db', () => ({ sql: jest.fn() }));
// Mock passport so OAuth routes don't blow up
jest.mock('passport', () => ({
  authenticate: () => (req, res, next) => next(),
  initialize: () => (req, res, next) => next(),
  session:    () => (req, res, next) => next(),
}));

const request  = require('supertest');
const express  = require('express');
const bcrypt   = require('bcryptjs');
const { sql }  = require('../db');
const authRouter = require('./auth');

// ---------------------------------------------------------------------------
// Minimal Express app for testing
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
describe('POST /api/auth/signup', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'Alice' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Alice', email: 'a@b.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('returns 409 when email already exists', async () => {
    sql.mockResolvedValueOnce([{ id: 'existing-id' }]); // existing check
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Alice', email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 201 with token and user on success', async () => {
    sql
      .mockResolvedValueOnce([])               // no existing user
      .mockResolvedValueOnce([{               // INSERT RETURNING
        id: 'new-uuid', display_name: 'Alice', email: 'a@b.com', photo: null, role: 'user',
      }]);

    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Alice', email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.user.role).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not found', async () => {
    sql.mockResolvedValueOnce([]); // no rows
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@b.com', password: 'pass123' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is wrong', async () => {
    const hash = await bcrypt.hash('correctpass', 1);
    sql.mockResolvedValueOnce([{ id: '1', email: 'a@b.com', password: hash, role: 'user' }]);
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with token on success', async () => {
    const hash = await bcrypt.hash('correctpass', 1);
    sql.mockResolvedValueOnce([{
      id: '1', display_name: 'Alice', email: 'a@b.com', password: hash, photo: null, role: 'user',
    }]);
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'correctpass' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('a@b.com');
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me', () => {
  const { signToken } = require('../middleware/auth');
  afterEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the user when authenticated', async () => {
    const token = signToken({ id: 'uid-1', email: 'a@b.com', role: 'user' });
    sql.mockResolvedValueOnce([{
      id: 'uid-1', display_name: 'Alice', email: 'a@b.com', photo: null, role: 'user',
    }]);
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('uid-1');
  });

  it('returns 404 when user row is missing', async () => {
    const token = signToken({ id: 'uid-ghost', email: 'ghost@b.com', role: 'user' });
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout', () => {
  it('returns 200 with a message', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });
});
