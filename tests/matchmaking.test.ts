import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { io as ioClient, Socket } from 'socket.io-client';
import { app } from '../src/index';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware } from '../src/auth/socket.auth.middleware';
import { 
    handleCreateRoom, 
    handleGetRooms, 
    handleJoinRoom, 
    handleDisconnect 
} from '../src/game/game.handlers';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '../src/generated/prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../src/env';

// Use a real Prisma instance for integration tests (not mocked)
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEST_PORT = 3003;

describe('Matchmaking System', () => {
    let httpServer: any;
    let io: SocketIOServer;
    let redSocket: Socket;
    let blueSocket: Socket;
    let redToken: string;
    let blueToken: string;
    let redUserId: number;
    let blueUserId: number;
    let redDeckId: number;
    let blueDeckId: number;

    beforeAll(async () => {
        // Create HTTP server with Socket.io
        httpServer = createServer(app);
        io = new SocketIOServer(httpServer, {
            cors: {
                origin: true,
                credentials: true,
            },
        });

        // Apply authentication middleware
        io.use(socketAuthMiddleware);

        // Setup connection handler
        io.on('connection', (socket) => {
            socket.on('createRoom', (data) => handleCreateRoom(io, socket, data));
            socket.on('getRooms', () => handleGetRooms(socket));
            socket.on('joinRoom', (data) => handleJoinRoom(io, socket, data));
            socket.on('disconnect', () => handleDisconnect(io, socket));
        });

        httpServer.listen(TEST_PORT);

        // Get red user and deck
        const redUser = await prisma.user.findUnique({
            where: { email: 'red@example.com' },
        });
        expect(redUser).toBeDefined();
        redUserId = redUser!.id;

        const redDeck = await prisma.deck.findFirst({
            where: { userId: redUserId },
            include: { cards: true },
        });
        expect(redDeck).toBeDefined();
        expect(redDeck!.cards.length).toBeGreaterThanOrEqual(10);
        redDeckId = redDeck!.id;

        // Get blue user and deck
        const blueUser = await prisma.user.findUnique({
            where: { email: 'blue@example.com' },
        });
        expect(blueUser).toBeDefined();
        blueUserId = blueUser!.id;

        const blueDeck = await prisma.deck.findFirst({
            where: { userId: blueUserId },
            include: { cards: true },
        });
        expect(blueDeck).toBeDefined();
        expect(blueDeck!.cards.length).toBeGreaterThanOrEqual(10);
        blueDeckId = blueDeck!.id;

        // Generate JWT tokens
        redToken = jwt.sign({ userId: redUserId, email: 'red@example.com' }, env.JWT_SECRET);
        blueToken = jwt.sign({ userId: blueUserId, email: 'blue@example.com' }, env.JWT_SECRET);
    });

    afterAll(async () => {
        if (redSocket && redSocket.connected) {
            redSocket.disconnect();
        }
        if (blueSocket && blueSocket.connected) {
            blueSocket.disconnect();
        }
        if (httpServer) {
            httpServer.close();
        }
        if (io) {
            io.close();
        }
        await prisma.$disconnect();
    });

    beforeEach(async () => {
        // Disconnect existing sockets if any
        if (redSocket && redSocket.connected) {
            redSocket.disconnect();
        }
        if (blueSocket && blueSocket.connected) {
            blueSocket.disconnect();
        }
    });

    it('should allow a user to create a room', async () => {
        return new Promise<void>((resolve, reject) => {
            redSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token: redToken },
            });

            redSocket.on('connect', () => {
                redSocket.emit('createRoom', { deckId: redDeckId });
            });

            redSocket.on('roomCreated', (data) => {
                try {
                    expect(data).toBeDefined();
                    expect(data.roomId).toBeDefined();
                    expect(data.host.userId).toBe(redUserId);
                    expect(data.status).toBe('waiting');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            redSocket.on('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => reject(new Error('Test timeout')), 5000);
        });
    });

    it('should return list of available rooms', async () => {
        return new Promise<void>(async (resolve, reject) => {
            // First, create a room
            redSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token: redToken },
            });

            let roomId: string;

            redSocket.on('connect', () => {
                redSocket.emit('createRoom', { deckId: redDeckId });
            });

            redSocket.on('roomCreated', (data) => {
                roomId = data.roomId;

                // Now connect with blue user and get rooms
                blueSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                    auth: { token: blueToken },
                });

                blueSocket.on('connect', () => {
                    blueSocket.emit('getRooms');
                });

                blueSocket.on('roomsList', (data) => {
                    try {
                        expect(data).toBeDefined();
                        expect(data.rooms).toBeInstanceOf(Array);
                        expect(data.rooms.length).toBeGreaterThan(0);
                        
                        const createdRoom = data.rooms.find((r: any) => r.roomId === roomId);
                        expect(createdRoom).toBeDefined();
                        expect(createdRoom.host.userId).toBe(redUserId);
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });

                blueSocket.on('error', (error) => {
                    reject(new Error(error.message));
                });
            });

            redSocket.on('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => reject(new Error('Test timeout')), 5000);
        });
    });

    it('should allow a second player to join a room and start the game', async () => {
        return new Promise<void>(async (resolve, reject) => {
            let roomId: string;
            let receivedGameStates = 0;

            // Red creates room
            redSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token: redToken },
            });

            redSocket.on('connect', () => {
                redSocket.emit('createRoom', { deckId: redDeckId });
            });

            redSocket.on('roomCreated', (data) => {
                roomId = data.roomId;

                // Blue joins room
                blueSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                    auth: { token: blueToken },
                });

                blueSocket.on('connect', () => {
                    blueSocket.emit('joinRoom', { roomId, deckId: blueDeckId });
                });

                blueSocket.on('error', (error) => {
                    reject(new Error(error.message));
                });
            });

            // Red receives gameStarted
            redSocket.on('gameStarted', (data) => {
                try {
                    expect(data).toBeDefined();
                    expect(data.roomId).toBe(roomId);
                    expect(data.player.userId).toBe(redUserId);
                    expect(data.player.hand).toBeInstanceOf(Array);
                    expect(data.player.hand.length).toBe(5);
                    expect(data.opponent.userId).toBe(blueUserId);
                    expect(data.opponent.handCount).toBe(5);
                    expect(data.currentTurn).toBe(redUserId);
                    expect(data.turnCount).toBe(1);

                    receivedGameStates++;
                    if (receivedGameStates === 2) {
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            });

            // Blue receives gameStarted
            blueSocket.on('gameStarted', (data) => {
                try {
                    expect(data).toBeDefined();
                    expect(data.roomId).toBe(roomId);
                    expect(data.player.userId).toBe(blueUserId);
                    expect(data.player.hand).toBeInstanceOf(Array);
                    expect(data.player.hand.length).toBe(5);
                    expect(data.opponent.userId).toBe(redUserId);
                    expect(data.opponent.handCount).toBe(5);
                    expect(data.currentTurn).toBe(redUserId);
                    expect(data.turnCount).toBe(1);

                    receivedGameStates++;
                    if (receivedGameStates === 2) {
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            });

            redSocket.on('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => reject(new Error('Test timeout')), 5000);
        });
    });

    it('should prevent creating a room with invalid deck', async () => {
        return new Promise<void>((resolve, reject) => {
            redSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token: redToken },
            });

            redSocket.on('connect', () => {
                redSocket.emit('createRoom', { deckId: 999999 }); // Invalid deck ID
            });

            redSocket.on('error', (data) => {
                try {
                    expect(data.message).toBeDefined();
                    expect(data.message).toContain('Deck introuvable');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            redSocket.on('roomCreated', () => {
                reject(new Error('Room should not be created with invalid deck'));
            });

            setTimeout(() => reject(new Error('Test timeout')), 5000);
        });
    });

    it('should clean up room when player disconnects', async () => {
        return new Promise<void>(async (resolve, reject) => {
            let roomId: string;

            // Red creates room
            redSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token: redToken },
            });

            redSocket.on('connect', () => {
                redSocket.emit('createRoom', { deckId: redDeckId });
            });

            redSocket.on('roomCreated', (data) => {
                roomId = data.roomId;

                // Disconnect red
                redSocket.disconnect();

                // Give some time for cleanup
                setTimeout(() => {
                    // Blue tries to get rooms
                    blueSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                        auth: { token: blueToken },
                    });

                    blueSocket.on('connect', () => {
                        blueSocket.emit('getRooms');
                    });

                    blueSocket.on('roomsList', (data) => {
                        try {
                            const room = data.rooms.find((r: any) => r.roomId === roomId);
                            expect(room).toBeUndefined();
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });

                    blueSocket.on('error', (error) => {
                        reject(new Error(error.message));
                    });
                }, 500);
            });

            redSocket.on('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => reject(new Error('Test timeout')), 5000);
        });
    });
});
