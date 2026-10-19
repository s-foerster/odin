import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function readSavedName(): string {
  try {
    return localStorage.getItem("odin.name") || "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem("odin.name", name);
  } catch {}
}

const LIMITS = [10, 15, 20, 25, 30];

// Choix de la limite de points en un toucher
export function PointLimitPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <Label className="mb-1 block text-sm">{t("create.pointsLimit")}</Label>
      <div className="grid grid-cols-5 gap-1.5">
        {LIMITS.map((limit) => (
          <button
            key={limit}
            type="button"
            onClick={() => onChange(limit)}
            className={cn(
              "h-11 rounded-md border text-sm font-medium",
              value === limit ? "border-primary bg-primary text-primary-foreground" : "bg-background active:bg-muted",
            )}
          >
            {limit}
          </button>
        ))}
      </div>
    </div>
  );
}

// Sélecteur numérique − / +
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-10 w-10 rounded-md border text-lg disabled:opacity-40"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="-"
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          className="h-10 w-10 rounded-md border text-lg disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="+"
        >
          +
        </button>
      </div>
    </div>
  );
}
