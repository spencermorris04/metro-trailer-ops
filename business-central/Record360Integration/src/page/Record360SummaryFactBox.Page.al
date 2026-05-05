page 50115 "Record360 Summary FactBox"
{
    PageType = CardPart;
    SourceTable = "Record360 Inspection";
    SourceTableView = sorting("Trailer No.", "Inspection DateTime") order(descending);
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

                field("Inspection DateTime"; Rec."Inspection DateTime")
                {
                    ApplicationArea = All;
                    Caption = 'Latest';
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
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                    Caption = 'Match';
                }
                field("Sync Status"; Rec."Sync Status")
                {
                    ApplicationArea = All;
                    Caption = 'Sync';
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

    local procedure OpenPdfForCurrentRecord()
    begin
        if Rec."PDF Share URL" = '' then
            Error('No PDF Share URL is available for this inspection.');

        Hyperlink(Rec."PDF Share URL");
    end;

    local procedure OpenDashboardForCurrentRecord()
    begin
        if Rec."Dashboard URL" = '' then
            Error('No Record360 dashboard URL is available for this inspection.');

        Hyperlink(Rec."Dashboard URL");
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
}
