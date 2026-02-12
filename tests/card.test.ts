import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prismaMock } from './vitest.setup';
import { app } from '../src/index';
import { PokemonType } from '../src/generated/prisma/enums';

describe('GET /api/cards', () => {
    it('devrait retourner toutes les cartes triées par pokedexNumber', async () => {
        const mockCards = [
            {
                id: 1,
                name: 'Bulbasaur',
                hp: 45,
                attack: 49,
                type: PokemonType.Grass,
                pokedexNumber: 1,
                imgUrl: 'https://example.com/bulbasaur.png',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 4,
                name: 'Charmander',
                hp: 39,
                attack: 52,
                type: PokemonType.Fire,
                pokedexNumber: 4,
                imgUrl: 'https://example.com/charmander.png',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 7,
                name: 'Squirtle',
                hp: 44,
                attack: 48,
                type: PokemonType.Water,
                pokedexNumber: 7,
                imgUrl: 'https://example.com/squirtle.png',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        prismaMock.card.findMany.mockResolvedValue(mockCards);

        const response = await request(app).get('/api/cards');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(3);
        expect(response.body[0]).toHaveProperty('name', 'Bulbasaur');
        expect(response.body[1]).toHaveProperty('name', 'Charmander');
        expect(response.body[2]).toHaveProperty('name', 'Squirtle');
    });

    it('devrait retourner un tableau vide si aucune carte n\'existe', async () => {
        prismaMock.card.findMany.mockResolvedValue([]);

        const response = await request(app).get('/api/cards');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('devrait retourner 500 en cas d\'erreur serveur', async () => {
        prismaMock.card.findMany.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/cards');

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', 'Erreur serveur');
    });
});
