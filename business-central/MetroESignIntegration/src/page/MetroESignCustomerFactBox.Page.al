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
                    Caption = 'Documents';

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
                        ViewLatestSignedDocument();
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
                Caption = 'Create E-Sign Document';
                ApplicationArea = All;
                Image = CreateDocument;

                trigger OnAction()
                begin
                    CreateLeaseForCustomer();
                end;
            }
            action(ViewLeases)
            {
                Caption = 'View E-Sign Documents';
                ApplicationArea = All;
                Image = List;

                trigger OnAction()
                begin
                    OpenRelatedLeases();
                end;
            }
            action(OpenLatestESign)
            {
                Caption = 'Open Latest Document';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                begin
                    ViewLatestSignedDocument();
                end;
            }
            action(ViewLatestDocument)
            {
                Caption = 'View Latest Sent/Signed Document';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                begin
                    ViewLatestSignedDocument();
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
            RefreshLeaseStatusIfNeeded(Lease);
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

    local procedure ViewLatestSignedDocument()
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.SetRange("Customer No.", Rec."No.");
        Lease.SetFilter("Signing URL", '<>%1', '');
        Lease.SetCurrentKey("Customer No.", Status, "Updated At");
        Lease.Ascending(false);
        if not Lease.FindFirst() then
            Error('No sent or signed E-Sign document URL exists for customer %1.', Rec."No.");

        RefreshLeaseStatusIfNeeded(Lease);

        if Lease."Signed Document URL" <> '' then
            Hyperlink(Lease."Signed Document URL")
        else
            Hyperlink(Lease."Signing URL");
    end;

    local procedure RefreshLeaseStatusIfNeeded(var Lease: Record "MTE ESign Lease")
    var
        Api: Codeunit "MTE ESign API";
    begin
        if Lease."DocuSeal Draft ID" = '' then
            exit;

        if (Lease.Status <> Lease.Status::Sent) and (Lease.Status <> Lease.Status::Signed) then
            exit;

        if not Api.TryRefreshLeaseStatus(Lease) then
            exit;
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
