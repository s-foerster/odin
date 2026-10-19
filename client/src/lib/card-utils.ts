import { Card, CardColor } from "@shared/schema";

export interface SelectedCard extends Card {
  selected: boolean;
}

// Get color class based on card color
export function getCardColorClass(color: CardColor): string {
  switch (color) {
    case "red":
      return "bg-[#e53935] text-white";
    case "blue":
      return "bg-[#1e88e5] text-white";
    case "green":
      return "bg-[#43a047] text-white";
    case "yellow":
      return "bg-[#fdd835] text-slate-900";
    case "purple":
      return "bg-[#8e24aa] text-white";
    case "orange":
      return "bg-[#fb8c00] text-white";
    default:
      return "bg-primary text-primary-foreground";
  }
}

// Get symbol for card color
export function getCardSymbol(color: CardColor): string {
  switch (color) {
    case "red":
      return "♥";
    case "blue":
      return "♦";
    case "green":
      return "♣";
    case "yellow":
      return "★";
    case "purple":
      return "◆";
    case "orange":
      return "✦";
    default:
      return "•";
  }
}

// Check if a set of cards is valid to play together
export function isValidCardSet(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  
  // All cards must have the same value or same color
  const firstCard = cards[0];
  const allSameValue = cards.every(card => card.value === firstCard.value);
  const allSameColor = cards.every(card => card.color === firstCard.color);
  
  return allSameValue || allSameColor;
}

// Check if a new card can be added to the currently selected cards
export function canAddCardToSelection(card: Card, selectedCards: Card[]): boolean {
  if (selectedCards.length === 0) return true;
  
  const firstCard = selectedCards[0];
  
  // Can add if same value or same color as already selected cards
  return card.value === firstCard.value || card.color === firstCard.color;
}

// Sort cards by value then color
export function sortCardsByValue(cards: Card[]): Card[] {
  const colorOrder: Record<CardColor, number> = { red: 0, orange: 1, yellow: 2, green: 3, blue: 4, purple: 5 };
  return [...cards].sort((a, b) => b.value - a.value || colorOrder[a.color] - colorOrder[b.color]);
}

// Sort cards by color then value
export function sortCards(cards: Card[]): Card[] {
  const colorOrder: Record<CardColor, number> = {
    "red": 0,
    "orange": 1,
    "yellow": 2,
    "green": 3,
    "blue": 4,
    "purple": 5
  };
  
  return [...cards].sort((a, b) => {
    if (a.color !== b.color) {
      return colorOrder[a.color] - colorOrder[b.color];
    }
    return a.value - b.value;
  });
}

// Group cards by color
export function groupCardsByColor(cards: Card[]): Record<CardColor, Card[]> {
  const groups: Record<CardColor, Card[]> = {
    "red": [],
    "orange": [],
    "yellow": [],
    "green": [],
    "blue": [],
    "purple": []
  };
  
  for (const card of cards) {
    groups[card.color].push(card);
  }
  
  // Sort by value within each group
  for (const color in groups) {
    groups[color as CardColor].sort((a, b) => a.value - b.value);
  }
  
  return groups;
}

// Group cards by value
export function groupCardsByValue(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  
  for (const card of cards) {
    const value = card.value.toString();
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(card);
  }
  
  // Sort by color within each group
  for (const value in groups) {
    groups[value].sort((a, b) => {
      const colorOrder: Record<CardColor, number> = {
        "red": 0,
        "orange": 1,
        "yellow": 2,
        "green": 3,
        "blue": 4,
        "purple": 5
      };
      return colorOrder[a.color] - colorOrder[b.color];
    });
  }
  
  return groups;
}
