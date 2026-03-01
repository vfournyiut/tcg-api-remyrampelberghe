import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { env } from '../env';

// Étendre les types Socket.io pour ajouter les informations utilisateur
declare module 'socket.io' {
    interface Socket {
        userId?: number;
        email?: string;
    }
}

/**
 * Middleware d'authentification pour Socket.io
 * Vérifie le token JWT envoyé dans socket.handshake.auth.token
 */
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
    // 1. Récupérer le token depuis handshake.auth
    const token = socket.handshake.auth.token;

    // 2. Vérifier si le token est présent
    if (!token) {
        return next(new Error('Token manquant'));
    }

    try {
        // 3. Vérifier et décoder le token JWT
        const decoded = jwt.verify(token, env.JWT_SECRET) as {
            userId: number;
            email: string;
        };

        // 4. Injecter les informations utilisateur dans le socket
        socket.userId = decoded.userId;
        socket.email = decoded.email;

        // 5. Autoriser la connexion
        next();
    } catch (error) {
        // 6. Refuser la connexion si le token est invalide
        return next(new Error('Token invalide ou expiré'));
    }
};
