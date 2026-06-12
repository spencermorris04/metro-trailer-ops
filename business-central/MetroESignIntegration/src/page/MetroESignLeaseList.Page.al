page 50373 "MTE ESign Leases"
{
    PageType = List;
    SourceTable = "MTE ESign Lease";
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Metro E-Sign Documents';
    CardPageId = "MTE ESign Lease Card";
    Editable = false;

    layout
    {
        area(Content)
        {
            repeater(Leases)
            {
                field(Status; Rec.Status)
                {
                    ApplicationArea = All;

                    trigger OnDrillDown()
                    begin
                        OpenSentSignedDocument();
                    end;
                }
                field("Customer No."; Rec."Customer No.")
                {
                    ApplicationArea = All;
                }
                field("Customer Name"; Rec."Customer Name")
                {
                    ApplicationArea = All;
                }
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                }
                field("Rental Order No."; Rec."Rental Order No.")
                {
                    ApplicationArea = All;
                }
                field("Template Name"; Rec."Template Name")
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
                field("DocuSeal Submission ID"; Rec."DocuSeal Submission ID")
                {
                    ApplicationArea = All;
                    Caption = 'E-Sign Submission ID';
                }
                field("Updated At"; Rec."Updated At")
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
            action(OpenEditor)
            {
                Caption = 'Open Editor';
                ApplicationArea = All;
                Image = EditLines;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    Page.Run(Page::"MTE ESign Lease Card", Rec);
                end;
            }
            action(OpenSigningLink)
            {
                Caption = 'View Sent/Signed Document';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    OpenSentSignedDocument();
                end;
            }
        }
    }

    trigger OnAfterGetRecord()
    begin
        RefreshCurrentStatus(false);
    end;

    local procedure OpenSentSignedDocument()
    var
        DocumentUrl: Text;
    begin
        RefreshCurrentStatus(true);

        DocumentUrl := Rec."Signed Document URL";
        if DocumentUrl = '' then
            DocumentUrl := Rec."Signing URL";

        if DocumentUrl = '' then
            Error('No E-Sign document URL is available for this document.');

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
}
