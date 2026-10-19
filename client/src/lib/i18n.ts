import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { uiEn, uiFr } from "./i18n-ui";

// Translation resources
const resources = {
  en: {
    translation: {
      // Home screen
      "app.title": "Odin Card Game",
      "app.description":
        "A turn-based multiplayer card game where strategy meets luck.",
      "button.createGame": "Create Game",
      "button.joinGame": "Join Game",
      "howToPlay.title": "How to Play",
      "howToPlay.rule1":
        "Players are dealt cards from a 54-card deck (6 colors, numbered 1-9). Up to 6 players get 9 cards each, larger games get fewer cards.",
      "howToPlay.rule2":
        "On your turn, play one or more cards of the same number or color.",
      "howToPlay.rule3":
        "Other players must match with higher value cards or pass.",
      "howToPlay.rule4": "After a play, pick up one card from previous play.",
      "howToPlay.rule5": "First to empty their hand wins the round.",
      "howToPlay.rule6": "Score 1 point per card left in hand.",
      "howToPlay.rule7": "Game ends when a player reaches the point limit.",

      // Join/Create screens
      "create.title": "Create Game",
      "create.nameLabel": "Your Name",
      "create.namePlaceholder": "Enter your name",
      "create.pointsLimit": "Points Limit",
      "create.dealCards": "Deal Cards",
      "create.startGame": "Start Game",
      "create.creating": "Creating...",
      "create.shareCode": "Share this code with friends:",
      "create.copyCode": "Copy Code",
      "create.goToLobby": "Go to Lobby",
      "create.nameRequired": "Name required",
      "create.pleaseEnterName": "Please enter your name",
      "create.failedToCreate": "Failed to create game",
      "create.tryAgain": "Please try again",
      "create.copied": "Copied!",
      "create.codeCopied": "Room code copied to clipboard",
      "join.title": "Join Game",
      "join.roomCode": "Room Code",
      "join.roomCodePlaceholder": "Enter room code",
      "join.joinGame": "Join Game",
      "join.back": "Back",
      "join.joining": "Joining...",
      "join.nameRequired": "Please enter your name",
      "join.codeRequired": "Please enter a room code",
      "join.gameFull": "Game is full (maximum 27 players)",
      "join.invalidCode": "Invalid room code or game not found",
      "join.joinAsSpectator": "Join as Spectator",
      "join.gameFinishedError": "This game has already finished",
      "join.spectateTitle": "Join as Spectator?",
      "join.spectateDescription":
        "This game is already in progress. Would you like to join as a spectator?",
      "common.no": "No",
      "common.yes": "Yes",

      // Game screens
      "game.players": "Players",
      "game.yourTurn": "Your Turn",
      "game.waitingTurn": "Waiting for your turn...",
      "game.playCards": "Play Cards",
      "game.pass": "Pass",
      "game.round": "Round {{round}}",
      "game.score": "Score: {{score}}",
      "game.chat": "Chat",
      "game.send": "Send",
      "game.lobby": "Lobby",
      "game.waitingForPlayers": "Waiting for players to join...",
      "game.startGame": "Start Game",
      "game.leaveLobby": "Leave Lobby",
      "game.youAreHost": "You are the host",
      "game.leaveGame": "Leave Game",
      "game.loading": "Loading lobby...",
      "game.errorTitle": "Error Loading Lobby",
      "game.errorMessage":
        "Unable to join the game lobby. The game may no longer exist.",
      "game.backToHome": "Back to Home",
      "game.notEnoughPlayers": "Not enough players",
      "game.needTwoPlayers": "You need at least 2 players to start the game",
      "game.playerYou": "You",
      "game.playerHost": "Host",
      "game.roundComplete": "Round Complete!",
      "game.hasEmptiedHand": "has emptied their hand",
      "game.roundScores": "Round Scores",
      "game.startNextRound": "Start Next Round",
      "game.starting": "Starting...",
      "game.waitingForHost": "Waiting for host to start the next round...",
      "game.winner": "Winner!",
      "game.cards": "cards",
      "game.points": "points",
      "game.spectating": "Spectating Mode",
      "game.playerSpectator": "Spectator",
      "game.toggleSpectatorMode": "Toggle Spectator Mode",
      "game.youAreSpectating": "You are spectating",
      "game.switchToPlayer": "Switch to Player",
      "game.switchToSpectator": "Switch to Spectator",

      // Game screen additional texts
      "game.title": "Odin Game",
      "game.loadingGame": "Loading game...",
      "game.errorLoadingGame": "Error Loading Game",
      "game.errorDefault":
        "Unable to join the game. The game may no longer exist.",
      "game.errorGeneric": "Error",
      "game.errorPlayerNotFound":
        "Could not find your player data in the game.",
      "game.connectionStatus.connected": "Connected",
      "game.connectionStatus.connecting": "Connecting...",
      "game.connectionStatus.reconnecting": "Reconnecting...",
      "game.connectionStatus.disconnected": "Disconnected",
      "game.reconnectingMessage": "Reconnecting...",
      "game.reconnectingDescription":
        "Attempting to reconnect to the game server.",
      "game.connectionLost": "Connection lost. Game updates may be delayed.",
      "game.reconnect": "Reconnect",
      "game.soundToggle.enable": "Enable sounds",
      "game.soundToggle.disable": "Disable sounds",
      "game.rules.title": "Game Rules",
      "game.rules.description":
        "Play cards of same color or value. You can play the same number OR one more card than previous play. Higher value beats previous play. Empty your hand to win!",
      "game.previousPlay": "Previous Play",
      "game.noPreviousPlay": "No previous play",
      "game.dragCards": "Drag and drop cards here to play",
      "game.waitingForPlay": "Waiting for other player to play",
      "game.playerTurn": "{{playerName}}'s turn",
      "game.playHigherValue":
        "Play {{current}} or {{next}} cards of higher value",
      "game.playAnyCards": "Play any cards of same color or value",
      "game.waitingForTurn": "Waiting for other player to take their turn",
      "game.yourHand": "Your Hand",
      "game.noCards": "No cards in hand",
      "game.moreCards": "+{{count}} more",
      "game.error.failedPickCard": "Failed to pick card",
      "game.error.failedPass": "Failed to pass",
      "game.error.failedStartRound": "Failed to start new round",
      "game.error.tryAgain": "Please try again",
      "game.error.connectionError": "Connection Error",
      "game.error.connectionFailed":
        "Failed to connect to game server. Please try refreshing the page.",
      "game.error.notPlayer": "You are not a player in this game",
      "game.error.invalidSelection": "Invalid selection",
      "game.error.sameColorOrValue":
        "All cards must be the same color or same value",
      "game.error.notInHand": "Some selected cards are not in your hand",
      "game.error.noCardsSelected": "No cards selected",
      "game.error.selectCards": "Select one or more cards to play",
      "game.leaveConfirm": "Are you sure you want to leave the game?",
      "game.sessionEnded": "Game session ended",
      "game.sessionExpired":
        "The game was not found or your session expired. Redirecting to home.",

      // Language
      language: "Language",
      "language.english": "English",
      "language.french": "Français",

      // Server error messages
      "error.game.notFound": "Game not found",
      "error.game.alreadyStarted": "Game has already started",
      "error.game.notInProgress": "Game is not in progress",
      "error.game.full": "Game is full",
      "error.game.notEnoughPlayers": "Not enough players to start the game",
      "error.game.cannotPass": "You cannot pass when no cards have been played",
      "error.game.invalidAction": "Invalid action",

      "error.player.notFound": "Player not found",
      "error.player.nameAlreadyTaken": "This name is already taken",
      "error.player.notYourTurn": "It's not your turn",

      "error.card.notInHand": "Card not in your hand",
      "error.card.notFound": "Card not found",
      "error.card.mustPlayCards": "You must play at least one card",
      "error.card.mustPlaySameType":
        "All cards must be the same value or the same color",
      "error.card.mustPlayHigherValue":
        "Your play must have a higher value than the current play",
      "error.card.mustPlayExactCount":
        "You must play the exact number of cards required",
      "error.card.mustPlayFirstCard":
        "Must play exactly one card on the first turn of the round",

      "error.server.internal": "Internal server error",

      // Active game banner
      home: {
        activeGame: "Active Game",
        resumeGame: "Resume Game",
        roomCode: "Room Code",
      },
    },
  },
  fr: {
    translation: {
      // Écran d'accueil
      "app.title": "Jeu de Cartes Odin",
      "app.description":
        "Un jeu de cartes multijoueur au tour par tour où stratégie et chance se rencontrent.",
      "button.createGame": "Créer une Partie",
      "button.joinGame": "Rejoindre une Partie",
      "howToPlay.title": "Comment Jouer",
      "howToPlay.rule1":
        "Les joueurs reçoivent des cartes d'un jeu de 54 cartes (6 couleurs, numérotées de 1 à 9). Jusqu'à 6 joueurs reçoivent 9 cartes chacun, les parties plus grandes reçoivent moins de cartes.",
      "howToPlay.rule2":
        "À votre tour, jouez une ou plusieurs cartes du même numéro ou de la même couleur.",
      "howToPlay.rule3":
        "Les autres joueurs doivent suivre avec des cartes de valeur supérieure ou passer leur tour.",
      "howToPlay.rule4": "Après avoir joué, prenez une carte du jeu précédent.",
      "howToPlay.rule5": "Le premier à vider sa main gagne la manche.",
      "howToPlay.rule6": "Marquez 1 point par carte restante en main.",
      "howToPlay.rule7":
        "La partie se termine lorsqu'un joueur atteint la limite de points.",

      // Écrans Rejoindre/Créer
      "create.title": "Créer une Partie",
      "create.nameLabel": "Votre Nom",
      "create.namePlaceholder": "Entrez votre nom",
      "create.pointsLimit": "Limite de Points",
      "create.dealCards": "Distribuer les Cartes",
      "create.startGame": "Commencer la Partie",
      "create.creating": "Création en cours...",
      "create.shareCode": "Partagez ce code avec vos amis :",
      "create.copyCode": "Copier le Code",
      "create.goToLobby": "Aller au Salon",
      "create.nameRequired": "Nom requis",
      "create.pleaseEnterName": "Veuillez entrer votre nom",
      "create.failedToCreate": "Échec de la création de la partie",
      "create.tryAgain": "Veuillez réessayer",
      "create.copied": "Copié !",
      "create.codeCopied": "Code de salon copié dans le presse-papiers",
      "join.title": "Rejoindre une Partie",
      "join.roomCode": "Code de Salle",
      "join.roomCodePlaceholder": "Entrez le code de salle",
      "join.joinGame": "Rejoindre la Partie",
      "join.back": "Retour",
      "join.joining": "Connexion en cours...",
      "join.nameRequired": "Veuillez entrer votre nom",
      "join.codeRequired": "Veuillez entrer un code de salle",
      "join.gameFull": "La partie est complète (maximum 27 joueurs)",
      "join.invalidCode": "Code de salle invalide ou partie introuvable",
      "join.joinAsSpectator": "Rejoindre en tant que Spectateur",
      "join.gameFinishedError": "Cette partie est déjà terminée",
      "join.spectateTitle": "Rejoindre en tant que spectateur ?",
      "join.spectateDescription":
        "Cette partie est déjà en cours. Voulez-vous rejoindre en tant que spectateur ?",

      // Écrans de jeu
      "game.players": "Joueurs",
      "game.yourTurn": "Votre Tour",
      "game.waitingTurn": "En attente de votre tour...",
      "game.playCards": "Jouer les Cartes",
      "game.pass": "Passer",
      "game.round": "Manche {{round}}",
      "game.score": "Score: {{score}}",
      "game.chat": "Chat",
      "game.send": "Envoyer",
      "game.lobby": "Salon",
      "game.waitingForPlayers": "En attente d'autres joueurs...",
      "game.startGame": "Commencer la Partie",
      "game.leaveLobby": "Quitter le Salon",
      "game.youAreHost": "Vous êtes l'hôte",
      "game.leaveGame": "Quitter la Partie",
      "game.loading": "Chargement du salon...",
      "game.errorTitle": "Erreur de Chargement du Salon",
      "game.errorMessage":
        "Impossible de rejoindre le salon de jeu. La partie n'existe peut-être plus.",
      "game.backToHome": "Retour à l'Accueil",
      "game.notEnoughPlayers": "Pas assez de joueurs",
      "game.needTwoPlayers":
        "Vous avez besoin d'au moins 2 joueurs pour commencer la partie",
      "game.playerYou": "Vous",
      "game.playerHost": "Hôte",
      "game.roundComplete": "Manche Terminée !",
      "game.hasEmptiedHand": "a vidé sa main",
      "game.roundScores": "Scores de la Manche",
      "game.startNextRound": "Commencer la Prochaine Manche",
      "game.starting": "Démarrage...",
      "game.waitingForHost":
        "En attente de l'hôte pour commencer la prochaine manche...",
      "game.winner": "Gagnant !",
      "game.cards": "cartes",
      "game.points": "points",
      "game.spectating": "En mode Spectateur",
      "game.playerSpectator": "Spectateur",
      "game.toggleSpectatorMode": "Basculer le Mode Spectateur",
      "game.youAreSpectating": "Vous êtes en mode spectateur",
      "game.switchToPlayer": "Passer en Joueur",
      "game.switchToSpectator": "Passer en Spectateur",

      // Textes supplémentaires pour l'écran de jeu
      "game.title": "Jeu Odin",
      "game.loadingGame": "Chargement du jeu...",
      "game.errorLoadingGame": "Erreur de Chargement du Jeu",
      "game.errorDefault":
        "Impossible de rejoindre le jeu. La partie n'existe peut-être plus.",
      "game.errorGeneric": "Erreur",
      "game.errorPlayerNotFound":
        "Impossible de trouver vos données de joueur dans la partie.",
      "game.connectionStatus.connected": "Connecté",
      "game.connectionStatus.connecting": "Connexion en cours...",
      "game.connectionStatus.reconnecting": "Reconnexion en cours...",
      "game.connectionStatus.disconnected": "Déconnecté",
      "game.reconnectingMessage": "Reconnexion...",
      "game.reconnectingDescription":
        "Tentative de reconnexion au serveur de jeu.",
      "game.connectionLost":
        "Connexion perdue. Les mises à jour du jeu peuvent être retardées.",
      "game.reconnect": "Reconnecter",
      "game.soundToggle.enable": "Activer les sons",
      "game.soundToggle.disable": "Désactiver les sons",
      "game.rules.title": "Règles du Jeu",
      "game.rules.description":
        "Jouez des cartes de même couleur ou valeur. Vous pouvez jouer le même nombre OU une carte de plus que le jeu précédent. Une valeur plus élevée bat le jeu précédent. Videz votre main pour gagner !",
      "game.previousPlay": "Jeu Précédent",
      "game.noPreviousPlay": "Pas de jeu précédent",
      "game.dragCards": "Glissez et déposez les cartes ici pour jouer",
      "game.waitingForPlay": "En attente du jeu de l'autre joueur",
      "game.playerTurn": "Tour de {{playerName}}",
      "game.playHigherValue":
        "Jouez {{current}} ou {{next}} cartes de valeur supérieure",
      "game.playAnyCards":
        "Jouez n'importe quelles cartes de même couleur ou valeur",
      "game.waitingForTurn": "En attente que l'autre joueur prenne son tour",
      "game.yourHand": "Votre Main",
      "game.noCards": "Pas de cartes en main",
      "game.moreCards": "+{{count}} de plus",
      "game.error.failedPickCard": "Échec de la sélection de carte",
      "game.error.failedPass": "Échec du passage",
      "game.error.failedStartRound": "Échec du démarrage de la nouvelle manche",
      "game.error.tryAgain": "Veuillez réessayer",
      "game.error.connectionError": "Erreur de Connexion",
      "game.error.connectionFailed":
        "Échec de la connexion au serveur de jeu. Veuillez rafraîchir la page.",
      "game.error.notPlayer": "Vous n'êtes pas un joueur dans cette partie",
      "game.error.invalidSelection": "Sélection invalide",
      "game.error.sameColorOrValue":
        "Toutes les cartes doivent être de même couleur ou de même valeur",
      "game.error.notInHand":
        "Certaines cartes sélectionnées ne sont pas dans votre main",
      "game.error.noCardsSelected": "Aucune carte sélectionnée",
      "game.error.selectCards": "Sélectionnez une ou plusieurs cartes à jouer",
      "game.leaveConfirm": "Êtes-vous sûr de vouloir quitter la partie ?",
      "game.sessionEnded": "Session de jeu terminée",
      "game.sessionExpired":
        "La partie n'a pas été trouvée ou votre session a expiré. Redirection vers l'accueil.",
      "common.no": "Non",
      "common.yes": "Oui",

      // Langue
      language: "Langue",
      "language.english": "English",
      "language.french": "Français",

      // Server error messages
      "error.game.notFound": "Partie introuvable",
      "error.game.alreadyStarted": "La partie a déjà commencé",
      "error.game.notInProgress": "La partie n'est pas en cours",
      "error.game.full": "La partie est complète",
      "error.game.notEnoughPlayers":
        "Pas assez de joueurs pour commencer la partie",
      "error.game.cannotPass":
        "Vous ne pouvez pas passer quand aucune carte n'a été jouée",
      "error.game.invalidAction": "Action invalide",

      "error.player.notFound": "Joueur introuvable",
      "error.player.nameAlreadyTaken": "Ce nom est déjà pris",
      "error.player.notYourTurn": "Ce n'est pas votre tour",

      "error.card.notInHand": "La carte n'est pas dans votre main",
      "error.card.notFound": "Carte introuvable",
      "error.card.mustPlayCards": "Vous devez jouer au moins une carte",
      "error.card.mustPlaySameType":
        "Toutes les cartes doivent être de la même valeur ou de la même couleur",
      "error.card.mustPlayHigherValue":
        "Votre jeu doit avoir une valeur supérieure au jeu actuel",
      "error.card.mustPlayExactCount":
        "Vous devez jouer le nombre exact de cartes requis",
      "error.card.mustPlayFirstCard":
        "Vous devez jouer exactement une carte au premier tour de la manche",

      "error.server.internal": "Erreur interne du serveur",

      // Bannière de partie en cours
      home: {
        activeGame: "Partie en cours",
        resumeGame: "Reprendre la partie",
        roomCode: "Code de la salle",
      },
    },
  },
};

// Textes de la nouvelle interface (remplacent les anciens si même clé)
Object.assign(resources.en.translation, uiEn);
Object.assign(resources.fr.translation, uiFr);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    debug: process.env.NODE_ENV === "development",
    interpolation: {
      escapeValue: false, // not needed for React
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
