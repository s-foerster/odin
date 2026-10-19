export enum ErrorCode {
  // Game-related errors
  GAME_NOT_FOUND = 'error.game.notFound',
  GAME_ALREADY_STARTED = 'error.game.alreadyStarted',
  GAME_NOT_IN_PROGRESS = 'error.game.notInProgress',
  GAME_FULL = 'error.game.full',
  NOT_ENOUGH_PLAYERS = 'error.game.notEnoughPlayers',
  
  // Player-related errors
  PLAYER_NOT_FOUND = 'error.player.notFound',
  NAME_ALREADY_TAKEN = 'error.player.nameAlreadyTaken',
  NOT_YOUR_TURN = 'error.player.notYourTurn',
  
  // Card-related errors
  CARD_NOT_IN_HAND = 'error.card.notInHand',
  CARD_NOT_FOUND = 'error.card.notFound',
  MUST_PLAY_CARDS = 'error.card.mustPlayCards',
  MUST_PLAY_SAME_TYPE = 'error.card.mustPlaySameType',
  MUST_PLAY_HIGHER_VALUE = 'error.card.mustPlayHigherValue',
  MUST_PLAY_EXACT_COUNT = 'error.card.mustPlayExactCount',
  MUST_PLAY_FIRST_CARD = 'error.card.mustPlayFirstCard',
  
  // Other errors
  CANNOT_PASS = 'error.game.cannotPass',
  MUST_PLAY_TWO_PLAYERS = 'error.game.mustPlayTwoPlayers',
  PICK_PENDING = 'error.game.pickPending',
  INVALID_ACTION = 'error.game.invalidAction',
  SERVER_ERROR = 'error.server.internal',
  GAME_FINISHED = 'This game has already finished',
  CANNOT_JOIN_WAITING_AS_SPECTATOR = "Cannot join a waiting game as a spectator",
  GAME_IN_PROGRESS_SPECTATE_OFFER = "Game in progress, join as spectator?",
  UNKNOWN_ERROR = "An unknown error occurred"
}
