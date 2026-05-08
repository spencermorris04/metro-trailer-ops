page 50116 "Record360 Recent FactBox"
{
    PageType = ListPart;
    SourceTable = "Record360 Inspection";
    SourceTableView = sorting("Trailer No.", "Inspection DateTime") order(descending);
    ApplicationArea = All;
    Caption = 'Record360 History';
    Editable = false;

    layout
    {
        area(Content)
        {
            repeater(History)
            {
                field("Inspection DateTime"; Rec."Inspection DateTime")
                {
                    ApplicationArea = All;
                    Caption = 'Date';
                }
                field("Inspection Direction"; Rec."Inspection Direction")
                {
                    ApplicationArea = All;
                    Caption = 'Direction';
                }
                field("Employee Name"; Rec."Employee Name")
                {
                    ApplicationArea = All;
                    Caption = 'Employee';
                }
                field("Media Count"; Rec."Media Count")
                {
                    ApplicationArea = All;
                    Caption = 'Media';
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

                trigger OnAction()
                begin
                    OpenPdfForCurrentRecord();
                end;
            }
            action(OpenDashboard)
            {
                Caption = 'Open Dashboard';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                begin
                    OpenDashboardForCurrentRecord();
                end;
            }
            action(ViewAll)
            {
                Caption = 'View All';
                ApplicationArea = All;
                Image = List;

                trigger OnAction()
                var
                    Inspection: Record "Record360 Inspection";
                begin
                    Inspection.Copy(Rec);
                    Page.Run(Page::"Record360 Inspection List", Inspection);
                end;
            }
            action(RequestSync)
            {
                Caption = 'Request Sync';
                ApplicationArea = All;
                Image = Refresh;

                trigger OnAction()
                var
                    SyncRequest: Codeunit "Record360 Sync Request";
                    FixedAssetNo: Code[20];
                begin
                    FixedAssetNo := GetCurrentFixedAssetNo();
                    SyncRequest.RequestOnDemandSync(FixedAssetNo);
                    Message('Record360 sync request queued for fixed asset %1.', FixedAssetNo);
                end;
            }
        }
    }

    trigger OnOpenPage()
    begin
        Rec.SetCurrentKey("Trailer No.", "Inspection DateTime");
        Rec.Ascending(false);
    end;

    trigger OnAfterGetRecord()
    begin
        SetLinkTexts();
    end;

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

    local procedure GetCurrentFixedAssetNo(): Code[20]
    var
        TrailerFilter: Text;
    begin
        if Rec."Trailer No." <> '' then
            exit(CopyStr(Rec."Trailer No.", 1, 20));

        TrailerFilter := Rec.GetFilter("Trailer No.");
        TrailerFilter := DelChr(TrailerFilter, '=', '''');
        if TrailerFilter <> '' then
            exit(CopyStr(TrailerFilter, 1, 20));

        Error('No fixed asset number is available for this Record360 FactBox.');
    end;

    var
        PdfLinkText: Text[10];
        DashboardLinkText: Text[10];
}
