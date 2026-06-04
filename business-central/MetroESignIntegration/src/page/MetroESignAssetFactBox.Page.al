page 50375 "MTE ESign Asset FB"
{
    PageType = CardPart;
    SourceTable = "Fixed Asset";
    ApplicationArea = All;
    Caption = 'Metro E-Sign';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(Summary)
            {
                ShowCaption = false;

                field(LeaseCountText; LeaseCountText)
                {
                    ApplicationArea = All;
                    Caption = 'Leases';

                    trigger OnDrillDown()
                    begin
                        OpenRelatedLeases();
                    end;
                }
                field(LatestStatusText; LatestStatusText)
                {
                    ApplicationArea = All;
                    Caption = 'Latest Status';
                }
                field(LatestUpdatedAt; LatestUpdatedAt)
                {
                    ApplicationArea = All;
                    Caption = 'Latest Updated';
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(CreateLease)
            {
                Caption = 'Create E-Sign Lease';
                ApplicationArea = All;
                Image = CreateDocument;

                trigger OnAction()
                begin
                    CreateLeaseForAsset();
                end;
            }
            action(ViewLeases)
            {
                Caption = 'View E-Sign Leases';
                ApplicationArea = All;
                Image = List;

                trigger OnAction()
                begin
                    OpenRelatedLeases();
                end;
            }
        }
    }

    trigger OnAfterGetCurrRecord()
    begin
        RefreshSummary();
    end;

    local procedure RefreshSummary()
    var
        Lease: Record "MTE ESign Lease";
        LeaseCount: Integer;
    begin
        Clear(LeaseCountText);
        Clear(LatestStatusText);
        Clear(LatestUpdatedAt);

        Lease.SetRange("Fixed Asset No.", Rec."No.");
        LeaseCount := Lease.Count();
        if LeaseCount = 0 then begin
            LeaseCountText := 'None';
            exit;
        end;

        LeaseCountText := Format(LeaseCount);
        Lease.SetCurrentKey("Fixed Asset No.", Status, "Updated At");
        Lease.Ascending(false);
        if Lease.FindFirst() then begin
            LatestStatusText := Format(Lease.Status);
            LatestUpdatedAt := Lease."Updated At";
        end;
    end;

    local procedure OpenRelatedLeases()
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.SetRange("Fixed Asset No.", Rec."No.");
        Page.Run(Page::"MTE ESign Leases", Lease);
    end;

    local procedure CreateLeaseForAsset()
    var
        Api: Codeunit "MTE ESign API";
        Lease: Record "MTE ESign Lease";
        LeaseId: Guid;
    begin
        if Rec."No." = '' then
            Error('No fixed asset number is available.');

        LeaseId := Api.CreateLeaseForAsset(Rec."No.");
        Lease.Get(LeaseId);
        Page.Run(Page::"MTE ESign Lease Card", Lease);
    end;

    var
        LeaseCountText: Text[30];
        LatestStatusText: Text[30];
        LatestUpdatedAt: DateTime;
}
