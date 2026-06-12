page 50379 "MTE ESign Rental Order FB"
{
    PageType = ListPart;
    SourceTable = "MTE ESign Lease";
    ApplicationArea = All;
    Caption = 'Metro E-Sign';
    Editable = false;

    layout
    {
        area(Content)
        {
            repeater(Documents)
            {
                field("Template Name"; Rec."Template Name")
                {
                    ApplicationArea = All;
                    Caption = 'Document';
                }
                field(Status; Rec.Status)
                {
                    ApplicationArea = All;

                    trigger OnDrillDown()
                    begin
                        OpenSignedDocument();
                    end;
                }
                field("Customer Name"; Rec."Customer Name")
                {
                    ApplicationArea = All;
                }
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                }
                field("Sent At"; Rec."Sent At")
                {
                    ApplicationArea = All;
                }
                field("Signed At"; Rec."Signed At")
                {
                    ApplicationArea = All;
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
                    CreateLeaseForRentalOrder();
                end;
            }
            action(OpenEditor)
            {
                Caption = 'Open Editor';
                ApplicationArea = All;
                Image = EditLines;

                trigger OnAction()
                begin
                    OpenLeaseEditor();
                end;
            }
            action(ViewDocument)
            {
                Caption = 'View Sent/Signed Document';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                begin
                    OpenSignedDocument();
                end;
            }
            action(ViewAll)
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

    trigger OnAfterGetRecord()
    begin
        RefreshCurrentStatus(false);
    end;

    local procedure OpenLeaseEditor()
    begin
        if IsNullGuid(Rec."Lease ID") then
            Error('Select an E-Sign document first.');

        Page.Run(Page::"MTE ESign Lease Card", Rec);
    end;

    local procedure OpenSignedDocument()
    var
        DocumentUrl: Text;
    begin
        if IsNullGuid(Rec."Lease ID") then
            Error('Select an E-Sign document first.');

        RefreshCurrentStatus(true);

        DocumentUrl := Rec."Signed Document URL";
        if DocumentUrl = '' then
            DocumentUrl := Rec."Signing URL";

        if DocumentUrl = '' then
            Error('No sent or signed E-Sign document URL is available for this lease.');

        Hyperlink(DocumentUrl);
    end;

    local procedure RefreshCurrentStatus(RequireSuccess: Boolean)
    var
        Api: Codeunit "MTE ESign API";
    begin
        if Rec."DocuSeal Draft ID" = '' then
            exit;

        if (Rec.Status <> Rec.Status::Sent) and (Rec.Status <> Rec.Status::Signed) then
            exit;

        if RequireSuccess then
            Api.RefreshLeaseStatus(Rec)
        else
            if not Api.TryRefreshLeaseStatus(Rec) then
                exit;
    end;

    local procedure OpenRelatedLeases()
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.CopyFilters(Rec);
        Page.Run(Page::"MTE ESign Leases", Lease);
    end;

    local procedure CreateLeaseForRentalOrder()
    var
        Api: Codeunit "MTE ESign API";
        Lease: Record "MTE ESign Lease";
        LeaseId: Guid;
        RentalOrderNo: Code[30];
    begin
        RentalOrderNo := CopyStr(Rec.GetFilter("Rental Order No."), 1, MaxStrLen(RentalOrderNo));
        if RentalOrderNo = '' then
            Error('No rental order number is available.');

        LeaseId := Api.CreateLeaseForRentalOrder(RentalOrderNo);
        Lease.Get(LeaseId);
        Page.Run(Page::"MTE ESign Lease Card", Lease);
    end;
}
