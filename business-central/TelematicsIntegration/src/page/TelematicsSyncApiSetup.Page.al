page 50263 "Telematics Sync API Setup"
{
    PageType = Card;
    SourceTable = "Telematics Sync API Setup";
    ApplicationArea = All;
    UsageCategory = Administration;
    Caption = 'Telematics Sync API Setup';

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("Primary Key"; Rec."Primary Key")
                {
                    ApplicationArea = All;
                    Editable = false;
                }
                field("API Base URL"; Rec."API Base URL")
                {
                    ApplicationArea = All;
                }
                field("API Key"; Rec."API Key")
                {
                    ApplicationArea = All;
                }
            }
        }
    }

    trigger OnOpenPage()
    begin
        if Rec.Get('DEFAULT') then
            exit;

        Rec.Init();
        Rec."Primary Key" := 'DEFAULT';
        Rec.Insert();
    end;
}
