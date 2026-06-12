page 50370 "MTE ESign Setup"
{
    PageType = Card;
    SourceTable = "MTE ESign Setup";
    ApplicationArea = All;
    UsageCategory = Administration;
    Caption = 'Metro E-Sign Setup';

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("API Base URL"; Rec."API Base URL")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the Metro Trailer app base URL, without a trailing slash.';
                }
                field("API Key"; Rec."API Key")
                {
                    ApplicationArea = All;
                    ExtendedDatatype = Masked;
                    ToolTip = 'Specifies the shared API key expected by the Metro Trailer app Business Central E-Sign API.';
                }
                field("Default Template Code"; Rec."Default Template Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the default E-Sign template for new documents.';
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(RefreshTemplates)
            {
                Caption = 'Refresh Templates';
                ApplicationArea = All;
                Image = Refresh;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    Api.RefreshTemplates();
                end;
            }
            action(OpenESignAdmin)
            {
                Caption = 'Open E-Sign Admin';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    Hyperlink('https://esign.metrotrailer.com');
                end;
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
