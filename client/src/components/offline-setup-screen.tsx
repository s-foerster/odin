import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { PointLimitPicker, readSavedName, saveName, Stepper } from "@/components/form-bits";
import { createLocalGame, loadLocalGame, saveLocalGame } from "@/lib/local-game";

const MAX_TABLE = 8;

export default function OfflineSetupScreen() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const existing = loadLocalGame();
  const canResume = !!existing && existing.state.status !== "finished";

  const [humans, setHumans] = useState<string[]>(() => [readSavedName()]);
  const [bots, setBots] = useState(2);
  const [pointLimit, setPointLimit] = useState(15);

  const setHumanCount = (count: number) => {
    setHumans((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push("");
      return next;
    });
    if (count + bots > MAX_TABLE) setBots(MAX_TABLE - count);
    if (count + bots < 2) setBots(2 - count);
  };

  const total = humans.length + bots;

  const start = () => {
    const names = humans.map((n, i) => n.trim() || t("ui.offline.defaultName", { n: i + 1 }));
    if (names[0]) saveName(names[0]);
    const save = createLocalGame({ humans: names, bots, pointLimit });
    saveLocalGame(save);
    navigate("/offline/play");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{t("ui.offline.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("ui.offline.subtitle")}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label={t("join.back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          {canResume && (
            <Button variant="secondary" className="h-12 w-full text-base" onClick={() => navigate("/offline/play")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("ui.offline.resume")}
            </Button>
          )}

          <Stepper
            label={t("ui.offline.humans")}
            value={humans.length}
            min={1}
            max={6}
            onChange={setHumanCount}
          />
          <div className="space-y-2">
            {humans.map((name, i) => (
              <Input
                key={i}
                value={name}
                maxLength={20}
                placeholder={t("ui.offline.defaultName", { n: i + 1 })}
                onChange={(e) => setHumans((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              />
            ))}
            {humans.length > 1 && <p className="text-xs text-muted-foreground">{t("ui.offline.passAndPlay")}</p>}
          </div>

          <Stepper
            label={t("ui.offline.bots")}
            value={bots}
            min={Math.max(0, 2 - humans.length)}
            max={MAX_TABLE - humans.length}
            onChange={setBots}
          />

          <PointLimitPicker value={pointLimit} onChange={setPointLimit} />

          <Button className="h-12 w-full text-base" onClick={start} disabled={total < 2}>
            <Play className="mr-2 h-4 w-4" />
            {t("ui.offline.start")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
