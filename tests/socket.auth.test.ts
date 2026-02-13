import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware } from '../src/auth/socket.auth.middleware';
import { env } from '../src/env';

describe('Socket.io Authentication Middleware', () => {
    let io: SocketIOServer;
    let serverSocket: any;
    let clientSocket: ClientSocket;
    let httpServer: any;
    const port = 3002; // Use different port for tests

    beforeEach(() => {
        return new Promise<void>((resolve) => {
            // Create HTTP server
            httpServer = createServer();
            
            // Initialize Socket.io server
            io = new SocketIOServer(httpServer, {
                cors: {
                    origin: true,
                    credentials: true,
                },
            });

            // Apply authentication middleware
            io.use(socketAuthMiddleware);

            // Listen for connections
            io.on('connection', (socket) => {
                serverSocket = socket;
            });

            httpServer.listen(port, () => {
                resolve();
            });
        });
    });

    afterEach(() => {
        if (clientSocket && clientSocket.connected) {
            clientSocket.disconnect();
        }
        io.close();
        httpServer.close();
    });

    it('should refuse connection without token', () => {
        return new Promise<void>((resolve, reject) => {
            clientSocket = ioClient(`http://localhost:${port}`, {
                auth: {}
            });

            clientSocket.on('connect_error', (error: Error) => {
                try {
                    expect(error.message).toBe('Token manquant');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            clientSocket.on('connect', () => {
                reject(new Error('Should not connect without token'));
            });
        });
    });

    it('should refuse connection with invalid token', () => {
        return new Promise<void>((resolve, reject) => {
            clientSocket = ioClient(`http://localhost:${port}`, {
                auth: {
                    token: 'invalid-token-here'
                }
            });

            clientSocket.on('connect_error', (error: Error) => {
                try {
                    expect(error.message).toBe('Token invalide ou expiré');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            clientSocket.on('connect', () => {
                reject(new Error('Should not connect with invalid token'));
            });
        });
    });

    it('should accept connection with valid JWT token', () => {
        return new Promise<void>((resolve, reject) => {
            // Generate a valid token
            const validToken = jwt.sign(
                {
                    userId: 1,
                    email: 'test@example.com'
                },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            clientSocket = ioClient(`http://localhost:${port}`, {
                auth: {
                    token: validToken
                }
            });

            clientSocket.on('connect', () => {
                try {
                    expect(clientSocket.connected).toBe(true);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            clientSocket.on('connect_error', (error: Error) => {
                reject(new Error(`Should connect with valid token: ${error.message}`));
            });
        });
    });

    it('should inject userId and email into socket after successful authentication', () => {
        return new Promise<void>((resolve, reject) => {
            const testUserId = 42;
            const testEmail = 'authenticated@example.com';

            // Generate a valid token with specific user data
            const validToken = jwt.sign(
                {
                    userId: testUserId,
                    email: testEmail
                },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            clientSocket = ioClient(`http://localhost:${port}`, {
                auth: {
                    token: validToken
                }
            });

            clientSocket.on('connect', () => {
                // Wait a bit for server to process
                setTimeout(() => {
                    try {
                        // Check if server socket has the user information
                        expect(serverSocket).toBeDefined();
                        expect(serverSocket.userId).toBe(testUserId);
                        expect(serverSocket.email).toBe(testEmail);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }, 100);
            });

            clientSocket.on('connect_error', (error: Error) => {
                reject(new Error(`Connection failed: ${error.message}`));
            });
        });
    });
});

