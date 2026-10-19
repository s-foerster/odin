import React from "react";
import { Card as CardType } from "@shared/schema";
import { getCardColorClass, getCardSymbol } from "@/lib/card-utils";
import { cn } from "@/lib/utils";

export type CardSize = "hand" | "table" | "pick" | "mini";

interface CardComponentProps {
  card: CardType;
  selected?: boolean;
  showFace?: boolean;
  size?: CardSize;
  onClick?: (card: CardType) => void;
  className?: string;
}

// Largeur fluide : les cartes s'adaptent à l'écran du téléphone
const SIZE_CLASSES: Record<CardSize, { box: string; value: string; corner: string }> = {
  hand: { box: "w-[clamp(2.5rem,11.6vw,4.25rem)]", value: "text-xl sm:text-2xl", corner: "text-[10px] sm:text-xs" },
  table: { box: "w-[clamp(3rem,15vw,4.75rem)]", value: "text-2xl sm:text-3xl", corner: "text-[10px] sm:text-xs" },
  pick: { box: "w-[clamp(3.5rem,19vw,5.25rem)]", value: "text-3xl", corner: "text-xs" },
  mini: { box: "w-7", value: "text-sm", corner: "hidden" },
};

const CardComponent: React.FC<CardComponentProps> = ({
  card,
  selected = false,
  showFace = true,
  size = "hand",
  onClick,
  className,
}) => {
  const sizeClasses = SIZE_CLASSES[size];

  if (!showFace) {
    return <div className={cn("aspect-[2/3] rounded-md bg-primary shadow-sm", sizeClasses.box, className)} />;
  }

  const symbol = getCardSymbol(card.color);
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={cn(
        "relative flex aspect-[2/3] select-none flex-col rounded-lg shadow-md transition-transform duration-150",
        "touch-manipulation",
        sizeClasses.box,
        getCardColorClass(card.color),
        selected && "-translate-y-2 ring-[3px] ring-slate-900 ring-offset-1 ring-offset-white dark:ring-white",
        onClick && "cursor-pointer active:scale-95",
        className,
      )}
      onClick={onClick ? () => onClick(card) : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={`${card.value} ${card.color}`}
      data-card-id={card.id}
    >
      <span className={cn("absolute left-1 top-0.5 leading-none", sizeClasses.corner)}>{symbol}</span>
      <span className={cn("m-auto font-bold leading-none", sizeClasses.value)}>{card.value}</span>
      <span className={cn("absolute bottom-0.5 right-1 leading-none", sizeClasses.corner)}>{symbol}</span>
    </Tag>
  );
};

export default CardComponent;
