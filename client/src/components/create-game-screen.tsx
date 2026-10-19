import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import LanguageSelector from "@/components/ui/language-selector";
import { PointLimitPicker, readSavedName, saveName } from "@/components/form-bits";

const CreateGameScreen: React.FC = () => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [playerName, setPlayerName] = useState(readSavedName);
  const [pointLimit, setPointLimit] = useState(15);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGame = async () => {
    const name = playerName.trim();
    if (!name) {
      toast({ title: t("create.nameRequired"), description: t("create.pleaseEnterName"), variant: "destructive" });
      return;
    }
    try {
      setIsCreating(true);
      const response = await apiRequest("POST", "/api/games", { playerName: name, pointLimit });
      const data = await response.json();
      sessionStorage.setItem("gameId", data.gameId);
      sessionStorage.setItem("playerId", data.playerId);
      sessionStorage.setItem("playerName", name);
      sessionStorage.setItem("roomCode", data.roomCode);
      saveName(name);
      // Direct au salon : le code à 4 chiffres y est affiché en grand
      navigate(`/lobby/${data.gameId}`);
    } catch (error) {
      console.error("Failed to create game:", error);
      toast({ title: t("create.failedToCreate"), description: t("ui.onlineOnly"), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{t("create.title")}</h2>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label={t("join.back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateGame();
            }}
          >
            <div>
              <Label htmlFor="playerName" className="mb-1 block text-sm">
                {t("create.nameLabel")}
              </Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t("create.namePlaceholder")}
                maxLength={20}
                autoComplete="nickname"
              />
            </div>

            <PointLimitPicker value={pointLimit} onChange={setPointLimit} />

            <Button type="submit" className="h-12 w-full text-base" disabled={isCreating}>
              {isCreating ? t("create.creating") : t("ui.create.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateGameScreen;
