import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GameScore {
  name: string;
  score: number;
}

interface GameEndModalProps {
  winnerName: string;
  scores: GameScore[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}

const GameEndModal: React.FC<GameEndModalProps> = ({
  winnerName,
  scores,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-lg bg-card p-5 shadow-lg">
        <div className="mb-4 text-center">
          <span className="mb-2 inline-flex rounded-full bg-amber-100 p-3 text-amber-600">
            <Trophy className="h-8 w-8" />
          </span>
          <h3 className="text-xl font-semibold">{t("ui.end.title")}</h3>
          <p className="text-muted-foreground">{t("ui.end.winner", { name: winnerName })}</p>
        </div>

        <ul className="mb-5 space-y-1 rounded-lg bg-muted p-3">
          {scores.map((score, index) => (
            <li key={index} className="flex justify-between">
              <span className={index === 0 ? "font-semibold" : ""}>
                {index + 1}. {score.name}
              </span>
              <span className="tabular-nums">
                {score.score} {t("ui.pts")}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Button className="h-11 w-full" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          <Button variant="outline" className="h-11 w-full" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameEndModal;
