# Système de Matchmaking TCG

## Fonctionnalités implémentées

### Création de room
- Un joueur peut créer une salle d'attente avec l'événement `createRoom`
- Le deck doit contenir exactement 10 cartes
- Le joueur devient automatiquement le host de la room
- Une room ID unique est générée

### Liste des rooms
- Les joueurs peuvent obtenir la liste des rooms disponibles avec `getRooms`
- Seules les rooms en attente d'un second joueur sont retournées
- Affiche le nom d'utilisateur du host pour chaque room

### Rejoindre une room
- Un second joueur peut rejoindre une room existante avec `joinRoom`
- Le joueur devient le guest de la room
- **La partie démarre automatiquement** quand le second joueur rejoint

### Début de partie
- Chaque joueur reçoit un événement `gameStarted`
- Chaque joueur voit sa propre main (5 cartes) mais pas celle de l'adversaire
- L'état initial inclut:
  - Les cartes en main du joueur
  - Le nombre de cartes en main de l'adversaire (pas les cartes elles-mêmes)
  - Le nombre de cartes restantes dans chaque deck
  - Les HP de chaque joueur (20 par défaut)
  - Le tour actuel (commence avec le host)

### Déconnexion
- Si un joueur se déconnecte, la room est automatiquement supprimée
- L'adversaire est notifié via l'événement `playerLeft`

## Test manuel avec le client web

### 1. Démarrer le serveur
```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

### 2. Ouvrir deux fenêtres de navigation privée

**Fenêtre 1 - Joueur Red:**
1. Ouvrir `http://localhost:3001` dans une fenêtre privée
2. Se connecter avec:
   - Email: `red@example.com`
   - Password: `password123`
3. Cliquer sur "Sign In & Connect"
4. Dans la section "CREATE_ROOM", entrer un Deck ID (ex: 1)
5. Cliquer sur "Create Room"
6. Noter le Room ID dans les logs

**Fenêtre 2 - Joueur Blue:**
1. Ouvrir `http://localhost:3001` dans une autre fenêtre privée
2. Se connecter avec:
   - Email: `blue@example.com`
   - Password: `password123`
3. Cliquer sur "Sign In & Connect"
4. Optionnel: Cliquer sur "Get Rooms List" pour voir les rooms disponibles
5. Dans la section "JOIN_ROOM":
   - Entrer le Room ID obtenu par le joueur Red
   - Entrer un Deck ID (ex: 2)
6. Cliquer sur "Join Room"

### 3. Vérifier le début de partie

Dans les logs des deux fenêtres, vous devriez voir:
- Événement `gameStarted` avec l'état initial du jeu
- Le joueur voit ses propres cartes en main
- Le joueur voit seulement le nombre de cartes de l'adversaire

## Événements Socket.io

### Client → Serveur

**createRoom**
```javascript
socket.emit('createRoom', { deckId: number });
```

**getRooms**
```javascript
socket.emit('getRooms');
```

**joinRoom**
```javascript
socket.emit('joinRoom', { roomId: string, deckId: number });
```

### Serveur → Client

**roomCreated**
```javascript
{
  roomId: string,
  host: {
    userId: number,
    username: string
  },
  status: 'waiting'
}
```

**roomsList**
```javascript
{
  rooms: [
    {
      roomId: string,
      host: {
        userId: number,
        username: string
      },
      createdAt: Date
    }
  ]
}
```

**roomsListUpdated**
```javascript
{
  rooms: [...] // Même structure que roomsList
}
```

**gameStarted**
```javascript
{
  roomId: string,
  player: {
    userId: number,
    username: string,
    hand: Card[],  // 5 cartes visibles
    board: [],
    deckCount: number,  // Cartes restantes dans le deck
    hp: number
  },
  opponent: {
    userId: number,
    username: string,
    handCount: number,  // Seulement le nombre, pas les cartes
    board: [],
    deckCount: number,
    hp: number
  },
  currentTurn: number,  // userId du joueur dont c'est le tour
  turnCount: number
}
```

**error**
```javascript
{
  message: string
}
```

**playerLeft**
```javascript
{
  message: 'Votre adversaire a quitté la partie'
}
```

## Architecture

### Fichiers créés

- `src/game/room.manager.ts` - Gestionnaire de rooms (singleton)
- `src/game/game.handlers.ts` - Handlers Socket.io pour les événements de matchmaking
- `src/index.ts` - Intégration des handlers dans le serveur Socket.io
- `tests/matchmaking.test.ts` - Tests d'intégration (nécessite configuration supplémentaire)

### Gestion des rooms

Les rooms sont stockées en mémoire dans le `RoomManager`:
- Map `rooms` pour stocker les rooms par ID
- Map `userToRoom` pour retrouver rapidement la room d'un utilisateur
- Génération automatique d'ID uniques (8 caractères alphanumériques)

### Validation

Les validations suivantes sont effectuées:
- Le deck existe et appartient à l'utilisateur
- Le deck contient exactement 10 cartes
- L'utilisateur n'est pas déjà dans une room
- La room existe et est disponible (pour joinRoom)
- L'utilisateur ne rejoint pas sa propre room

## Prochaines étapes

Les fonctionnalités suivantes peuvent être ajoutées:
- Actions de jeu (jouer une carte, attaquer, passer son tour)
- Gestion des tours
- Système de combat
- Victoire/défaite
- Système de pioche
