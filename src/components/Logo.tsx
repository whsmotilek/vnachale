import clsx from "clsx";

export function Logo({
  size = 28,
  glow = false,
  className,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="vnachale"
      width={size}
      height={size}
      draggable={false}
      className={clsx(
        "rounded-md select-none transition-transform duration-200",
        glow && "drop-shadow-[0_0_24px_rgba(26,0,136,0.35)]",
        className,
      )}
    />
  );
}

/** Лого + словоформа "vnachale" рядом, единый компонент, чтобы переиспользовать. */
export function Brand({
  size = 26,
  glow = false,
  textClass,
}: {
  size?: number;
  glow?: boolean;
  textClass?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <Logo size={size} glow={glow} />
      <span
        className={clsx(
          "font-display lowercase tracking-tighter2 text-ink",
          textClass ?? "text-[16px] font-semibold",
        )}
      >
        vnachale
      </span>
    </div>
  );
}
