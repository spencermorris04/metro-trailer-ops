page 50371 "MTE ESign Templates"
{
    PageType = Card;
    SourceTable = "MTE ESign Setup";
    ApplicationArea = All;
    UsageCategory = Administration;
    Caption = 'Metro E-Sign Template Manager';

    layout
    {
        area(Content)
        {
            usercontrol(TemplateManager; "MTE ESign Web Viewer")
            {
                ApplicationArea = All;

                trigger ControlAddInReady()
                begin
                    ControlReady := true;
                    LoadTemplateManager();
                end;
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
                    CurrPage.Update(false);
                end;
            }
            action(ReloadTemplateManager)
            {
                Caption = 'Reload Manager';
                ApplicationArea = All;
                Image = Refresh;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    LoadedUrl := '';
                    LoadTemplateManager();
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

    local procedure LoadTemplateManager()
    var
        Api: Codeunit "MTE ESign API";
        Url: Text;
    begin
        if not ControlReady then
            exit;

        Url := Api.GetTemplateManagerUrl();
        if Url = LoadedUrl then
            exit;

        LoadedUrl := CopyStr(Url, 1, MaxStrLen(LoadedUrl));
        CurrPage.TemplateManager.Navigate(Url);
    end;

    var
        ControlReady: Boolean;
        LoadedUrl: Text[2048];
}
