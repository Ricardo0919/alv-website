"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

export const REASON_MAX = 280;

/** Campo "¿Por qué?" con contador de caracteres. */
export default function ReasonField({ value, onChange, required = false, placeholder }: Props) {
  return (
    <div className="rounded-2xl border-2 border-white/40 bg-white/60 p-4">
      <label htmlFor="reason" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
        ¿Por qué?{" "}
        {required ? (
          <span className="text-red-500">*</span>
        ) : (
          <span className="font-normal normal-case text-gray-400">(opcional)</span>
        )}
      </label>
      <textarea
        id="reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={REASON_MAX}
        rows={2}
        placeholder={placeholder ?? "Ej. Por la llamada de anoche"}
        className="w-full resize-none rounded-xl md:min-h-32 border border-[#8B4513]/20 bg-white/80 px-3 py-2 text-[#3E2723] outline-none focus:border-[#8B4513] focus:ring-2 focus:ring-[#DEB887]"
      />
      <p className="mt-1 text-right text-[10px] text-gray-400">
        {value.length}/{REASON_MAX}
      </p>
    </div>
  );
}
