import Link from "next/link";
import { AlertIcon } from "./icons";

interface Props {
  title: string;
  message: string;
  retry?: boolean;
}

export default function ErrorScreen({ title, message, retry = false }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white/80 p-6 text-red-700 shadow-lg">
        <AlertIcon className="mx-auto mb-3 h-10 w-10 text-red-500" />
        <h2 className="mb-1 text-lg font-bold">{title}</h2>
        <p className="text-sm text-red-600/90">{message}</p>
        <div className="mt-5 flex justify-center gap-3">
          {retry && (
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition active:scale-95"
            >
              Reintentar
            </button>
          )}
          <Link href="/" className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold transition hover:bg-red-50">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
