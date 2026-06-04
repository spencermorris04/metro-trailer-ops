page 50372 "MTE ESign Field Part"
{
    PageType = ListPart;
    SourceTable = "MTE ESign Lease Field";
    ApplicationArea = All;
    Caption = 'Prefill Fields';
    AutoSplitKey = false;

    layout
    {
        area(Content)
        {
            repeater(Fields)
            {
                field("Field Name"; Rec."Field Name")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the DocuSeal field name to prefill.';
                }
                field(Value; Rec.Value)
                {
                    ApplicationArea = All;
                    MultiLine = true;
                    ToolTip = 'Specifies the value to send to DocuSeal for this field.';
                }
            }
        }
    }
}
