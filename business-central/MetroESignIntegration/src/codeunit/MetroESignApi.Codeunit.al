codeunit 50370 "MTE ESign API"
{
    Permissions =
        tabledata "MTE ESign Setup" = r,
        tabledata "MTE ESign Template" = rimd,
        tabledata "MTE ESign Template Field" = rimd,
        tabledata "MTE ESign Lease" = rimd,
        tabledata "MTE ESign Lease Field" = rimd;

    procedure RefreshTemplates()
    var
        Setup: Record "MTE ESign Setup";
        Template: Record "MTE ESign Template";
        Client: HttpClient;
        Response: HttpResponseMessage;
        Root: JsonObject;
        DataToken: JsonToken;
        TemplateToken: JsonToken;
        Templates: JsonArray;
        TemplateObject: JsonObject;
        ResponseText: Text;
        Url: Text;
        TemplateCode: Code[30];
    begin
        GetSetup(Setup);

        Url := TrimTrailingSlash(Setup."API Base URL") + '/api/integrations/business-central/esign/templates';
        Client.DefaultRequestHeaders().Add('X-Metro-Sync-Key', Setup."API Key");

        if not Client.Get(Url, Response) then
            Error('Business Central could not call the Metro E-Sign template API.');

        Response.Content().ReadAs(ResponseText);
        if not Response.IsSuccessStatusCode() then
            Error('Metro E-Sign template API returned %1 %2. %3', Response.HttpStatusCode(), Response.ReasonPhrase(), ResponseText);

        Root.ReadFrom(ResponseText);
        if not Root.Get('data', DataToken) then
            Error('Metro E-Sign template API response did not include data.');

        Templates := DataToken.AsArray();
        foreach TemplateToken in Templates do begin
            TemplateObject := TemplateToken.AsObject();
            TemplateCode := CopyStr(GetJsonText(TemplateObject, 'code'), 1, MaxStrLen(Template.Code));
            if TemplateCode = '' then
                TemplateCode := CopyStr(UpperCase(GetJsonText(TemplateObject, 'templateKey')), 1, MaxStrLen(Template.Code));

            if TemplateCode = '' then
                Error('Metro E-Sign template API returned a template without a code.');

            if not Template.Get(TemplateCode) then begin
                Template.Init();
                Template.Code := TemplateCode;
                Template.Insert();
            end;

            Template.Name := CopyStr(GetJsonText(TemplateObject, 'name'), 1, MaxStrLen(Template.Name));
            Template."Backend Template Key" := CopyStr(GetJsonText(TemplateObject, 'templateKey'), 1, MaxStrLen(Template."Backend Template Key"));
            Template."DocuSeal Template ID" := GetJsonInteger(TemplateObject, 'docusealTemplateId');
            Template.Active := GetJsonBoolean(TemplateObject, 'active', true);
            Template."Last Synced At" := CurrentDateTime();
            Template.Modify();
            RefreshTemplateFields(Template.Code, TemplateObject);
        end;

        Message('Metro E-Sign templates refreshed.');
    end;

    procedure PreviewLease(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        PopulateLeaseFields(Lease);
        EnsureDraft(Lease);

        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/prepare');
        ApplyDraftResponse(Lease, ResponseObject);
        Lease."Last Error" := '';
        Lease.Modify();

        if Lease."Signing URL" = '' then
            Error('Metro E-Sign did not return a preview URL.');

        Hyperlink(Lease."Signing URL");
    end;

    procedure SendLease(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        PopulateLeaseFields(Lease);
        EnsureDraft(Lease);

        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/send');
        ApplyDraftResponse(Lease, ResponseObject);
        Lease.Status := Lease.Status::Sent;
        Lease."Sent At" := CurrentDateTime();
        Lease."Last Error" := '';
        Lease.Modify();

        Message('Metro E-Sign document sent.');
    end;

    procedure InvalidateLease(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        if Lease."DocuSeal Draft ID" = '' then
            Error('This lease does not have a Metro E-Sign draft to invalidate.');

        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/invalidate');
        ApplyDraftResponse(Lease, ResponseObject);
        Lease.Status := Lease.Status::Draft;
        Lease."Voided At" := CurrentDateTime();
        Clear(Lease."Sent At");
        Lease."Last Error" := '';
        Lease.Modify();

        Message('Metro E-Sign document invalidated and reopened for editing.');
    end;

    procedure CreateLeaseForCustomer(CustomerNo: Code[20]): Guid
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.Init();
        Lease."Lease ID" := CreateGuid();
        ApplyDefaultTemplate(Lease);
        Lease.Validate("Customer No.", CustomerNo);
        Lease.Insert(true);
        PopulateLeaseFields(Lease);
        exit(Lease."Lease ID");
    end;

    procedure CreateLeaseForAsset(FixedAssetNo: Code[20]): Guid
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.Init();
        Lease."Lease ID" := CreateGuid();
        ApplyDefaultTemplate(Lease);
        Lease.Validate("Fixed Asset No.", FixedAssetNo);
        Lease.Insert(true);
        PopulateLeaseFields(Lease);
        exit(Lease."Lease ID");
    end;

    procedure PopulateLeaseFields(var Lease: Record "MTE ESign Lease")
    var
        TemplateField: Record "MTE ESign Template Field";
        LeaseField: Record "MTE ESign Lease Field";
    begin
        if IsNullGuid(Lease."Lease ID") or (Lease."Template Code" = '') then
            exit;

        TemplateField.SetRange("Template Code", Lease."Template Code");
        if TemplateField.IsEmpty() then begin
            RefreshTemplates();
            TemplateField.Reset();
            TemplateField.SetRange("Template Code", Lease."Template Code");
        end;

        TemplateField.SetCurrentKey("Template Code", "Sort Order");
        if TemplateField.FindSet() then
            repeat
                if not LeaseField.Get(Lease."Lease ID", TemplateField."Field Name") then begin
                    LeaseField.Init();
                    LeaseField."Lease ID" := Lease."Lease ID";
                    LeaseField."Field Name" := TemplateField."Field Name";
                    LeaseField."Field Label" := TemplateField."Field Label";
                    LeaseField.Section := TemplateField.Section;
                    LeaseField."Sort Order" := TemplateField."Sort Order";
                    LeaseField.Insert();
                end else begin
                    LeaseField."Field Label" := TemplateField."Field Label";
                    LeaseField.Section := TemplateField.Section;
                    LeaseField."Sort Order" := TemplateField."Sort Order";
                    LeaseField.Modify();
                end;
            until TemplateField.Next() = 0;
    end;

    local procedure EnsureDraft(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        if Lease.Status = Lease.Status::Sent then
            Error('This Metro E-Sign lease has already been sent. Void the sent document before sending again.');

        if Lease."DocuSeal Draft ID" <> '' then
            exit;

        if Lease."Backend Template Key" = '' then
            Error('Select a Metro E-Sign template before sending.');

        ResponseObject := PostJson('/api/integrations/business-central/esign/drafts', BuildDraftBody(Lease));
        ApplyDraftResponse(Lease, ResponseObject);
        Lease."Last Error" := '';
        Lease.Modify();
    end;

    local procedure BuildDraftBody(Lease: Record "MTE ESign Lease") Body: JsonObject
    var
        Field: Record "MTE ESign Lease Field";
        Values: JsonObject;
    begin
        Values.Add('customer_number', Lease."Customer No.");
        Values.Add('customer_name', Lease."Customer Name");
        Values.Add('unit_number', Lease."Fixed Asset No.");
        Values.Add('unit_description', Lease."Unit Description");
        Values.Add('rental_order_number', Lease."Rental Order No.");

        Field.SetRange("Lease ID", Lease."Lease ID");
        if Field.FindSet() then
            repeat
                if Field."Field Name" <> '' then
                    Values.Replace(Field."Field Name", Field.Value);
            until Field.Next() = 0;

        Body.Add('templateKey', Lease."Backend Template Key");
        Body.Add('location', Lease.Location);
        Body.Add('customerNo', Lease."Customer No.");
        Body.Add('customerName', Lease."Customer Name");
        Body.Add('customerEmail', Lease."Customer Email");
        Body.Add('fixedAssetNo', Lease."Fixed Asset No.");
        Body.Add('fixedAssetDescription', Lease."Unit Description");
        Body.Add('rentalOrderNo', Lease."Rental Order No.");
        Body.Add('subject', Lease.Subject);
        Body.Add('message', Lease.Message);
        Body.Add('values', Values);
    end;

    local procedure RefreshTemplateFields(TemplateCode: Code[30]; TemplateObject: JsonObject)
    var
        TemplateField: Record "MTE ESign Template Field";
        FieldToken: JsonToken;
        FieldItemToken: JsonToken;
        Fields: JsonArray;
        FieldObject: JsonObject;
        SortOrder: Integer;
        FieldName: Text[100];
    begin
        TemplateField.SetRange("Template Code", TemplateCode);
        TemplateField.DeleteAll();

        if not TemplateObject.Get('fields', FieldToken) then
            exit;

        Fields := FieldToken.AsArray();
        SortOrder := 0;
        foreach FieldItemToken in Fields do begin
            FieldObject := FieldItemToken.AsObject();
            FieldName := CopyStr(GetJsonText(FieldObject, 'name'), 1, MaxStrLen(TemplateField."Field Name"));
            if FieldName <> '' then begin
                SortOrder += 10000;
                TemplateField.Init();
                TemplateField."Template Code" := TemplateCode;
                TemplateField."Field Name" := FieldName;
                TemplateField."Field Label" := CopyStr(GetJsonText(FieldObject, 'label'), 1, MaxStrLen(TemplateField."Field Label"));
                TemplateField.Section := CopyStr(GetJsonText(FieldObject, 'section'), 1, MaxStrLen(TemplateField.Section));
                TemplateField."Sort Order" := SortOrder;
                TemplateField.Insert();
            end;
        end;
    end;

    local procedure ApplyDraftResponse(var Lease: Record "MTE ESign Lease"; Root: JsonObject)
    var
        DataToken: JsonToken;
        Data: JsonObject;
        SubmissionId: Integer;
        StatusText: Text;
    begin
        if Root.Get('data', DataToken) then
            Data := DataToken.AsObject()
        else
            Data := Root;

        Lease."DocuSeal Draft ID" := CopyStr(GetJsonText(Data, 'id'), 1, MaxStrLen(Lease."DocuSeal Draft ID"));
        Lease."Signing URL" := CopyStr(GetJsonText(Data, 'signingUrl'), 1, MaxStrLen(Lease."Signing URL"));

        SubmissionId := GetJsonInteger(Data, 'docusealSubmissionId');
        if SubmissionId <> 0 then
            Lease."DocuSeal Submission ID" := SubmissionId;

        StatusText := LowerCase(GetJsonText(Data, 'status'));
        if StatusText = 'sent' then
            Lease.Status := Lease.Status::Sent
        else
            if StatusText = 'draft' then
                Lease.Status := Lease.Status::Draft;
    end;

    local procedure PostWithoutBody(Path: Text) Root: JsonObject
    var
        Body: JsonObject;
    begin
        exit(PostJson(Path, Body));
    end;

    local procedure PostJson(Path: Text; Body: JsonObject) Root: JsonObject
    var
        Setup: Record "MTE ESign Setup";
        Client: HttpClient;
        Content: HttpContent;
        ContentHeaders: HttpHeaders;
        Response: HttpResponseMessage;
        BodyText: Text;
        ResponseText: Text;
        Url: Text;
    begin
        GetSetup(Setup);

        Url := TrimTrailingSlash(Setup."API Base URL") + Path;
        Body.WriteTo(BodyText);

        Content.WriteFrom(BodyText);
        Content.GetHeaders(ContentHeaders);
        ContentHeaders.Clear();
        ContentHeaders.Add('Content-Type', 'application/json');

        Client.DefaultRequestHeaders().Add('X-Metro-Sync-Key', Setup."API Key");

        if not Client.Post(Url, Content, Response) then
            Error('Business Central could not call the Metro E-Sign API.');

        Response.Content().ReadAs(ResponseText);
        if not Response.IsSuccessStatusCode() then
            Error('Metro E-Sign API returned %1 %2. %3', Response.HttpStatusCode(), Response.ReasonPhrase(), ResponseText);

        Root.ReadFrom(ResponseText);
    end;

    local procedure GetSetup(var Setup: Record "MTE ESign Setup")
    begin
        if not Setup.Get('DEFAULT') then
            Error('Metro E-Sign Setup has not been configured.');

        if Setup."API Base URL" = '' then
            Error('Metro E-Sign API Base URL has not been configured.');

        if Setup."API Key" = '' then
            Error('Metro E-Sign API Key has not been configured.');
    end;

    local procedure ApplyDefaultTemplate(var Lease: Record "MTE ESign Lease")
    var
        Setup: Record "MTE ESign Setup";
    begin
        if Setup.Get('DEFAULT') and (Setup."Default Template Code" <> '') then
            Lease.Validate("Template Code", Setup."Default Template Code");
    end;

    local procedure GetJsonText(Object: JsonObject; Name: Text): Text
    var
        Token: JsonToken;
        ValueText: Text;
    begin
        if Object.Get(Name, Token) then
            if Token.IsValue() then begin
                ValueText := Format(Token.AsValue());
                if LowerCase(ValueText) = 'null' then
                    exit('');
                exit(Token.AsValue().AsText());
            end;

        exit('');
    end;

    local procedure GetJsonInteger(Object: JsonObject; Name: Text): Integer
    var
        Token: JsonToken;
        ValueText: Text;
    begin
        if Object.Get(Name, Token) then
            if Token.IsValue() then begin
                ValueText := Format(Token.AsValue());
                if LowerCase(ValueText) = 'null' then
                    exit(0);
                exit(Token.AsValue().AsInteger());
            end;

        exit(0);
    end;

    local procedure GetJsonBoolean(Object: JsonObject; Name: Text; DefaultValue: Boolean): Boolean
    var
        Token: JsonToken;
        ValueText: Text;
    begin
        if Object.Get(Name, Token) then
            if Token.IsValue() then begin
                ValueText := Format(Token.AsValue());
                if LowerCase(ValueText) = 'null' then
                    exit(DefaultValue);
                exit(Token.AsValue().AsBoolean());
            end;

        exit(DefaultValue);
    end;

    local procedure TrimTrailingSlash(Value: Text): Text
    begin
        while CopyStr(Value, StrLen(Value), 1) = '/' do
            Value := CopyStr(Value, 1, StrLen(Value) - 1);

        exit(Value);
    end;
}
