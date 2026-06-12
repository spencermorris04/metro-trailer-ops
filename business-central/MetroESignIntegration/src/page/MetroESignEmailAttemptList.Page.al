page 50378 "MTE ESign Email Attempts"
{
    PageType = List;
    SourceTable = "MTE ESign Email Attempt";
    ApplicationArea = All;
    Caption = 'Metro E-Sign Email Attempts';
    UsageCategory = Lists;
    Editable = false;

    layout
    {
        area(Content)
        {
            repeater(Attempts)
            {
                field("Attempted At"; Rec."Attempted At")
                {
                    ApplicationArea = All;
                }
                field("Recipient Email"; Rec."Recipient Email")
                {
                    ApplicationArea = All;
                }
                field(Subject; Rec.Subject)
                {
                    ApplicationArea = All;
                }
                field("Delivery Status"; Rec."Delivery Status")
                {
                    ApplicationArea = All;
                }
                field("Lease ID"; Rec."Lease ID")
                {
                    ApplicationArea = All;
                    Visible = false;
                }
                field("E-Sign Submission ID"; Rec."E-Sign Submission ID")
                {
                    ApplicationArea = All;
                }
                field("BC User ID"; Rec."BC User ID")
                {
                    ApplicationArea = All;
                }
                field("Signing URL"; Rec."Signing URL")
                {
                    ApplicationArea = All;
                }
                field("Error Message"; Rec."Error Message")
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
            action(OpenLease)
            {
                Caption = 'Open Document';
                ApplicationArea = All;
                Image = EditLines;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Lease: Record "MTE ESign Lease";
                begin
                    if IsNullGuid(Rec."Lease ID") then
                        Error('This email attempt is not linked to a Metro E-Sign document.');

                    if not Lease.Get(Rec."Lease ID") then
                        Error('The Metro E-Sign document linked to this email attempt could not be found.');

                    Page.Run(Page::"MTE ESign Lease Card", Lease);
                end;
            }
            action(ViewDocument)
            {
                Caption = 'View E-Sign Document';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    if Rec."Signing URL" = '' then
                        Error('No E-Sign document URL is available for this email attempt.');

                    Hyperlink(Rec."Signing URL");
                end;
            }
        }
    }
}
