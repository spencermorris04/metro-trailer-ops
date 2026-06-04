page 50371 "MTE ESign Templates"
{
    PageType = List;
    SourceTable = "MTE ESign Template";
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Metro E-Sign Templates';
    Editable = true;

    layout
    {
        area(Content)
        {
            repeater(Templates)
            {
                field(Code; Rec.Code)
                {
                    ApplicationArea = All;
                }
                field(Name; Rec.Name)
                {
                    ApplicationArea = All;
                }
                field("Backend Template Key"; Rec."Backend Template Key")
                {
                    ApplicationArea = All;
                }
                field("DocuSeal Template ID"; Rec."DocuSeal Template ID")
                {
                    ApplicationArea = All;
                }
                field(Active; Rec.Active)
                {
                    ApplicationArea = All;
                }
                field("Last Synced At"; Rec."Last Synced At")
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
        }
    }
}
