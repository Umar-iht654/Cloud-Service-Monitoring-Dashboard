export function StatusWatchBrand({
  variant = "auth",
}: {
  variant?: "auth" | "sidebar" | "compact";
}) {
  const compact = variant === "compact";
  const sidebar = variant === "sidebar";

  return (
    <div className={`relative flex min-w-0 items-center ${compact || sidebar ? "gap-2" : "gap-3"}`}>
      <img
        src="/favicon.png"
        alt=""
        aria-hidden="true"
        width={256}
        height={256}
        className={`shrink-0 rounded-xl object-contain ${
          compact
            ? "h-8 w-8"
            : sidebar
              ? "h-10 w-10 drop-shadow-[0_0_8px_rgb(34_211_238_/_0.2)]"
              : "h-12 w-12 shadow-lg shadow-cyan-400/20"
        }`}
      />
      <div className="min-w-0">
        <p className={`font-extrabold leading-none tracking-normal ${compact || sidebar ? "text-base" : "text-[1.05rem]"}`}>
          <span className={compact ? "text-slate-900" : "text-white"}>Status</span>
          <span className={compact ? "text-cyan-700" : "text-cyan-300"}>Watch</span>
        </p>
        {!compact && (
          <p className={`mt-1 font-medium ${sidebar ? "text-[10px] text-slate-400" : "text-xs text-slate-500"}`}>
            Service monitoring console
          </p>
        )}
      </div>
    </div>
  );
}
