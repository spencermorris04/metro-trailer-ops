import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { titleize } from "@/lib/format";
import { listCustomers } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const searchDimensions = [
  "Customer name and customer number",
  "Billing city and customer type",
  "Portal-enabled accounts",
  "Customer site contact and site address",
  "Branch coverage and collections status",
];

export default async function CustomersPage() {
  const sampleCustomers = await listCustomers();

  return (
    <>
      <SectionCard
        eyebrow="Phase 1.2"
        title="Customer management ties billing identity to real jobsites"
        description="Commercial accounts often rent across multiple branches and delivery sites, so customer records and customer locations need to be separate but tightly linked."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4 text-sm leading-7 text-slate-600">
            <p>
              The customer model separates billing identity from operational
              site data. That keeps invoices, credit posture, and collections
              attached to the account while dispatch, inspections, and delivery
              coordination stay tied to the specific site or yard.
            </p>
            <p>
              The starter validators already support customer creation with
              nested site records, making it straightforward to turn these flows
              into repository-backed CRUD next.
            </p>
          </div>

          <div className="soft-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Search and filter scope
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {searchDimensions.map((dimension) => (
                <li key={dimension} className="rounded-xl bg-white/75 px-3 py-2">
                  {dimension}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Accounts"
        title="Representative customers and sites"
        description="These examples show how branch coverage, site lists, and portal access are expected to appear in the UI."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {sampleCustomers.map((customer) => (
            <div key={customer.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {customer.customerNumber}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {customer.name}
                  </h3>
                </div>
                <StatusPill label={titleize(customer.customerType)} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill
                  label={customer.portalEnabled ? "Portal enabled" : "Portal pending"}
                  tone={customer.portalEnabled ? "emerald" : "amber"}
                />
                {customer.branchCoverage.map((branch) => (
                  <span
                    key={branch}
                    className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {branch}
                  </span>
                ))}
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Billing city: {customer.billingCity}
              </p>

              <div className="mt-5 space-y-3">
                {customer.locations.map((location) => (
                  <div
                    key={location.id}
                    className="rounded-2xl border border-[rgba(19,35,45,0.08)] bg-white/80 p-4"
                  >
                    <p className="font-semibold text-slate-900">{location.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {location.address}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Contact: {location.contactPerson}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
