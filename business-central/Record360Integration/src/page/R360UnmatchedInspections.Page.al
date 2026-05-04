page 50117 "R360 Unmatched Inspections"
{
    PageType = List;
    SourceTable = "Record360 Inspection";
    SourceTableView = where("Match Status" = filter(Unmatched|Ambiguous|Error));
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Record360 Unmatched Inspections';
    Editable = false;
    CardPageId = "Record360 Inspection Card";

    layout
    {
        area(Content)
        {
            repeater(General)
            {
                field("Record360 Inspection ID"; Rec."Record360 Inspection ID")
                {
                    ApplicationArea = All;
                }
                field("Inspection DateTime"; Rec."Inspection DateTime")
                {
                    ApplicationArea = All;
                }
                field("Trailer No."; Rec."Trailer No.")
                {
                    ApplicationArea = All;
                }
                field("Trailer VIN"; Rec."Trailer VIN")
                {
                    ApplicationArea = All;
                }
                field("Normalized Trailer VIN"; Rec."Normalized Trailer VIN")
                {
                    ApplicationArea = All;
                }
                field("Employee Name"; Rec."Employee Name")
                {
                    ApplicationArea = All;
                }
                field("Match Status"; Rec."Match Status")
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

    actions
    {
        area(Processing)
        {
            action(OpenPDF)
            {
                Caption = 'Open PDF';
                ApplicationArea = All;
                Image = Print;

                trigger OnAction()
                begin
                    if Rec."PDF Share URL" = '' then
                        Error('No PDF Share URL is available for this inspection.');

                    Hyperlink(Rec."PDF Share URL");
                end;
            }
            action(OpenDashboard)
            {
                Caption = 'Open Record360 Dashboard';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                begin
                    if Rec."Dashboard URL" = '' then
                        Error('No Record360 dashboard URL is available for this inspection.');

                    Hyperlink(Rec."Dashboard URL");
                end;
            }
        }
    }
}
