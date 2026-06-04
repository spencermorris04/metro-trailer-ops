page 50373 "MTE ESign Leases"
{
    PageType = List;
    SourceTable = "MTE ESign Lease";
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Metro E-Sign Leases';
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
            action(OpenSigningLink)
            {
                Caption = 'Open E-Sign Document';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    if Rec."Signing URL" = '' then
                        Error('No E-Sign document URL is available for this lease.');

                    Hyperlink(Rec."Signing URL");
                end;
            }
        }
    }
}
