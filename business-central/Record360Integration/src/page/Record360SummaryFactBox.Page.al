page 50115 "Record360 Summary FactBox"
{
    PageType = CardPart;
    SourceTable = "Fixed Asset";
    ApplicationArea = All;
    Caption = 'Latest Record360';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(Summary)
            {
                ShowCaption = false;

                field(LatestText; LatestText)
                {
                    ApplicationArea = All;
                    Caption = 'Latest';
                }
                field(InspectionDirectionText; InspectionDirectionText)
                {
                    ApplicationArea = All;
                    Caption = 'Direction';
                }
                field(EmployeeName; EmployeeName)
                {
                    ApplicationArea = All;
                    Caption = 'Employee';
                }
                field(MediaCountText; MediaCountText)
                {
                    ApplicationArea = All;
                    Caption = 'Media';
                }
                field(MatchStatusText; MatchStatusText)
                {
                    ApplicationArea = All;
                    Caption = 'Match';
                }
                field(SyncStatusText; SyncStatusText)
                {
                    ApplicationArea = All;
                    Caption = 'Sync';
                }
                field(RequestSyncText; RequestSyncText)
                {
                    ApplicationArea = All;
                    Caption = 'Refresh';
                    ToolTip = 'Queue a Record360 refresh for this fixed asset.';

                    trigger OnDrillDown()
                    begin
                        RequestSyncForCurrentAsset();
                    end;
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(OpenLatestPDF)
            {
                Caption = 'Open Latest PDF';
                ApplicationArea = All;
                Image = Print;

                trigger OnAction()
                begin
                    OpenPdfForCurrentRecord();
                end;
            }
            action(OpenLatestDashboard)
            {
                Caption = 'Open Latest Dashboard';
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
                    Inspection.SetRange("Trailer No.", Rec."No.");
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
                begin
                    RequestSyncForCurrentAsset();
                end;
            }
        }
    }

    trigger OnAfterGetCurrRecord()
    begin
        RefreshSummary();
    end;

    local procedure OpenPdfForCurrentRecord()
    var
        Inspection: Record "Record360 Inspection";
        SyncRequest: Codeunit "Record360 Sync Request";
        PdfShareUrl: Text;
    begin
        if not FindLatestInspection(Inspection) then
            Error('No Record360 inspection was found for fixed asset %1.', Rec."No.");

        PdfShareUrl := SyncRequest.GetFreshPdfShareUrl(Inspection."Record360 Inspection ID", Inspection."PDF Share URL");
        if PdfShareUrl = '' then
            Error('No PDF Share URL is available for this inspection.');

        Hyperlink(PdfShareUrl);
    end;

    local procedure OpenDashboardForCurrentRecord()
    var
        Inspection: Record "Record360 Inspection";
    begin
        if not FindLatestInspection(Inspection) then
            Error('No Record360 inspection was found for fixed asset %1.', Rec."No.");

        if Inspection."Dashboard URL" = '' then
            Error('No Record360 dashboard URL is available for this inspection.');

        Hyperlink(Inspection."Dashboard URL");
    end;

    local procedure RequestSyncForCurrentAsset()
    var
        SyncRequest: Codeunit "Record360 Sync Request";
    begin
        if Rec."No." = '' then
            Error('No fixed asset number is available for this Record360 FactBox.');

        SyncRequest.RequestOnDemandSync(Rec."No.");
        Message('Record360 sync request queued for fixed asset %1.', Rec."No.");
    end;

    local procedure RefreshSummary()
    var
        Inspection: Record "Record360 Inspection";
    begin
        LatestText := 'No Record360 data';
        Clear(InspectionDirectionText);
        Clear(EmployeeName);
        Clear(MediaCountText);
        Clear(MatchStatusText);
        Clear(SyncStatusText);
        RequestSyncText := 'Request Sync';

        if not FindLatestInspection(Inspection) then
            exit;

        LatestText := Format(Inspection."Inspection DateTime");
        InspectionDirectionText := Format(Inspection."Inspection Direction");
        EmployeeName := Inspection."Employee Name";
        MediaCountText := Format(Inspection."Media Count");
        MatchStatusText := Format(Inspection."Match Status");
        SyncStatusText := Format(Inspection."Sync Status");
    end;

    local procedure FindLatestInspection(var Inspection: Record "Record360 Inspection"): Boolean
    begin
        Inspection.Reset();
        Inspection.SetRange("Trailer No.", Rec."No.");
        Inspection.SetCurrentKey("Trailer No.", "Inspection DateTime");
        Inspection.Ascending(false);

        exit(Inspection.FindFirst());
    end;

    var
        LatestText: Text[50];
        InspectionDirectionText: Text[30];
        EmployeeName: Text[100];
        MediaCountText: Text[30];
        MatchStatusText: Text[30];
        SyncStatusText: Text[30];
        RequestSyncText: Text[30];
}
