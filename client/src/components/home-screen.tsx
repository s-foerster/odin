import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import LanguageSelector from "@/components/ui/language-selector";
import { ActiveGameBanner } from "@/components/active-game-banner";
import { Bot, LogIn, Plus } from "lucide-react";

const HomeScreen: React.FC = () => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  

  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>

      <div className="mb-6 w-full max-w-sm text-center">
        <ActiveGameBanner />
        <h1 className="mb-2 text-5xl font-bold text-primary md:text-6xl">Odin</h1>
        <p className="text-muted-foreground">{t("app.description")}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" className="h-14 text-base" onClick={() => navigate("/create")} disabled={!online}>
          <Plus className="mr-2 h-5 w-5" />
          {t("button.createGame")}
        </Button>
        <Button variant="outline" size="lg" className="h-14 text-base" onClick={() => navigate("/join")} disabled={!online}>
          <LogIn className="mr-2 h-5 w-5" />
          {t("button.joinGame")}
        </Button>
        <Button variant="secondary" size="lg" className="h-14 text-base" onClick={() => navigate("/offline")}>
          <Bot className="mr-2 h-5 w-5" />
          {t("ui.offline.title")}
        </Button>
        {!online && <p className="text-center text-sm text-muted-foreground">{t("ui.offline.noNetwork")}</p>}
      </div>

      <Card className="mt-10 w-full max-w-sm">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-xl font-semibold">{t("howToPlay.title")}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <li key={i}>{t(`howToPlay.rule${i}`)}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomeScreen;
