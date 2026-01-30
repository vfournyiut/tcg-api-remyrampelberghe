import {NextFunction, Request, Response} from 'express'
import jwt from 'jsonwebtoken'
import {env} from '../env'

// Étendre le type Request pour ajouter user
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number
                email: string
            }
        }
    }
}

/**
 * Vérifie le token JWT et ajoute userId à la requête
 */
export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    // 1. Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Format: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({error: 'Token manquant'})
    }

    try {
        // 2. Vérifier et décoder le token
        const decoded = jwt.verify(token, env.JWT_SECRET) as {
            userId: number
            email: string
        }

        // 3. Ajouter user à la requête pour l'utiliser dans les routes
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        }

        // 4. Passer au prochain middleware ou à la route
        return next()
    } catch (error) {
        return res.status(401).json({error: 'Token invalide ou expiré'})
    }
}