# Authentification Socket.io - Documentation

## Vue d'ensemble

Le système d'authentification Socket.io a été implémenté avec JWT pour sécuriser toutes les connexions WebSocket.

## Architecture

### 1. Middleware d'authentification (`src/auth/socket.auth.middleware.ts`)

Le middleware vérifie le token JWT envoyé lors de la connexion Socket.io et injecte les informations utilisateur dans l'objet socket.

**Fonctionnalités :**
- ✅ Vérification du token JWT dans `socket.handshake.auth.token`
- ✅ Refus de connexion sans token (erreur : "Token manquant")
- ✅ Refus de connexion avec token invalide (erreur : "Token invalide ou expiré")
- ✅ Injection de `userId` et `email` dans le socket après authentification réussie

### 2. Configuration du serveur (`src/index.ts`)

Socket.io est intégré au serveur HTTP avec :
- Configuration CORS appropriée
- Application du middleware d'authentification à toutes les connexions
- Gestion des événements de connexion/déconnexion avec logs

### 3. Tests (`tests/socket.auth.test.ts`)

Suite de tests complète couvrant :
- Refus de connexion sans token
- Refus de connexion avec token invalide
- Acceptation de connexion avec token valide
- Vérification des informations utilisateur injectées

## Installation

Installez les dépendances (socket.io-client pour les tests) :

```bash
npm install
```

## Utilisation

### Côté Client

Le client doit envoyer le token JWT via l'option `auth` lors de la connexion :

```javascript
const socket = io('http://localhost:3001', {
    auth: {
        token: 'your-jwt-token-here'
    }
});

socket.on('connect', () => {
    console.log('Connected!');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
});

socket.on('authenticated', (data) => {
    console.log('Authenticated:', data);
    // { message: 'Successfully authenticated', userId: 1, email: 'user@example.com' }
});
```

### Côté Serveur

Après authentification, les informations utilisateur sont disponibles dans le socket :

```typescript
io.on('connection', (socket) => {
    // Les propriétés userId et email sont automatiquement injectées
    console.log(`User ${socket.email} connected (ID: ${socket.userId})`);
    
    socket.on('someEvent', (data) => {
        // Utilisez socket.userId et socket.email dans vos handlers
        console.log(`Event from user ${socket.userId}`);
    });
});
```

## Client de Test

Un client HTML est disponible à l'URL racine du serveur pour tester l'authentification :

```bash
npm run dev
# Ouvrir http://localhost:3001
```

Le client permet de :
1. Se connecter avec email/password (récupère automatiquement le JWT)
2. Se connecter avec un token JWT manuel
3. Tester les connexions avec/sans token
4. Visualiser les erreurs d'authentification en temps réel

## Test avec deux utilisateurs

Pour simuler deux joueurs différents :

1. Créer deux comptes (red et blue) via l'API ou Bruno :
```bash
POST /api/auth/sign-up
{
  "email": "red@example.com",
  "username": "red",
  "password": "password123"
}
```

2. Ouvrir deux fenêtres de navigation privée
3. Se connecter avec red@example.com dans la première
4. Se connecter avec blue@example.com dans la seconde
5. Les deux utilisateurs sont maintenant authentifiés avec leurs propres tokens

## Exécution des tests

```bash
npm test
```

Les tests vérifient :
- ✅ Connexion refusée sans token
- ✅ Connexion refusée avec token invalide
- ✅ Connexion acceptée avec token valide
- ✅ Informations utilisateur disponibles dans le socket

## Sécurité

- Tous les tokens sont vérifiés avec la clé secrète JWT (`JWT_SECRET`)
- Les tokens expirés sont automatiquement rejetés
- Les connexions non authentifiées sont immédiatement fermées
- Les informations sensibles ne sont jamais exposées au client

## Événements Socket.io

### Événements système

- `connect` : Connexion établie avec succès
- `disconnect` : Déconnexion
- `connect_error` : Erreur de connexion (authentification échouée)
- `authenticated` : Confirmation d'authentification avec infos utilisateur

### Événements personnalisés

Vous pouvez maintenant implémenter vos événements de jeu en sachant que chaque socket est authentifié et possède `userId` et `email`.

## Exemple d'implémentation d'événement

```typescript
io.on('connection', (socket) => {
    socket.on('CREATE_ROOM', async (data) => {
        // socket.userId est automatiquement disponible
        const room = await createRoom(socket.userId, data.deckId);
        socket.emit('ROOM_CREATED', room);
    });
    
    socket.on('JOIN_ROOM', async (data) => {
        // Vérifiez les permissions avec socket.userId
        if (await canJoinRoom(socket.userId, data.roomId)) {
            socket.join(data.roomId);
            io.to(data.roomId).emit('PLAYER_JOINED', {
                userId: socket.userId,
                email: socket.email
            });
        }
    });
});
```

## Dépannage

### "Token manquant"
Le client n'envoie pas de token. Vérifiez que vous passez bien `auth: { token: '...' }` lors de la connexion.

### "Token invalide ou expiré"
- Vérifiez que le token JWT est valide
- Vérifiez que le token n'est pas expiré (validité : 7 jours)
- Vérifiez que `JWT_SECRET` est identique côté serveur

### "Cannot find module 'socket.io-client'"
Exécutez `npm install` pour installer les dépendances de test.
