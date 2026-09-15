import { AuthRequiredLink } from "../auth/AuthRequiredLink";
import { GlobeIcon, PlusIcon } from "../ui/Icons";

export function EmptyServices() {
  return (
    <div className="premium-panel rounded-3xl border-dashed px-6 py-16 text-center">
      <div className="empty-radar mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
        <GlobeIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-950">Monitor your first service</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Add a website or API endpoint. The background checker will begin recording its availability and response time automatically.
      </p>
      <AuthRequiredLink
        to="/services/new"
        intent="add-service"
        className="primary-action mt-6 inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-cyan-500/20"
      >
        <PlusIcon className="h-4 w-4" />
        Add your first service
      </AuthRequiredLink>
    </div>
  );
}
