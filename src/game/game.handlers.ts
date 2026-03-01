import { Server, Socket } from 'socket.io';
import { prisma } from '../database';
import { roomManager, Player } from './room.manager';

/**
 * Handler pour créer une room
 */
export async function handleCreateRoom(
    io: Server,
    socket: Socket,
    data: { deckId: number }
): Promise<void> {
    try {
        const userId = socket.userId!;
        const { deckId } = data;

        // Vérifier que l'utilisateur n'est pas déjà dans une room
        const existingRoom = roomManager.getRoomByUserId(userId);
        if (existingRoom) {
            socket.emit('error', {
                message: 'Vous êtes déjà dans une room',
            });
            return;
        }

        // Vérifier que le deck existe et appartient à l'utilisateur
        const deck = await prisma.deck.findFirst({
            where: {
                id: deckId,
                userId: userId,
            },
            include: {
                cards: {
                    include: {
                        card: true,
                    },
                },
            },
        });

        if (!deck) {
            socket.emit('error', {
                message: 'Deck introuvable ou ne vous appartient pas',
            });
            return;
        }

        // Vérifier que le deck a exactement 10 cartes
        if (deck.cards.length !== 10) {
            socket.emit('error', {
                message: 'Le deck doit contenir exactement 10 cartes',
            });
            return;
        }

        // Récupérer les informations de l'utilisateur
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, email: true },
        });

        if (!user) {
            socket.emit('error', {
                message: 'Utilisateur introuvable',
            });
            return;
        }

        // Créer le player
        const player: Player = {
            userId,
            username: user.username,
            email: user.email,
            socketId: socket.id,
            deckId,
            deck: deck.cards.map((dc) => ({
                id: dc.card.id,
                name: dc.card.name,
                hp: dc.card.hp,
                attack: dc.card.attack,
                type: dc.card.type,
                imgUrl: dc.card.imgUrl,
            })),
        };

        // Créer la room
        const room = roomManager.createRoom(player);

        // Rejoindre la room Socket.io
        socket.join(room.roomId);

        console.log(`🎮 Room created: ${room.roomId} by ${user.username}`);

        // Envoyer la confirmation au créateur
        socket.emit('roomCreated', {
            roomId: room.roomId,
            host: {
                userId: player.userId,
                username: player.username,
            },
            status: 'waiting',
        });

        // Broadcast la liste mise à jour à tous les clients
        io.emit('roomsListUpdated', {
            rooms: roomManager.getAvailableRooms().map((r) => ({
                roomId: r.roomId,
                host: {
                    userId: r.host.userId,
                    username: r.host.username,
                },
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('error', {
            message: 'Erreur lors de la création de la room',
        });
    }
}

/**
 * Handler pour obtenir la liste des rooms
 */
export function handleGetRooms(socket: Socket) {
    const availableRooms = roomManager.getAvailableRooms();

    socket.emit('roomsList', {
        rooms: availableRooms.map((room) => ({
            roomId: room.roomId,
            host: {
                userId: room.host.userId,
                username: room.host.username,
            },
            createdAt: room.createdAt,
        })),
    });
}

/**
 * Handler pour rejoindre une room
 */
export async function handleJoinRoom(
    io: Server,
    socket: Socket,
    data: { roomId: string; deckId: number }
): Promise<void> {
    try {
        const userId = socket.userId!;
        const { roomId, deckId } = data;

        // Vérifier que l'utilisateur n'est pas déjà dans une room
        const existingRoom = roomManager.getRoomByUserId(userId);
        if (existingRoom) {
            socket.emit('error', {
                message: 'Vous êtes déjà dans une room',
            });
            return;
        }

        // Vérifier que la room existe
        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('error', {
                message: 'Room introuvable',
            });
            return;
        }

        // Vérifier que la room n'est pas complète
        if (room.guest !== null || room.status !== 'waiting') {
            socket.emit('error', {
                message: 'Room déjà complète',
            });
            return;
        }

        // Vérifier que le joueur ne rejoint pas sa propre room
        if (room.host.userId === userId) {
            socket.emit('error', {
                message: 'Vous ne pouvez pas rejoindre votre propre room',
            });
            return;
        }

        // Vérifier que le deck existe et appartient à l'utilisateur
        const deck = await prisma.deck.findFirst({
            where: {
                id: deckId,
                userId: userId,
            },
            include: {
                cards: {
                    include: {
                        card: true,
                    },
                },
            },
        });

        if (!deck) {
            socket.emit('error', {
                message: 'Deck introuvable ou ne vous appartient pas',
            });
            return;
        }

        // Vérifier que le deck a exactement 10 cartes
        if (deck.cards.length !== 10) {
            socket.emit('error', {
                message: 'Le deck doit contenir exactement 10 cartes',
            });
            return;
        }

        // Récupérer les informations de l'utilisateur
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, email: true },
        });

        if (!user) {
            socket.emit('error', {
                message: 'Utilisateur introuvable',
            });
            return;
        }

        // Créer le player
        const player: Player = {
            userId,
            username: user.username,
            email: user.email,
            socketId: socket.id,
            deckId,
            deck: deck.cards.map((dc) => ({
                id: dc.card.id,
                name: dc.card.name,
                hp: dc.card.hp,
                attack: dc.card.attack,
                type: dc.card.type,
                imgUrl: dc.card.imgUrl,
            })),
        };

        // Rejoindre la room
        const updatedRoom = roomManager.joinRoom(roomId, player);
        if (!updatedRoom) {
            socket.emit('error', {
                message: 'Impossible de rejoindre la room',
            });
            return;
        }

        // Rejoindre la room Socket.io
        socket.join(roomId);

        console.log(`🎮 Player ${user.username} joined room ${roomId}`);

        // Préparer l'état initial du jeu
        const hostHand = updatedRoom.host.deck.slice(0, 5); // 5 premières cartes
        const hostDeck = updatedRoom.host.deck.slice(5); // Reste du deck

        const guestHand = updatedRoom.guest!.deck.slice(0, 5);
        const guestDeck = updatedRoom.guest!.deck.slice(5);

        // Envoyer gameStarted au host (avec sa main visible)
        io.to(updatedRoom.host.socketId).emit('gameStarted', {
            roomId: updatedRoom.roomId,
            player: {
                userId: updatedRoom.host.userId,
                username: updatedRoom.host.username,
                hand: hostHand,
                board: [],
                deckCount: hostDeck.length,
                hp: 20,
            },
            opponent: {
                userId: updatedRoom.guest!.userId,
                username: updatedRoom.guest!.username,
                handCount: guestHand.length,
                board: [],
                deckCount: guestDeck.length,
                hp: 20,
            },
            currentTurn: updatedRoom.host.userId,
            turnCount: 1,
        });

        // Envoyer gameStarted au guest (avec sa main visible)
        io.to(updatedRoom.guest!.socketId).emit('gameStarted', {
            roomId: updatedRoom.roomId,
            player: {
                userId: updatedRoom.guest!.userId,
                username: updatedRoom.guest!.username,
                hand: guestHand,
                board: [],
                deckCount: guestDeck.length,
                hp: 20,
            },
            opponent: {
                userId: updatedRoom.host.userId,
                username: updatedRoom.host.username,
                handCount: hostHand.length,
                board: [],
                deckCount: hostDeck.length,
                hp: 20,
            },
            currentTurn: updatedRoom.host.userId,
            turnCount: 1,
        });

        // Broadcast la mise à jour de la liste des rooms (room retirée)
        io.emit('roomsListUpdated', {
            rooms: roomManager.getAvailableRooms().map((r) => ({
                roomId: r.roomId,
                host: {
                    userId: r.host.userId,
                    username: r.host.username,
                },
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', {
            message: 'Erreur lors de la jonction de la room',
        });
    }
}

/**
 * Handler pour la déconnexion
 */
export function handleDisconnect(io: Server, socket: Socket) {
    const userId = socket.userId!;
    const room = roomManager.getRoomByUserId(userId);

    if (room) {
        console.log(`🚪 Player left room: ${room.roomId}`);

        // Notifier l'autre joueur
        io.to(room.roomId).emit('playerLeft', {
            message: 'Votre adversaire a quitté la partie',
        });

        // Supprimer la room
        roomManager.removeRoom(room.roomId);

        // Broadcast la mise à jour de la liste des rooms
        io.emit('roomsListUpdated', {
            rooms: roomManager.getAvailableRooms().map((r) => ({
                roomId: r.roomId,
                host: {
                    userId: r.host.userId,
                    username: r.host.username,
                },
                createdAt: r.createdAt,
            })),
        });
    }
}
