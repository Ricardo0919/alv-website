import { SpinnerIcon } from "./icons";

export default function LoadingScreen({ message = "Horneando..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-[#8B4513]" role="status">
      <SpinnerIcon className="h-8 w-8" />
      <p className="font-bold">{message}</p>
    </div>
  );
}
