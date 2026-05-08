pageextension 50120 "Fixed Asset Card R360 Ext" extends "Fixed Asset Card"
{
    layout
    {
        addlast(FactBoxes)
        {
            part(Record360Latest; "Record360 Summary FactBox")
            {
                ApplicationArea = All;
                SubPageLink = "No." = field("No.");
            }
            part(Record360History; "Record360 Recent FactBox")
            {
                ApplicationArea = All;
                SubPageLink = "Trailer No." = field("No.");
            }
        }
    }

    actions
    {
        addlast(Processing)
        {
            action(ViewRecord360Inspections)
            {
                Caption = 'Record360 Inspections';
                ApplicationArea = All;
                Image = List;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Inspection: Record "Record360 Inspection";
                begin
                    Inspection.SetRange("Trailer No.", Rec."No.");
                    Page.Run(Page::"Record360 Inspection List", Inspection);
                end;
            }
            action(OpenLatestRecord360PDF)
            {
                Caption = 'Open Latest Record360 PDF';
                ApplicationArea = All;
                Image = Print;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Inspection: Record "Record360 Inspection";
                    SyncRequest: Codeunit "Record360 Sync Request";
                    PdfShareUrl: Text;
                begin
                    if not FindLatestInspectionWithPdf(Inspection) then
                        Error('No Record360 inspection PDF was found for fixed asset %1.', Rec."No.");

                    PdfShareUrl := SyncRequest.GetFreshPdfShareUrl(Inspection."Record360 Inspection ID", Inspection."PDF Share URL");
                    if PdfShareUrl = '' then
                        Error('No PDF Share URL is available for this inspection.');

                    Hyperlink(PdfShareUrl);
                end;
            }
            action(OpenLatestRecord360Dashboard)
            {
                Caption = 'Open Latest Record360 Dashboard';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Inspection: Record "Record360 Inspection";
                begin
                    if not FindLatestInspectionWithDashboard(Inspection) then
                        Error('No Record360 dashboard link was found for fixed asset %1.', Rec."No.");

                    Hyperlink(Inspection."Dashboard URL");
                end;
            }
        }
    }

    local procedure FindLatestInspectionWithPdf(var Inspection: Record "Record360 Inspection"): Boolean
    begin
        Inspection.Reset();
        Inspection.SetRange("Trailer No.", Rec."No.");
        Inspection.SetFilter("PDF Share URL", '<>%1', '');
        Inspection.SetCurrentKey("Trailer No.", "Inspection DateTime");
        Inspection.Ascending(false);

        exit(Inspection.FindFirst());
    end;

    local procedure FindLatestInspectionWithDashboard(var Inspection: Record "Record360 Inspection"): Boolean
    begin
        Inspection.Reset();
        Inspection.SetRange("Trailer No.", Rec."No.");
        Inspection.SetFilter("Dashboard URL", '<>%1', '');
        Inspection.SetCurrentKey("Trailer No.", "Inspection DateTime");
        Inspection.Ascending(false);

        exit(Inspection.FindFirst());
    end;
}
