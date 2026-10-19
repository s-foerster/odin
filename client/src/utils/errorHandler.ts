import { t } from 'i18next';

export interface ServerError {
  code?: string;
  message: string;
}

export interface ApiResponse {
  success: boolean;
  error?: ServerError;
  data?: any;
}

/**
 * Handles API error responses and returns a translated error message.
 * If the error response contains an error code, it will use that code as a translation key.
 * Otherwise, it will attempt to match the error message to a known error pattern.
 * If no match is found, it will return the raw error message.
 */
export function handleApiError(response: ApiResponse | string): string {
  // If it's already a string, just return it
  if (typeof response === 'string') {
    return mapErrorToTranslationKey(response);
  }

  // Réponse simple { message } (routes de jeu) : le message est souvent une clé de traduction
  const plain = response as unknown as { message?: string; error?: unknown };
  if (typeof plain.message === 'string' && !plain.error) {
    return mapErrorToTranslationKey(plain.message);
  }

  // Check if it's an API response with error data
  if (!response.success && response.error) {
    // If the error has a code, use it as the translation key
    if (response.error.code) {
      return t(response.error.code);
    }
    
    // Otherwise try to map the raw error message to a translation key
    return mapErrorToTranslationKey(response.error.message);
  }
  
  // Generic error fallback
  return t('error.server.internal');
}

/**
 * Maps common error messages to translation keys based on pattern matching.
 * This is a fallback for when the server doesn't provide a structured error code.
 */
function mapErrorToTranslationKey(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'Game not found': 'error.game.notFound',
    'Game has already started': 'error.game.alreadyStarted',
    'Game is not in progress': 'error.game.notInProgress',
    'Game is full': 'error.game.full',
    'Not enough players': 'error.game.notEnoughPlayers',
    'You cannot pass when no cards have been played': 'error.game.cannotPass',
    
    'Player not found': 'error.player.notFound',
    'Name already taken': 'error.player.nameAlreadyTaken',
    'Not your turn': 'error.player.notYourTurn',
    
    'Card not in player\'s hand': 'error.card.notInHand',
    'Card not found': 'error.card.notFound',
    'You must play at least one card': 'error.card.mustPlayCards',
    'All cards played must be the same value or the same color': 'error.card.mustPlaySameType',
    'Must play exactly one card on the first turn of the round': 'error.card.mustPlayFirstCard'
  };

  // Le serveur envoie directement une clé de traduction (ex. "error.card.mustPlayHigherValue")
  if (/^error\.[a-zA-Z.]+$/.test(errorMessage)) {
    return t(errorMessage);
  }

  // Look for exact matches
  if (errorMap[errorMessage]) {
    return t(errorMap[errorMessage]);
  }

  // Look for partial matches
  for (const [pattern, translationKey] of Object.entries(errorMap)) {
    if (errorMessage.includes(pattern)) {
      return t(translationKey);
    }
  }

  // Special case for higher value errors which can have variable content
  if (errorMessage.includes('must be higher than') || errorMessage.includes('higher value')) {
    return t('error.card.mustPlayHigherValue');
  }

  // Special case for exact card count errors
  if (errorMessage.includes('Must play') && errorMessage.includes('card(s)')) {
    return t('error.card.mustPlayExactCount');
  }

  // If no mapping found, return the original error message
  return errorMessage;
}
