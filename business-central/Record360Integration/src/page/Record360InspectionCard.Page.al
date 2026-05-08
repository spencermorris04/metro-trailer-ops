page 50114 "Record360 Inspection Card"
{
    PageType = Card;
    SourceTable = "Record360 Inspection";
    ApplicationArea = All;
    Caption = 'Record360 Inspection';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("Record360 Inspection ID"; Rec."Record360 Inspection ID")
                {
                    ApplicationArea = All;
                }
                field("Inspection DateTime"; Rec."Inspection DateTime")
                {
                    ApplicationArea = All;
                }
                field("Inspection Direction"; Rec."Inspection Direction")
                {
                    ApplicationArea = All;
                }
                field("New/Used Status"; Rec."New/Used Status")
                {
                    ApplicationArea = All;
                }
                field("Employee Name"; Rec."Employee Name")
                {
                    ApplicationArea = All;
                }
            }
            group(Trailer)
            {
                field("Trailer No."; Rec."Trailer No.")
                {
                    ApplicationArea = All;
                }
                field("Trailer VIN"; Rec."Trailer VIN")
                {
                    ApplicationArea = All;
                }
                field("Normalized Trailer VIN"; Rec."Normalized Trailer VIN")
                {
                    ApplicationArea = All;
                }
                field("Customer Unit No."; Rec."Customer Unit No.")
                {
                    ApplicationArea = All;
                }
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                }
                field("Matched By"; Rec."Matched By")
                {
                    ApplicationArea = All;
                }
            }
            group(Details)
            {
                field(Carrier; Rec.Carrier)
                {
                    ApplicationArea = All;
                }
                field(Driver; Rec.Driver)
                {
                    ApplicationArea = All;
                }
                field("Truck No."; Rec."Truck No.")
                {
                    ApplicationArea = All;
                }
                field("Contract No."; Rec."Contract No.")
                {
                    ApplicationArea = All;
                }
                field(Origin; Rec.Origin)
                {
                    ApplicationArea = All;
                }
                field(Destination; Rec.Destination)
                {
                    ApplicationArea = All;
                }
                field("Unit Condition"; Rec."Unit Condition")
                {
                    ApplicationArea = All;
                }
                field(Comments; Rec.Comments)
                {
                    ApplicationArea = All;
                    MultiLine = true;
                }
            }
            group(Media)
            {
                field("Photo Count"; Rec."Photo Count")
                {
                    ApplicationArea = All;
                }
                field("Video Count"; Rec."Video Count")
                {
                    ApplicationArea = All;
                }
                field("Media Count"; Rec."Media Count")
                {
                    ApplicationArea = All;
                }
            }
            group(Links)
            {
                field("PDF Share URL"; Rec."PDF Share URL")
                {
                    ApplicationArea = All;
                }
                field("Dashboard URL"; Rec."Dashboard URL")
                {
                    ApplicationArea = All;
                }
            }
            group(Sync)
            {
                field("Sync Status"; Rec."Sync Status")
                {
                    ApplicationArea = All;
                }
                field("Last Synced At"; Rec."Last Synced At")
                {
                    ApplicationArea = All;
                }
                field("Last Error"; Rec."Last Error")
                {
                    ApplicationArea = All;
                    MultiLine = true;
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
}
