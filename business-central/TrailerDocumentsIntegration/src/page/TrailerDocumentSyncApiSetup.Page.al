page 50229 "Trailer Doc Sync API Setup"
{
    PageType = Card;
    SourceTable = "Trailer Doc Sync API Setup";
    ApplicationArea = All;
    UsageCategory = Administration;
    Caption = 'Trailer Document Sync API Setup';

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("API Base URL"; Rec."API Base URL")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the AWS API Gateway base URL, without a trailing slash.';
                }
                field("API Key"; Rec."API Key")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the shared API key expected by the AWS sync intake API.';
                }
            }
        }
    }

    trigger OnOpenPage()
    begin
        if not Rec.Get('DEFAULT') then begin
            Rec.Init();
            Rec."Primary Key" := 'DEFAULT';
            Rec.Insert();
        end;
    end;
}
