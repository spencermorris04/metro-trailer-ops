page 50113 "Record360 Inspection List"
{
    PageType = List;
    SourceTable = "Record360 Inspection";
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Record360 Inspections';
    Editable = false;
    CardPageId = "Record360 Inspection Card";

    layout
    {
        area(Content)
        {
            repeater(General)
            {
                field("Inspection DateTime"; Rec."Inspection DateTime")
                {
                    ApplicationArea = All;
                }
                field("Inspection Direction"; Rec."Inspection Direction")
                {
                    ApplicationArea = All;
                }
                field("Trailer No."; Rec."Trailer No.")
                {
                    ApplicationArea = All;
                }
                field("Trailer VIN"; Rec."Trailer VIN")
                {
                    ApplicationArea = All;
                }
                field("Employee Name"; Rec."Employee Name")
                {
                    ApplicationArea = All;
                }
                field(Driver; Rec.Driver)
                {
                    ApplicationArea = All;
                }
                field(Carrier; Rec.Carrier)
                {
                    ApplicationArea = All;
                }
                field("Contract No."; Rec."Contract No.")
                {
                    ApplicationArea = All;
                }
                field("Photo Count"; Rec."Photo Count")
                {
                    ApplicationArea = All;
                }
                field("Video Count"; Rec."Video Count")
                {
                    ApplicationArea = All;
                }
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                }
                field("Sync Status"; Rec."Sync Status")
                {
                    ApplicationArea = All;
                }
                field(PdfLinkText; PdfLinkText)
                {
                    ApplicationArea = All;
                    Caption = 'PDF';
                    ToolTip = 'Open the Record360 PDF for this inspection.';

                    trigger OnDrillDown()
                    begin
                        OpenPdfForCurrentRecord();
                    end;
                }
                field(DashboardLinkText; DashboardLinkText)
                {
                    ApplicationArea = All;
                    Caption = 'Dashboard';
                    ToolTip = 'Open the Record360 dashboard for this inspection.';

                    trigger OnDrillDown()
                    begin
                        OpenDashboardForCurrentRecord();
                    end;
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(OpenPDF)
            {
                Caption = 'Open PDF';
                ApplicationArea = All;
                Image = Print;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    OpenPdfForCurrentRecord();
                end;
            }
            action(OpenDashboard)
            {
                Caption = 'Open Record360 Dashboard';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    OpenDashboardForCurrentRecord();
                end;
            }
        }
    }

    local procedure OpenPdfForCurrentRecord()
    var
        SyncRequest: Codeunit "Record360 Sync Request";
        PdfShareUrl: Text;
    begin
        PdfShareUrl := SyncRequest.GetFreshPdfShareUrl(Rec."Record360 Inspection ID", Rec."PDF Share URL");
        if PdfShareUrl = '' then
            Error('No PDF Share URL is available for this inspection.');

        Hyperlink(PdfShareUrl);
    end;

    local procedure OpenDashboardForCurrentRecord()
    begin
        if Rec."Dashboard URL" = '' then
            Error('No Record360 dashboard URL is available for this inspection.');

        Hyperlink(Rec."Dashboard URL");
    end;

    trigger OnAfterGetRecord()
    begin
        SetLinkTexts();
    end;

    local procedure SetLinkTexts()
    begin
        if Rec."PDF Share URL" <> '' then
            PdfLinkText := 'Open'
        else
            PdfLinkText := '';

        if Rec."Dashboard URL" <> '' then
            DashboardLinkText := 'Open'
        else
            DashboardLinkText := '';
    end;

    var
        PdfLinkText: Text[10];
        DashboardLinkText: Text[10];
}
