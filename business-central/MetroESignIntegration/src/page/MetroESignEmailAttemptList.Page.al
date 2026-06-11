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
}
