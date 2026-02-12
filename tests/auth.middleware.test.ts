import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../src/auth/auth.middleware';
import { env } from '../src/env';

describe('Auth Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            headers: {},
        };
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
        mockNext = vi.fn();
    });

    it('devrait rejeter une requête sans token', () => {
        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token manquant' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait rejeter une requête avec un token invalide', () => {
        mockRequest.headers = {
            authorization: 'Bearer invalid-token',
        };

        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait accepter une requête avec un token valide', () => {
        const token = jwt.sign(
            { userId: 1, email: 'test@example.com' },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        mockRequest.headers = {
            authorization: `Bearer ${token}`,
        };

        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            mockNext
        );

        expect(mockRequest.user).toEqual({
            userId: 1,
            email: 'test@example.com',
        });
        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('devrait rejeter un token expiré', () => {
        const expiredToken = jwt.sign(
            { userId: 1, email: 'test@example.com' },
            env.JWT_SECRET,
            { expiresIn: '-1s' }
        );

        mockRequest.headers = {
            authorization: `Bearer ${expiredToken}`,
        };

        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait rejeter un authorization header sans Bearer', () => {
        mockRequest.headers = {
            authorization: 'some-token',
        };

        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token manquant' });
        expect(mockNext).not.toHaveBeenCalled();
    });
});
