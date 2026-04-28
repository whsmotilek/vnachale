export function Logo({ size = 28 }: { size?: number }) {
  // Логотип в public/logo.png. На GH Pages base = /vnachale/, поэтому
  // используем относительный путь, Vite его правильно подмонтирует.
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="Vnachale"
      width={size}
      height={size}
      className="rounded-md select-none"
      draggable={false}
    />
  );
}
