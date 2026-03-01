// Types pour les joueurs
export interface Player {
    userId: number;
    username: string;
    email: string;
    socketId: string;
    deckId: number;
    deck: Array<{
        id: number;
        name: string;
        hp: number;
        attack: number;
        type: string;
        imgUrl: string | null;
    }>;
}

// Types pour les rooms
export interface Room {
    roomId: string;
    host: Player;
    guest: Player | null;
    status: 'waiting' | 'playing' | 'finished';
    createdAt: Date;
}

// Types pour l'état du jeu
export interface GameState {
    roomId: string;
    players: {
        [userId: number]: {
            hand: any[];
            board: any[];
            deck: any[];
            hp: number;
        };
    };
    currentTurn: number;
    turnCount: number;
}

// Gestionnaire de rooms en mémoire
class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private userToRoom: Map<number, string> = new Map();

    generateRoomId(): string {
        return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    createRoom(player: Player): Room {
        const roomId = this.generateRoomId();
        const room: Room = {
            roomId,
            host: player,
            guest: null,
            status: 'waiting',
            createdAt: new Date(),
        };

        this.rooms.set(roomId, room);
        this.userToRoom.set(player.userId, roomId);

        return room;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    getAvailableRooms(): Room[] {
        return Array.from(this.rooms.values()).filter(
            (room) => room.status === 'waiting' && room.guest === null
        );
    }

    joinRoom(roomId: string, player: Player): Room | null {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            return null;
        }

        if (room.guest !== null || room.status !== 'waiting') {
            return null; // Room is full or not available
        }

        room.guest = player;
        room.status = 'playing';
        this.userToRoom.set(player.userId, roomId);

        return room;
    }

    getRoomByUserId(userId: number): Room | undefined {
        const roomId = this.userToRoom.get(userId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }

    removeRoom(roomId: string): void {
        const room = this.rooms.get(roomId);
        if (room) {
            this.userToRoom.delete(room.host.userId);
            if (room.guest) {
                this.userToRoom.delete(room.guest.userId);
            }
            this.rooms.delete(roomId);
        }
    }

    leaveRoom(userId: number): void {
        const roomId = this.userToRoom.get(userId);
        if (roomId) {
            this.removeRoom(roomId);
        }
    }
}

export const roomManager = new RoomManager();
