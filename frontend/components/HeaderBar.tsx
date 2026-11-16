import Link from "next/link";

/**
 * Barra superior del header café: identidad a la izquierda y acciones
 * (botones redondos del mismo tamaño) agrupadas en una cápsula a la derecha.
 */
export function HeaderBar({ identity, actions }: { identity: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">{identity}</div>
      {actions && <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/20 p-1">{actions}</div>}
    </div>
  );
}

/** Avatar con la inicial + nombre del usuario. */
export function UserChip({ username, caption }: { username: string; caption?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DEB887] text-sm font-black uppercase text-[#6d360f] ring-2 ring-[#FFF8DC]/30">
        {username.charAt(0)}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold text-[#FFF8DC]">{username}</p>
        {caption && <p className="truncate text-[10px] font-medium uppercase tracking-wider text-[#DEB887]">{caption}</p>}
      </div>
    </div>
  );
}

const iconButton =
  "relative flex h-9 w-9 items-center justify-center rounded-full text-[#FFF8DC]/85 transition hover:bg-white/15 hover:text-white active:scale-90";

interface IconActionProps {
  label: string;
  children: React.ReactNode;
  badge?: number;
  href?: string;
  onClick?: () => void;
}

/** Botón redondo con ícono (link o botón) y contador opcional. */
export function IconAction({ label, children, badge, href, onClick }: IconActionProps) {
  const content = (
    <>
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#7a3d12]">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </>
  );
  const a11y = { "aria-label": badge ? `${label} (${badge})` : label, title: label };

  return href ? (
    <Link href={href} className={iconButton} {...a11y}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={iconButton} {...a11y}>
      {content}
    </button>
  );
}
