"use client";

import { useEffect, useState } from "react";
import { SettingsIcon } from "../../components/icons";
import { useToast } from "../../components/feedback/FeedbackProvider";
import LoadingScreen from "../../components/LoadingScreen";
import PageShell from "../../components/PageShell";
import CrumbAmountPicker from "../../components/logger/CrumbAmountPicker";
import { api, ApiError } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";

const formatter = new Intl.NumberFormat("es-MX");
const DEFAULT_GOAL = 80_000;
const MAX_GOAL = 10_000_000;

export default function SettingsPage() {
  const { status, user } = useRequireAuth();
  if (status !== "authenticated" || !user) return <LoadingScreen />;
  return <GoalSettings currentGoal={user.goal} />;
}

function GoalSettings({ currentGoal }: { currentGoal: number }) {
  const { updateUser } = useRequireAuth();
  const [goal, setGoal] = useState(currentGoal);
  const [total, setTotal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Lo ya acumulado es el mínimo permitido para la meta
  useEffect(() => {
    let active = true;
    api
      .stats()
      .then((s) => active && setTotal(s.total_crumbs))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const minGoal = Math.max(1, total ?? 1);
  const changed = goal !== currentGoal;
  // Con el teclado se puede escribir libremente; no se guarda por debajo de lo acumulado
  const tooLow = goal < minGoal;

  const save = async () => {
    setSaving(true);
    try {
      const user = await api.updateGoal(goal);
      updateUser(user);
      toast.success(`Tu nueva meta es de ${formatter.format(user.goal)} migajas.`, { title: "Meta actualizada" });
    } catch (err) {
      const text =
        err instanceof ApiError && err.status !== 0 ? (err.fields.goal?.[0] ?? err.message) : "Error de conexión. Intenta de nuevo.";
      toast.error(text, { title: "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Ajustes" icon={<SettingsIcon className="h-6 w-6" />} backHref="/" narrow>
      <section className="space-y-4">
        <CrumbAmountPicker
          label="Mi meta de migajas"
          value={goal}
          onChange={setGoal}
          min={minGoal}
          max={MAX_GOAL}
          hint={`Mínimo ${formatter.format(minGoal)} (lo que llevas) · máximo ${formatter.format(MAX_GOAL)}`}
        />

        {tooLow && (
          <p className="rounded-lg bg-red-100 p-3 text-center text-sm text-red-700">
            La meta no puede ser menor a lo que ya llevas ({formatter.format(minGoal)}).
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setGoal(Math.max(minGoal, DEFAULT_GOAL))}
            disabled={goal === DEFAULT_GOAL}
            className="rounded-xl border border-[#8B4513]/20 bg-white/60 px-4 py-3 text-sm font-bold text-[#8B4513] transition active:scale-95 disabled:opacity-40"
          >
            Restablecer
          </button>
          <button
            onClick={save}
            disabled={!changed || saving || tooLow}
            className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-3 font-bold uppercase tracking-wider text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "..." : "Guardar meta"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-500">
          Al llegar a tu meta ya no podrás sumar ni recibir más migajas, a menos que la subas. Por defecto es{" "}
          {formatter.format(DEFAULT_GOAL)}.
        </p>
      </section>
    </PageShell>
  );
}
