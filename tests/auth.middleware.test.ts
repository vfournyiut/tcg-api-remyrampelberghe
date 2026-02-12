import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import jwt from 'jsonwebtoken';
import { env } from '../src/env';

describe('Auth Middleware', () => {
    it('devrait rejeter une requête sans token', async () => {
        const response = await request(app).get('/api/decks/mine');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Token manquant');
    });

    it('devrait rejeter une requête avec un token invalide', async () => {
        const response = await request(app)
            .get('/api/decks/mine')
            .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Token invalide ou expiré');
    });

    it('devrait accepter une requête avec un token valide', async () => {
        const token = jwt.sign(
            { userId: 1, email: 'test@example.com' },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const response = await request(app)
            .get('/api/decks/mine')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('devrait rejeter un token expiré', async () => {
        const expiredToken = jwt.sign(
            { userId: 1, email: 'test@example.com' },
            env.JWT_SECRET,
            { expiresIn: '-1s' }
        );

        const response = await request(app)
            .get('/api/decks/mine')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Token invalide ou expiré');
    });

    it('devrait rejeter un authorization header sans Bearer', async () => {
        const response = await request(app)
            .get('/api/decks/mine')
            .set('Authorization', 'some-token');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Token manquant');
    });
});