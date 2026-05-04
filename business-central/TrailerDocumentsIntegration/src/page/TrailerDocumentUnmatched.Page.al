page 50227 "Trailer Document Unmatched"
{
    PageType = List;
    SourceTable = "Trailer Document";
    SourceTableView = where(Active = const(true), "Match Status" = filter(Unmatched | Ambiguous | Error));
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Trailer Document Unmatched';
    Editable = false;

    layout
    {
        area(Content)
        {
            repeater(Documents)
            {
                field("Folder Name"; Rec."Folder Name")
                {
                    ApplicationArea = All;
                }
                field("Document Type"; Rec."Document Type")
                {
                    ApplicationArea = All;
                }
                field("File Name"; Rec."File Name")
                {
                    ApplicationArea = All;
                }
                field("Last Modified At"; Rec."Last Modified At")
                {
                    ApplicationArea = All;
                }
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                }
                field("Matched By"; Rec."Matched By")
                {
                    ApplicationArea = All;
                }
                field("Last Error"; Rec."Last Error")
                {
                    ApplicationArea = All;
                }
            }
        }
    }
}
