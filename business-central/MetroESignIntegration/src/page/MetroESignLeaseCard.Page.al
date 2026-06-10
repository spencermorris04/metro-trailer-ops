page 50374 "MTE ESign Lease Card"
{
    PageType = Card;
    SourceTable = "MTE ESign Lease";
    ApplicationArea = All;
    UsageCategory = Documents;
    Caption = 'Metro E-Sign';

    layout
    {
        area(Content)
        {
            part(Editor; "MTE ESign Preview Part")
            {
                ApplicationArea = All;
                SubPageLink = "Lease ID" = field("Lease ID");
            }
        }
    }

    trigger OnNewRecord(BelowxRec: Boolean)
    var
        Api: Codeunit "MTE ESign API";
    begin
        Api.EnsureLeaseTemplate(Rec);
    end;
}
