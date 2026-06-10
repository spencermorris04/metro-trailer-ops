page 50376 "MTE ESign Customer FB"
{
    PageType = CardPart;
    SourceTable = Customer;
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
                field(LatestDocumentText; LatestDocumentText)
                {
                    ApplicationArea = All;
                    Caption = 'Latest Document';

                    trigger OnDrillDown()
                    begin
                        OpenLatestLease();
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
                    CreateLeaseForCustomer();
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
            action(OpenLatestESign)
            {
                Caption = 'Open Latest E-Sign';
                ApplicationArea = All;
                Image = Document;

                trigger OnAction()
                begin
                    OpenLatestLease();
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
        Clear(LatestDocumentText);
        Clear(LatestStatusText);
        Clear(LatestUpdatedAt);

        Lease.SetRange("Customer No.", Rec."No.");
        LeaseCount := Lease.Count();
        if LeaseCount = 0 then begin
            LeaseCountText := 'None';
            exit;
        end;

        LeaseCountText := Format(LeaseCount);
        Lease.SetCurrentKey("Customer No.", Status, "Updated At");
        Lease.Ascending(false);
        if Lease.FindFirst() then begin
            LatestDocumentText := Lease."Template Name";
            if LatestDocumentText = '' then
                LatestDocumentText := Format(Lease."Lease ID");
            LatestStatusText := Format(Lease.Status);
            LatestUpdatedAt := Lease."Updated At";
        end;
    end;

    local procedure OpenRelatedLeases()
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.SetRange("Customer No.", Rec."No.");
        Page.Run(Page::"MTE ESign Leases", Lease);
    end;

    local procedure OpenLatestLease()
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.SetRange("Customer No.", Rec."No.");
        Lease.SetCurrentKey("Customer No.", Status, "Updated At");
        Lease.Ascending(false);
        if not Lease.FindFirst() then
            Error('No E-Sign documents exist for customer %1.', Rec."No.");

        Page.Run(Page::"MTE ESign Lease Card", Lease);
    end;

    local procedure CreateLeaseForCustomer()
    var
        Api: Codeunit "MTE ESign API";
        Lease: Record "MTE ESign Lease";
        LeaseId: Guid;
    begin
        if Rec."No." = '' then
            Error('No customer number is available.');

        LeaseId := Api.CreateLeaseForCustomer(Rec."No.");
        Lease.Get(LeaseId);
        Page.Run(Page::"MTE ESign Lease Card", Lease);
    end;

    var
        LeaseCountText: Text[30];
        LatestDocumentText: Text[100];
        LatestStatusText: Text[30];
        LatestUpdatedAt: DateTime;
}
