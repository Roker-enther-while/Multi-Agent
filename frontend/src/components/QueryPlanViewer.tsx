import type { QueryPlan } from "../types/api";

type Props = {
  plan: QueryPlan | null;
};

export function QueryPlanViewer({ plan }: Props) {
  return (
    <section className="border border-ink/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Parsed Query</h2>
        {plan ? <span className="text-xs text-signal">{plan.search_strategy}</span> : null}
      </div>
      <pre className="mt-3 max-h-[300px] overflow-auto bg-ink p-4 text-xs leading-5 text-panel">
        {JSON.stringify(plan ?? { status: "waiting_for_search" }, null, 2)}
      </pre>
    </section>
  );
}
