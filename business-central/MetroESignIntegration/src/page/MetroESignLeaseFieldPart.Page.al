page 50372 "MTE ESign Field Part"
{
    PageType = ListPart;
    SourceTable = "MTE ESign Lease Field";
    SourceTableView = sorting("Lease ID", "Sort Order");
    ApplicationArea = All;
    Caption = 'Prefill Fields';
    AutoSplitKey = false;

    layout
    {
        area(Content)
        {
            repeater(Fields)
            {
                field(Section; Rec.Section)
                {
                    ApplicationArea = All;
                    Editable = false;
                }
                field("Field Label"; Rec."Field Label")
                {
                    ApplicationArea = All;
                    Caption = 'Field';
                    Editable = false;
                    ToolTip = 'Specifies the document field to prefill.';
                }
                field("Field Name"; Rec."Field Name")
                {
                    ApplicationArea = All;
                    Editable = false;
                    ToolTip = 'Specifies the internal E-Sign field key.';
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
