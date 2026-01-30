import {Request, Response, Router} from 'express'
import {prisma} from "../database";


export const cardsRouter = Router()

cardsRouter.get('/', async (_req: Request, res: Response) => {
try {

    const listCards = await prisma.card.findMany({
            orderBy: {
                pokedexNumber: 'asc'
            }
        })
            
    return res.status(200).json(listCards)
    
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error)
        return res.status(500).json({error: 'Erreur serveur'})
    }
})
