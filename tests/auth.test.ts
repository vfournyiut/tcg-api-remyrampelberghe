import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prismaMock } from './vitest.setup';
import { app } from '../src/index';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/env';

describe('POST /api/auth/sign-up', () => {
    it('devrait créer un nouveau compte utilisateur avec succès', async () => {
        const newUser = {
            id: 1,
            email: 'new@example.com',
            username: 'newuser',
            password: 'hashed_password',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue(newUser);

        const response = await request(app)
            .post('/api/auth/sign-up')
            .send({
                email: 'new@example.com',
                username: 'newuser',
                password: 'password123',
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('id', 1);
        expect(response.body.user).toHaveProperty('username', 'newuser');
        expect(response.body.user).toHaveProperty('email', 'new@example.com');

        // Vérifier que le token est valide
        const decoded = jwt.verify(response.body.token, env.JWT_SECRET) as any;
        expect(decoded.userId).toBe(1);
        expect(decoded.email).toBe('new@example.com');
    });

    it('devrait retourner 400 si des données sont manquantes', async () => {
        const response = await request(app)
            .post('/api/auth/sign-up')
            .send({ email: 'test@example.com' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Données manquantes');
    });

    it('devrait retourner 409 si l\'email existe déjà', async () => {
        const existingUser = {
            id: 1,
            email: 'existing@example.com',
            username: 'existing',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        prismaMock.user.findUnique.mockResolvedValue(existingUser);

        const response = await request(app)
            .post('/api/auth/sign-up')
            .send({
                email: 'existing@example.com',
                username: 'newuser',
                password: 'password123',
            });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('error', 'Email déjà utilisé');
    });

    it('devrait retourner 500 en cas d\'erreur serveur', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
            .post('/api/auth/sign-up')
            .send({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', 'Erreur serveur');
    });
});

describe('POST /api/auth/sign-in', () => {
    it('devrait connecter un utilisateur avec des identifiants valides', async () => {
        const hashedPassword = await bcryptjs.hash('password123', 10);
        const mockUser = {
            id: 1,
            email: 'user@example.com',
            username: 'user',
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        const response = await request(app)
            .post('/api/auth/sign-in')
            .send({
                email: 'user@example.com',
                password: 'password123',
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('message', 'Connexion réussie');
        expect(response.body.user).toHaveProperty('id', 1);
        expect(response.body.user).toHaveProperty('username', 'user');
        expect(response.body.user).toHaveProperty('email', 'user@example.com');
    });

    it('devrait retourner 400 si des données sont manquantes', async () => {
        const response = await request(app)
            .post('/api/auth/sign-in')
            .send({ email: 'test@example.com' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Données manquantes');
    });

    it('devrait retourner 401 si l\'utilisateur n\'existe pas', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const response = await request(app)
            .post('/api/auth/sign-in')
            .send({
                email: 'nonexistent@example.com',
                password: 'password123',
            });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Email ou mot de passe incorrect');
    });

    it('devrait retourner 401 si le mot de passe est incorrect', async () => {
        const hashedPassword = await bcryptjs.hash('correctpassword', 10);
        const mockUser = {
            id: 1,
            email: 'user@example.com',
            username: 'user',
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        const response = await request(app)
            .post('/api/auth/sign-in')
            .send({
                email: 'user@example.com',
                password: 'wrongpassword',
            });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Email ou mot de passe incorrect');
    });

    it('devrait retourner 500 en cas d\'erreur serveur', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
            .post('/api/auth/sign-in')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', 'Erreur serveur');
    });
});
