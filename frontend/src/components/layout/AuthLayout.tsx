import type { CSSProperties, ReactNode } from "react";
import { LightRays } from "../effects/LightRays";
import { ActivityIcon, CheckIcon, ClockIcon, GlobeIcon } from "../ui/Icons";
import { StatusWatchBrand } from "./StatusWatchBrand";

const monitoringFeatures = [
  "Uptime monitoring",
  "Response-time tracking",
  "Downtime alerts",
];

const monitoredServices = [
  {
    name: "API Gateway",
    uptime: "99.99%",
    averageLatency: "76 ms",
    checks: "38",
    lastChecked: "12 sec ago",
    ring: 99.99,
    statusLabel: "Operational",
  },
  {
    name: "Auth Service",
    uptime: "99.98%",
    averageLatency: "84 ms",
    checks: "27",
    lastChecked: "24 sec ago",
    ring: 99.98,
    statusLabel: "Operational",
  },
  {
    name: "Payments API",
    uptime: "99.96%",
    averageLatency: "112 ms",
    checks: "44",
    lastChecked: "31 sec ago",
    ring: 99.96,
    statusLabel: "Operational",
  },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section className="auth-visual relative hidden overflow-hidden border-r border-white/5 px-12 py-12 lg:flex lg:flex-col xl:px-20">
        <LightRays
          className="auth-light-rays"
          origin="top-center"
          speed={0.45}
          spread={0.58}
          length={2.4}
          mouseInfluence={0.07}
        />
        <StatusWatchBrand />

        <div className="auth-copy relative z-10 my-auto max-w-[44rem] py-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 shadow-[0_0_24px_rgb(34_211_238_/_0.08)]">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            REAL-TIME SERVICE MONITORING
          </div>
          <p className="max-w-[42rem] text-[clamp(2.15rem,3.25vw,3.35rem)] font-semibold leading-[1.04] text-white">
            <span className="block whitespace-nowrap">Know when something breaks</span>
            <span className="block whitespace-nowrap">before your users do.</span>
          </p>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
            Monitor uptime, latency and failures across your services from one clear workspace.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {monitoringFeatures.map((feature) => (
              <div
                key={feature}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-cyan-200/10 bg-[#07182a]/70 px-4 py-3 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_12px_26px_rgb(0_0_0_/_0.16)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/25">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="auth-showcase status-visual mt-10 w-full max-w-[44rem] rounded-[1.75rem] p-5 text-white" aria-hidden="true">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">
                  <ActivityIcon className="h-3.5 w-3.5 text-cyan-300" />
                  Live checks
                </div>
                <p className="mt-2 text-xl font-semibold">Production services</p>
              </div>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                All systems operational
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {monitoredServices.map((service, index) => (
                <article
                  key={service.name}
                  className="auth-service-card service-monitor-row rounded-2xl border border-cyan-300/12 bg-[#030b17]/88 p-3.5 shadow-[inset_0_1px_0_rgb(125_211_252_/_0.045),0_12px_24px_rgb(0_0_0_/_0.2)] sm:[&:nth-child(3)]:col-span-2 sm:[&:nth-child(3)]:mx-auto sm:[&:nth-child(3)]:w-[calc(50%-0.375rem)]"
                  style={{
                    animationDelay: `${index * 90}ms`,
                    "--auth-service-ring": `${service.ring * 3.6}deg`,
                  } as CSSProperties}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-200/8 text-cyan-100 ring-1 ring-inset ring-cyan-100/12">
                        <GlobeIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-50">{service.name}</p>
                        <p className="mt-1 text-xs font-medium text-cyan-100/80">{service.statusLabel}</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                      <span className="live-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      Online
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 border-y border-cyan-300/10 py-3">
                    <div className="auth-uptime-ring relative h-16 w-16 shrink-0 rounded-full p-[5px]">
                      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#030b17] shadow-[inset_0_0_18px_rgb(0_0_0_/_0.48)]">
                        <p className="metric-tabular text-xs font-bold tracking-tight text-white">{service.uptime}</p>
                        <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-cyan-200/60">Uptime</p>
                      </div>
                    </div>
                    <div className="grid min-w-0 grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Average</p>
                        <p className="metric-tabular mt-1 text-sm font-semibold text-cyan-50">
                          {service.averageLatency}
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-200/50">
                          latency
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Checks</p>
                        <p className="metric-tabular mt-1 text-sm font-semibold text-cyan-50">{service.checks}</p>
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-200/50">
                          active
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{service.lastChecked}</span>
                    </span>
                    <span className="font-semibold text-teal-200/75">Healthy</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-xs text-slate-600">
          Built for focused reliability teams.
        </p>
      </section>

      <main
        id="authentication-content"
        className="auth-form-canvas relative flex min-h-screen w-full items-start justify-center px-4 pb-8 pt-24 sm:items-center sm:px-8 sm:py-12 lg:py-10"
      >
        <div className="absolute left-4 top-5 sm:left-8 sm:top-7 lg:hidden">
          <StatusWatchBrand variant="compact" />
        </div>
        <div className="auth-form-panel w-full max-w-md rounded-3xl p-5 sm:p-9">{children}</div>
      </main>
    </div>
  );
}
