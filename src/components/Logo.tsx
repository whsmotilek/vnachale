import clsx from "clsx";

/** Знак-эмблема бренда (красный штамп-квадрат с фигурой). PNG с прозрачным фоном. */
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
      src={`${import.meta.env.BASE_URL}mark.png`}
      alt="vnachale"
      width={size}
      height={size}
      draggable={false}
      className={clsx(
        "select-none object-contain transition-transform duration-200",
        glow && "drop-shadow-[0_0_22px_rgba(218,5,0,0.45)]",
        className,
      )}
    />
  );
}

/** Лого-локап: знак + рукописный wordmark «unachale».
 *  Wordmark — картинка (ручная леттеринг), меняется по теме: чёрный/белый. */
export function Brand({
  size = 26,
  glow = false,
  textClass,
}: {
  size?: number;
  glow?: boolean;
  /** Оставлен для обратной совместимости вызовов; на высоту wordmark влияет size. */
  textClass?: string;
}) {
  void textClass;
  const wmHeight = Math.round(size * 0.64);
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <Logo size={size} glow={glow} />
      <picture>
        <img
          src={`${import.meta.env.BASE_URL}wordmark-dark.png`}
          alt="unachale"
          height={wmHeight}
          style={{ height: wmHeight }}
          draggable={false}
          className="block dark:hidden w-auto object-contain"
        />
      </picture>
      <img
        src={`${import.meta.env.BASE_URL}wordmark-light.png`}
        alt=""
        aria-hidden
        height={wmHeight}
        style={{ height: wmHeight }}
        draggable={false}
        className="hidden dark:block w-auto object-contain"
      />
    </div>
  );
}
