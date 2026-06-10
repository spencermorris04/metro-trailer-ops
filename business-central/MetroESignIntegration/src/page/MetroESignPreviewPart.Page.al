page 50377 "MTE ESign Preview Part"
{
    PageType = CardPart;
    SourceTable = "MTE ESign Lease";
    ApplicationArea = All;
    Caption = 'E-Sign Editor';

    layout
    {
        area(Content)
        {
            usercontrol(Preview; "MTE ESign Web Viewer")
            {
                ApplicationArea = All;

                trigger ControlAddInReady()
                begin
                    ControlReady := true;
                    LoadPreview();
                end;
            }
        }
    }

    trigger OnAfterGetCurrRecord()
    begin
        LoadPreview();
    end;

    local procedure LoadPreview()
    begin
        if not ControlReady then
            exit;

        if (Rec."Editor URL" = '') and (Rec."Preview URL" = '') then begin
            CurrPage.Preview.SetContent(
                '<div style="box-sizing:border-box;height:100%;min-height:360px;padding:24px;font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;color:#334155;">' +
                '<div style="border:1px solid #cbd5e1;background:white;padding:16px;max-width:560px;">' +
                '<div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">Metro E-Sign Editor</div>' +
                '<div style="margin-top:8px;font-size:16px;font-weight:700;color:#0f172a;">No editor loaded</div>' +
                '<div style="margin-top:6px;font-size:13px;line-height:1.45;">Choose Open E-Sign Editor to create the draft and load the dynamic document fields.</div>' +
                '</div></div>');
            exit;
        end;

        if Rec."Editor URL" <> '' then
            CurrPage.Preview.Navigate(Rec."Editor URL")
        else
            CurrPage.Preview.Navigate(Rec."Preview URL");
    end;

    var
        ControlReady: Boolean;
}
