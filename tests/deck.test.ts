import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { prismaMock } from './vitest.setup';
import { app } from '../src/index';
import jwt from 'jsonwebtoken';
import { env } from '../src/env';
import { PokemonType } from '../src/generated/prisma/enums';

describe('Decks Routes', () => {
    let authToken: string;
    const userId = 1;

    beforeEach(() => {
        authToken = jwt.sign(
            { userId, email: 'test@example.com' },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );
    });

    describe('POST /api/decks', () => {
        it('devrait créer un nouveau deck avec succès', async () => {
            const cardIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const mockCards = cardIds.map(id => ({
                id,
                name: `Card ${id}`,
                hp: 50,
                attack: 50,
                type: PokemonType.Normal,
                pokedexNumber: id,
                imgUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const mockDeck = {
                id: 1,
                name: 'My Deck',
                userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                cards: cardIds.map((cardId, index) => ({
                    id: index + 1,
                    deckId: 1,
                    cardId,
                    card: mockCards[index],
                })),
            };

            prismaMock.card.findMany.mockResolvedValue(mockCards);
            prismaMock.deck.create.mockResolvedValue(mockDeck);

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: cardIds,
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id', 1);
            expect(response.body).toHaveProperty('name', 'My Deck');
        });

        it('devrait retourner 401 sans token', async () => {
            const response = await request(app)
                .post('/api/decks')
                .send({
                    name: 'My Deck',
                    cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 401 avec un token sans userId', async () => {
            const invalidToken = jwt.sign(
                { email: 'test@example.com' }, // Pas de userId
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${invalidToken}`)
                .send({
                    name: 'My Deck',
                    cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 400 si le nom est manquant', async () => {
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Nom manquant');
        });

        it('devrait retourner 400 si le deck ne contient pas exactement 10 cartes', async () => {
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: [1, 2, 3],
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Le deck doit contenir exactement 10 cartes');
        });

        it('devrait retourner 400 si cards n\'est pas un tableau', async () => {
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: 'not-an-array',
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Le deck doit contenir exactement 10 cartes');
        });

        it('devrait retourner 400 si les cartes ne sont pas uniques', async () => {
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: [1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Les cartes doivent être uniques');
        });

        it('devrait retourner 400 si certaines cartes sont invalides', async () => {
            prismaMock.card.findMany.mockResolvedValue([]);

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Certaines cartes sont invalides');
        });

        it('devrait retourner 400 si cards contient des valeurs non entières', async () => {
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Le deck doit contenir exactement 10 cartes');
        });

        it('devrait retourner 500 en cas d\'erreur serveur', async () => {
            const cardIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const mockCards = cardIds.map(id => ({
                id,
                name: `Card ${id}`,
                hp: 50,
                attack: 50,
                type: PokemonType.Normal,
                pokedexNumber: id,
                imgUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            prismaMock.card.findMany.mockResolvedValue(mockCards);
            prismaMock.deck.create.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Deck',
                    cards: cardIds,
                });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Erreur serveur');
        });
    });

    describe('GET /api/decks/mine', () => {
        it('devrait retourner tous les decks de l\'utilisateur', async () => {
            const mockDecks = [
                {
                    id: 1,
                    name: 'Deck 1',
                    userId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    cards: [],
                },
                {
                    id: 2,
                    name: 'Deck 2',
                    userId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    cards: [],
                },
            ];

            prismaMock.deck.findMany.mockResolvedValue(mockDecks);

            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body[0]).toHaveProperty('name', 'Deck 1');
            expect(response.body[1]).toHaveProperty('name', 'Deck 2');
        });

        it('devrait retourner 401 sans token', async () => {
            const response = await request(app).get('/api/decks/mine');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 401 avec un token sans userId', async () => {
            const invalidToken = jwt.sign(
                { email: 'test@example.com' },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${invalidToken}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner un tableau vide si l\'utilisateur n\'a pas de decks', async () => {
            prismaMock.deck.findMany.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('devrait retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.deck.findMany.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Erreur serveur');
        });
    });

    describe('GET /api/decks/:id', () => {
        it('devrait retourner un deck par son ID', async () => {
            const mockDeck = {
                id: 1,
                name: 'My Deck',
                userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                cards: [],
            };

            prismaMock.deck.findFirst.mockResolvedValue(mockDeck);

            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id', 1);
            expect(response.body).toHaveProperty('name', 'My Deck');
        });

        it('devrait retourner 401 sans token', async () => {
            const response = await request(app).get('/api/decks/1');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 401 avec un token sans userId', async () => {
            const invalidToken = jwt.sign(
                { email: 'test@example.com' },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${invalidToken}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 404 si le deck n\'existe pas', async () => {
            prismaMock.deck.findFirst.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/decks/999')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Deck introuvable');
        });

        it('devrait retourner 404 si l\'ID n\'est pas un entier', async () => {
            const response = await request(app)
                .get('/api/decks/invalid')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Deck introuvable');
        });

        it('devrait retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.deck.findFirst.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Erreur serveur');
        });
    });

    describe('PATCH /api/decks/:id', () => {
        it('devrait mettre à jour le nom d\'un deck', async () => {
            const mockDeck = {
                id: 1,
                name: 'Updated Deck',
                userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                cards: [],
            };

            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);
            prismaMock.deck.update.mockResolvedValue(mockDeck);

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated Deck' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('name', 'Updated Deck');
        });

        it('devrait mettre à jour les cartes d\'un deck', async () => {
            const cardIds = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
            const mockCards = cardIds.map(id => ({
                id,
                name: `Card ${id}`,
                hp: 50,
                attack: 50,
                type: PokemonType.Normal,
                pokedexNumber: id,
                imgUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const mockDeck = {
                id: 1,
                name: 'My Deck',
                userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                cards: cardIds.map((cardId, index) => ({
                    id: index + 1,
                    deckId: 1,
                    cardId,
                    card: mockCards[index],
                })),
            };

            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);
            prismaMock.card.findMany.mockResolvedValue(mockCards);
            prismaMock.deck.update.mockResolvedValue(mockDeck);

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ cards: cardIds });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id', 1);
        });

        it('devrait retourner 401 sans token', async () => {
            const response = await request(app)
                .patch('/api/decks/1')
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 401 avec un token sans userId', async () => {
            const invalidToken = jwt.sign(
                { email: 'test@example.com' },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${invalidToken}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 404 si le deck n\'existe pas', async () => {
            prismaMock.deck.findFirst.mockResolvedValue(null);

            const response = await request(app)
                .patch('/api/decks/999')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Deck introuvable');
        });

        it('devrait retourner 400 si aucune donnée à modifier', async () => {
            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Aucune donnée à modifier');
        });

        it('devrait retourner 400 si les cartes ne sont pas exactement 10', async () => {
            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ cards: [1, 2, 3] });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Le deck doit contenir exactement 10 cartes');
        });

        it('devrait retourner 400 si les cartes ne sont pas uniques', async () => {
            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ cards: [1, 1, 2, 3, 4, 5, 6, 7, 8, 9] });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Les cartes doivent être uniques');
        });

        it('devrait retourner 400 si certaines cartes sont invalides', async () => {
            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);
            prismaMock.card.findMany.mockResolvedValue([]);

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Certaines cartes sont invalides');
        });

        it('devrait retourner 404 si l\'ID n\'est pas un entier', async () => {
            const response = await request(app)
                .patch('/api/decks/invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Deck introuvable');
        });

        it('devrait retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.deck.findFirst.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Erreur serveur');
        });
    });

    describe('DELETE /api/decks/:id', () => {
        it('devrait supprimer un deck', async () => {
            prismaMock.deck.findFirst.mockResolvedValue({ id: 1 } as any);
            prismaMock.deck.delete.mockResolvedValue({} as any);

            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Deck supprimé');
        });

        it('devrait retourner 401 sans token', async () => {
            const response = await request(app).delete('/api/decks/1');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 401 avec un token sans userId', async () => {
            const invalidToken = jwt.sign(
                { email: 'test@example.com' },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${invalidToken}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Token manquant');
        });

        it('devrait retourner 404 si le deck n\'existe pas', async () => {
            prismaMock.deck.findFirst.mockResolvedValue(null);

            const response = await request(app)
                .delete('/api/decks/999')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Deck introuvable');
        });

        it('devrait retourner 404 si l\'ID n\'est pas un entier', async () => {
            const response = await request(app)
                .delete('/api/decks/invalid')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Deck introuvable');
        });

        it('devrait retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.deck.findFirst.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Erreur serveur');
        });
    });
});
