import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Charge et fusionne toutes les documentations Swagger
 */
export function loadSwaggerDocs() {
    const docsPath = path.join(__dirname, 'docs');
    
    // Charger la configuration principale
    const configPath = path.join(docsPath, 'swagger.config.yml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
    
    // Charger les documentations des modules
    const authDoc = yaml.load(fs.readFileSync(path.join(docsPath, 'auth.doc.yml'), 'utf8')) as any;
    const cardDoc = yaml.load(fs.readFileSync(path.join(docsPath, 'card.doc.yml'), 'utf8')) as any;
    const deckDoc = yaml.load(fs.readFileSync(path.join(docsPath, 'deck.doc.yml'), 'utf8')) as any;
    
    // Fusionner tous les paths
    const allPaths = {
        ...authDoc.paths,
        ...cardDoc.paths,
        ...deckDoc.paths,
    };
    
    // Créer la documentation complète
    const swaggerDocument = {
        ...config,
        paths: allPaths,
    };
    
    return swaggerDocument;
}
