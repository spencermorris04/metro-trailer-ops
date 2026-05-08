import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getCommercialEventsView } from "@/lib/server/platform";


export default async function CommercialEventsPage() {
  const events = await getCommercialEventsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Commercial"
        title="Commercial events"
        description="Operational billing events, invoice linkage, and source document lineage."
      />

      <SectionCard eyebrow="Events" title="Commercial event stream">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Contract</th>
                <th>Description</th>
                <th>Invoice</th>
                <th>Source</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.eventDate)}</td>
                  <td><StatusPill label={titleize(event.eventType)} /></td>
                  <td>{event.contractNumber}</td>
                  <td>{event.description}</td>
                  <td>
                    {event.invoiceNumber ?? "Uninvoiced"}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {event.invoiceStatus ? titleize(event.invoiceStatus) : "Pending"}
                    </span>
                  </td>
                  <td className="text-[0.7rem] text-slate-500">
                    {event.sourceDocumentType ?? "-"}
                    <br />
                    {event.sourceDocumentNo ?? "-"}
                  </td>
                  <td className="font-semibold text-slate-900">
                    {formatCurrency(event.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
