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

                trigger EditorStateChanged(Payload: Text)
                begin
                    ApplyEditorState(Payload);
                end;
            }
        }
    }

    trigger OnAfterGetCurrRecord()
    begin
        LoadPreview();
    end;

    local procedure LoadPreview()
    var
        Api: Codeunit "MTE ESign API";
    begin
        if not ControlReady then
            exit;

        if (Rec."Editor URL" = '') and (not IsNullGuid(Rec."Lease ID")) then begin
            Api.OpenEditor(Rec);
            CurrPage.Update(false);
        end;

        if (Rec."Editor URL" = '') and (Rec."Preview URL" = '') then begin
            CurrPage.Preview.SetContent(
                '<div style="box-sizing:border-box;height:100%;min-height:360px;padding:24px;font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;color:#334155;">' +
                '<div style="border:1px solid #cbd5e1;background:white;padding:16px;max-width:560px;">' +
                '<div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">Metro E-Sign Editor</div>' +
                '<div style="margin-top:8px;font-size:16px;font-weight:700;color:#0f172a;">No editor loaded</div>' +
                '<div style="margin-top:6px;font-size:13px;line-height:1.45;">The E-Sign control record is still being created. Refresh this page if the editor does not load automatically.</div>' +
                '</div></div>');
            exit;
        end;

        if Rec."Editor URL" <> '' then
            NavigateOnce(Rec."Editor URL")
        else
            NavigateOnce(Rec."Preview URL");
    end;

    local procedure NavigateOnce(Url: Text)
    begin
        if Url = '' then
            exit;

        if LoadedUrl = Url then
            exit;

        LoadedUrl := CopyStr(Url, 1, MaxStrLen(LoadedUrl));
        CurrPage.Preview.Navigate(Url);
    end;

    local procedure ApplyEditorState(Payload: Text)
    var
        Customer: Record Customer;
        FixedAsset: Record "Fixed Asset";
        Root: JsonObject;
        Changed: Boolean;
        CustomerNo: Code[20];
        CustomerName: Text[100];
        CustomerEmail: Text[250];
        FixedAssetNo: Code[20];
        UnitDescription: Text[100];
        RentalOrderNo: Code[30];
        LocationCode: Code[30];
        StatusText: Text;
        SigningUrl: Text[2048];
        EmailRecipient: Text[250];
        EmailSubject: Text[250];
        BcUserId: Text[80];
        SubmissionId: Integer;
        PreviousSubmissionId: Integer;
        WasSent: Boolean;
    begin
        if Payload = '' then
            exit;

        if not Root.ReadFrom(Payload) then
            exit;

        CustomerNo := CopyStr(GetJsonText(Root, 'customerNo'), 1, MaxStrLen(CustomerNo));
        CustomerName := CopyStr(GetJsonText(Root, 'customerName'), 1, MaxStrLen(CustomerName));
        CustomerEmail := CopyStr(GetJsonText(Root, 'customerEmail'), 1, MaxStrLen(CustomerEmail));
        FixedAssetNo := CopyStr(GetJsonText(Root, 'unitNo'), 1, MaxStrLen(FixedAssetNo));
        UnitDescription := CopyStr(GetJsonText(Root, 'unitDescription'), 1, MaxStrLen(UnitDescription));
        RentalOrderNo := CopyStr(GetJsonText(Root, 'rentalOrderNo'), 1, MaxStrLen(RentalOrderNo));
        LocationCode := CopyStr(GetJsonText(Root, 'location'), 1, MaxStrLen(LocationCode));
        StatusText := LowerCase(GetJsonText(Root, 'status'));
        SigningUrl := CopyStr(GetJsonText(Root, 'signingUrl'), 1, MaxStrLen(SigningUrl));
        EmailRecipient := CopyStr(GetJsonText(Root, 'emailRecipient'), 1, MaxStrLen(EmailRecipient));
        EmailSubject := CopyStr(GetJsonText(Root, 'emailSubject'), 1, MaxStrLen(EmailSubject));
        BcUserId := CopyStr(GetJsonText(Root, 'bcUserId'), 1, MaxStrLen(BcUserId));
        SubmissionId := GetJsonInteger(Root, 'docusealSubmissionId');
        PreviousSubmissionId := Rec."DocuSeal Submission ID";
        WasSent := Rec.Status = Rec.Status::Sent;

        if (CustomerNo <> '') and (Rec."Customer No." <> CustomerNo) then begin
            if Customer.Get(CustomerNo) then
                Rec.Validate("Customer No.", CustomerNo)
            else
                Rec."Customer No." := CustomerNo;
            Changed := true;
        end;
        if (CustomerName <> '') and (Rec."Customer Name" <> CustomerName) then begin
            Rec."Customer Name" := CustomerName;
            Changed := true;
        end;
        if (CustomerEmail <> '') and (Rec."Customer Email" <> CustomerEmail) then begin
            Rec."Customer Email" := CustomerEmail;
            Changed := true;
        end;

        if (FixedAssetNo <> '') and (Rec."Fixed Asset No." <> FixedAssetNo) then begin
            if FixedAsset.Get(FixedAssetNo) then
                Rec.Validate("Fixed Asset No.", FixedAssetNo)
            else begin
                Rec."Fixed Asset No." := FixedAssetNo;
                Rec."Unit No." := FixedAssetNo;
            end;
            Changed := true;
        end;
        if (UnitDescription <> '') and (Rec."Unit Description" <> UnitDescription) then begin
            Rec."Unit Description" := UnitDescription;
            Changed := true;
        end;
        if (RentalOrderNo <> '') and (Rec."Rental Order No." <> RentalOrderNo) then begin
            Rec."Rental Order No." := RentalOrderNo;
            Changed := true;
        end;
        if (LocationCode <> '') and (Rec.Location <> LocationCode) then begin
            Rec.Location := LocationCode;
            Changed := true;
        end;
        if (SigningUrl <> '') and (Rec."Signing URL" <> SigningUrl) then begin
            Rec."Signing URL" := SigningUrl;
            Changed := true;
        end;
        if (SubmissionId <> 0) and (Rec."DocuSeal Submission ID" <> SubmissionId) then begin
            Rec."DocuSeal Submission ID" := SubmissionId;
            Changed := true;
        end;

        if StatusText = 'sent' then begin
            if Rec.Status <> Rec.Status::Sent then begin
                Rec.Status := Rec.Status::Sent;
                Changed := true;
            end;
            if Rec."Sent At" = 0DT then begin
                Rec."Sent At" := CurrentDateTime();
                Changed := true;
            end;
        end else
            if StatusText = 'draft' then
                if Rec.Status <> Rec.Status::Draft then begin
                    Rec.Status := Rec.Status::Draft;
                    Clear(Rec."Sent At");
                    Changed := true;
                end;

        if Changed then begin
            Rec.Modify(true);
        end;

        if StatusText = 'sent' then
            if (not WasSent) or ((SubmissionId <> 0) and (PreviousSubmissionId <> SubmissionId)) then
                RecordEmailAttempt(SubmissionId, SigningUrl, EmailRecipient, EmailSubject, BcUserId);
    end;

    local procedure RecordEmailAttempt(SubmissionId: Integer; SigningUrl: Text[2048]; EmailRecipient: Text[250]; EmailSubject: Text[250]; BcUserId: Text[80])
    var
        EmailAttempt: Record "MTE ESign Email Attempt";
    begin
        if SubmissionId = 0 then
            exit;

        EmailAttempt.SetRange("Lease ID", Rec."Lease ID");
        EmailAttempt.SetRange("E-Sign Submission ID", SubmissionId);
        if not EmailAttempt.IsEmpty() then
            exit;

        EmailAttempt.Init();
        EmailAttempt."Lease ID" := Rec."Lease ID";
        EmailAttempt."Attempted At" := CurrentDateTime();
        if EmailRecipient <> '' then
            EmailAttempt."Recipient Email" := EmailRecipient
        else
            EmailAttempt."Recipient Email" := Rec."Customer Email";
        if EmailSubject <> '' then
            EmailAttempt.Subject := EmailSubject
        else
            EmailAttempt.Subject := Rec.Subject;
        EmailAttempt."Delivery Status" := 'Submitted';
        EmailAttempt."E-Sign Submission ID" := SubmissionId;
        if SigningUrl <> '' then
            EmailAttempt."Signing URL" := SigningUrl
        else
            EmailAttempt."Signing URL" := Rec."Signing URL";
        if BcUserId <> '' then
            EmailAttempt."BC User ID" := BcUserId
        else
            EmailAttempt."BC User ID" := UserId();
        EmailAttempt.Insert(true);
    end;

    local procedure GetJsonText(Object: JsonObject; Name: Text): Text
    var
        Token: JsonToken;
    begin
        if not Object.Get(Name, Token) then
            exit('');
        if Token.AsValue().IsNull() then
            exit('');
        exit(Token.AsValue().AsText());
    end;

    local procedure GetJsonInteger(Object: JsonObject; Name: Text): Integer
    var
        Token: JsonToken;
    begin
        if not Object.Get(Name, Token) then
            exit(0);
        if Token.AsValue().IsNull() then
            exit(0);
        exit(Token.AsValue().AsInteger());
    end;

    var
        ControlReady: Boolean;
        LoadedUrl: Text[2048];
}
