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
        FirstTemplateCode: Code[30];
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

            if FirstTemplateCode = '' then
                FirstTemplateCode := TemplateCode;

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

        if (Setup."Default Template Code" = '') and (FirstTemplateCode <> '') then begin
            Setup."Default Template Code" := FirstTemplateCode;
            Setup.Modify();
        end;

        Message('Metro E-Sign templates refreshed.');
    end;

    procedure PreviewLease(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        PopulateLeaseFields(Lease);
        SyncTypedLeaseFields(Lease);
        EnsureDraft(Lease, false);

        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/prepare');
        ApplyDraftResponse(Lease, ResponseObject);
        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/preview-url');
        ApplyPreviewUrlResponse(Lease, ResponseObject);
        Lease."Last Error" := '';
        Lease.Modify();

        if Lease."Preview URL" = '' then
            Error('Metro E-Sign did not return a preview URL.');
    end;

    procedure SendLease(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        PopulateLeaseFields(Lease);
        SyncTypedLeaseFields(Lease);
        EnsureDraft(Lease, false);

        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/send');
        ApplyDraftResponse(Lease, ResponseObject);
        Lease.Status := Lease.Status::Sent;
        Lease."Sent At" := CurrentDateTime();
        Lease."Last Error" := '';
        Lease.Modify();

        Message('Metro E-Sign document sent.');
    end;

    procedure OpenEditor(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        PopulateLeaseFields(Lease);
        SyncTypedLeaseFields(Lease);
        EnsureDraft(Lease, false);

        ResponseObject := PostJson('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/editor-url', BuildEditorSessionBody());
        ApplyEditorUrlResponse(Lease, ResponseObject);
        Lease."Last Error" := '';
        Lease.Modify();

        if Lease."Editor URL" = '' then
            Error('Metro E-Sign did not return an editor URL.');
    end;

    procedure GetTemplateManagerUrl(): Text
    var
        ResponseObject: JsonObject;
        DataToken: JsonToken;
        Data: JsonObject;
        Url: Text;
    begin
        ResponseObject := PostJson('/api/integrations/business-central/esign/template-manager-url', BuildTemplateManagerSessionBody());

        if ResponseObject.Get('data', DataToken) then
            Data := DataToken.AsObject()
        else
            Data := ResponseObject;

        Url := GetJsonText(Data, 'url');
        if Url = '' then
            Error('Metro E-Sign did not return a template manager URL.');

        exit(Url);
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

    procedure RefreshLeaseStatus(var Lease: Record "MTE ESign Lease")
    var
        ResponseObject: JsonObject;
    begin
        if Lease."DocuSeal Draft ID" = '' then
            exit;

        ResponseObject := PostWithoutBody('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/refresh');
        ApplyDraftResponse(Lease, ResponseObject);
        Lease."Last Error" := '';
        Lease.Modify();
    end;

    [TryFunction]
    procedure TryRefreshLeaseStatus(var Lease: Record "MTE ESign Lease")
    begin
        RefreshLeaseStatus(Lease);
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

    procedure CreateLeaseForRentalOrder(RentalOrderNo: Code[30]): Guid
    var
        Lease: Record "MTE ESign Lease";
    begin
        Lease.Init();
        Lease."Lease ID" := CreateGuid();
        ApplyDefaultTemplate(Lease);
        Lease."Rental Order No." := RentalOrderNo;
        Lease.Insert(true);
        PopulateLeaseFields(Lease);
        exit(Lease."Lease ID");
    end;

    procedure PopulateLeaseFields(var Lease: Record "MTE ESign Lease")
    var
        TemplateField: Record "MTE ESign Template Field";
        LeaseField: Record "MTE ESign Lease Field";
    begin
        EnsureLeaseTemplate(Lease);

        if IsNullGuid(Lease."Lease ID") or (Lease."Template Code" = '') then
            exit;

        TemplateField.SetRange("Template Code", Lease."Template Code");
        if TemplateField.IsEmpty() then begin
            SeedBuiltInTemplateFields(Lease."Template Code");
            TemplateField.Reset();
            TemplateField.SetRange("Template Code", Lease."Template Code");
        end;

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

        SyncTypedLeaseFields(Lease);
    end;

    local procedure SeedBuiltInTemplateFields(TemplateCode: Code[30])
    begin
        if TemplateCode <> 'ROAD_TRAILER_NSH' then
            exit;

        AddBuiltInTemplateField(TemplateCode, 'customer_phone', 'Phone No.', 'Customer and order', 10000);
        AddBuiltInTemplateField(TemplateCode, 'ordered_by', 'Ordered By', 'Customer and order', 20000);
        AddBuiltInTemplateField(TemplateCode, 'customer_number', 'Customer #', 'Customer and order', 30000);
        AddBuiltInTemplateField(TemplateCode, 'order_number', 'Order #', 'Customer and order', 40000);
        AddBuiltInTemplateField(TemplateCode, 'purchase_order_number', 'PO #', 'Customer and order', 50000);
        AddBuiltInTemplateField(TemplateCode, 'agreement_date', 'Date', 'Customer and order', 60000);
        AddBuiltInTemplateField(TemplateCode, 'lessee_name', 'Lessee name', 'Customer and order', 70000);
        AddBuiltInTemplateField(TemplateCode, 'lessee_location', 'Lessee location', 'Customer and order', 80000);
        AddBuiltInTemplateField(TemplateCode, 'unit_number', 'Unit #', 'Equipment', 90000);
        AddBuiltInTemplateField(TemplateCode, 'unit_type', 'Type', 'Equipment', 100000);
        AddBuiltInTemplateField(TemplateCode, 'vin_number', 'VIN #', 'Equipment', 110000);
        AddBuiltInTemplateField(TemplateCode, 'tag_number', 'Tag #', 'Equipment', 120000);
        AddBuiltInTemplateField(TemplateCode, 'rental_rate_per_day', 'Rate per day', 'Rates and terms', 130000);
        AddBuiltInTemplateField(TemplateCode, 'rental_rate_per_week', 'Rate per week', 'Rates and terms', 140000);
        AddBuiltInTemplateField(TemplateCode, 'rental_rate_per_month', 'Rate per month', 'Rates and terms', 150000);
        AddBuiltInTemplateField(TemplateCode, 'rental_rate_additional_terms', 'Additional rate terms', 'Rates and terms', 160000);
        AddBuiltInTemplateField(TemplateCode, 'subject_to_amount', 'Subject to amount', 'Rates and terms', 170000);
        AddBuiltInTemplateField(TemplateCode, 'subject_to_terms', 'Subject to terms', 'Rates and terms', 180000);
        AddBuiltInTemplateField(TemplateCode, 'minimum_lease_period', 'Minimum lease period', 'Rates and terms', 190000);
        AddBuiltInTemplateField(TemplateCode, 'agreement_signed_day', 'Signed day', 'Execution', 200000);
        AddBuiltInTemplateField(TemplateCode, 'agreement_signed_month', 'Signed month', 'Execution', 210000);
        AddBuiltInTemplateField(TemplateCode, 'agreement_signed_year', 'Signed year', 'Execution', 220000);
        AddBuiltInTemplateField(TemplateCode, 'lessee_company_name', 'Company name', 'Execution', 230000);
        AddBuiltInTemplateField(TemplateCode, 'lessee_authorized_agent', 'Authorized agent', 'Execution', 240000);
        AddBuiltInTemplateField(TemplateCode, 'lessee_authorized_agent_title', 'Authorized agent title', 'Execution', 250000);
        AddBuiltInTemplateField(TemplateCode, 'metro_authorized_agent', 'Metro authorized agent', 'Execution', 260000);
        AddBuiltInTemplateField(TemplateCode, 'metro_authorized_agent_title', 'Metro authorized agent title', 'Execution', 270000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_cpu', 'CPU', 'Special instructions', 280000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_pickup', 'Pick-up', 'Special instructions', 290000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_line_1', 'Special instructions line 1', 'Special instructions', 300000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_line_2', 'Special instructions line 2', 'Special instructions', 310000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_line_3', 'Special instructions line 3', 'Special instructions', 320000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_brakes', 'Brakes', 'Inspection out', 330000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_landing_gear', 'Landing gear', 'Inspection out', 340000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_fhwa', 'FHWA', 'Inspection out', 350000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_line_4', 'Special instructions line 4', 'Special instructions', 360000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_lights', 'Lights', 'Inspection out', 370000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_undercarriage', 'Undercarriage', 'Inspection out', 380000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_line_5', 'Special instructions line 5', 'Special instructions', 390000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_doors', 'Doors', 'Inspection out', 400000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_flaps', 'Flaps', 'Inspection out', 410000);
        AddBuiltInTemplateField(TemplateCode, 'special_instructions_line_6', 'Special instructions line 6', 'Special instructions', 420000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_comments_line_1', 'Comments line 1', 'Inspection out', 430000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_comments_line_2', 'Comments line 2', 'Inspection out', 440000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_comments_line_3', 'Comments line 3', 'Inspection out', 450000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_1', 'Inspection in note line 1', 'Inspection in', 460000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_2', 'Inspection in note line 2', 'Inspection in', 470000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_right_side_condition', 'Right side condition', 'Inspection out', 480000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_left_side_condition', 'Left side condition', 'Inspection out', 490000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_front_condition', 'Front condition', 'Inspection out', 500000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_3', 'Inspection in note line 3', 'Inspection in', 510000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_4', 'Inspection in note line 4', 'Inspection in', 520000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_top_condition', 'Top condition', 'Inspection out', 530000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_floor_condition', 'Floor condition', 'Inspection out', 540000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_5', 'Inspection in note line 5', 'Inspection in', 550000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_out_rear_condition', 'Rear condition', 'Inspection out', 560000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_6', 'Inspection in note line 6', 'Inspection in', 570000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_7', 'Inspection in note line 7', 'Inspection in', 580000);
        AddBuiltInTemplateField(TemplateCode, 'tire_lo_front_gauge_out', 'L.O. front gauge out', 'Tire readings', 590000);
        AddBuiltInTemplateField(TemplateCode, 'tire_lo_front_gauge_in', 'L.O. front gauge in', 'Tire readings', 600000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ro_front_gauge_out', 'R.O. front gauge out', 'Tire readings', 610000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ro_front_gauge_in', 'R.O. front gauge in', 'Tire readings', 620000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_8', 'Inspection in note line 8', 'Inspection in', 630000);
        AddBuiltInTemplateField(TemplateCode, 'tire_li_front_gauge_out', 'L.I. front gauge out', 'Tire readings', 640000);
        AddBuiltInTemplateField(TemplateCode, 'tire_li_front_gauge_in', 'L.I. front gauge in', 'Tire readings', 650000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ri_front_gauge_out', 'R.I. front gauge out', 'Tire readings', 660000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ri_front_gauge_in', 'R.I. front gauge in', 'Tire readings', 670000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_notes_line_9', 'Inspection in note line 9', 'Inspection in', 680000);
        AddBuiltInTemplateField(TemplateCode, 'tire_lo_rear_gauge_out', 'L.O. rear gauge out', 'Tire readings', 690000);
        AddBuiltInTemplateField(TemplateCode, 'tire_lo_rear_gauge_in', 'L.O. rear gauge in', 'Tire readings', 700000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ro_rear_gauge_out', 'R.O. rear gauge out', 'Tire readings', 710000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ro_rear_gauge_in', 'R.O. rear gauge in', 'Tire readings', 720000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_month', 'Date in month', 'Inspection in', 730000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_day', 'Date in day', 'Inspection in', 740000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_year', 'Date in year', 'Inspection in', 750000);
        AddBuiltInTemplateField(TemplateCode, 'tire_li_rear_gauge_out', 'L.I. rear gauge out', 'Tire readings', 760000);
        AddBuiltInTemplateField(TemplateCode, 'tire_li_rear_gauge_in', 'L.I. rear gauge in', 'Tire readings', 770000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ri_rear_gauge_out', 'R.I. rear gauge out', 'Tire readings', 780000);
        AddBuiltInTemplateField(TemplateCode, 'tire_ri_rear_gauge_in', 'R.I. rear gauge in', 'Tire readings', 790000);
        AddBuiltInTemplateField(TemplateCode, 'inspection_in_inspected_by', 'Inspected in by', 'Inspection in', 800000);
        AddBuiltInTemplateField(TemplateCode, 'received_by', 'Received by', 'Receipt', 810000);
        AddBuiltInTemplateField(TemplateCode, 'dun', 'DLN', 'Receipt', 820000);
        AddBuiltInTemplateField(TemplateCode, 'received_from', 'Received from', 'Receipt', 830000);
        AddBuiltInTemplateField(TemplateCode, 'print_name', 'Print name', 'Receipt', 840000);
    end;

    local procedure AddBuiltInTemplateField(TemplateCode: Code[30]; FieldName: Text[100]; FieldLabel: Text[100]; Section: Text[80]; SortOrder: Integer)
    var
        TemplateField: Record "MTE ESign Template Field";
    begin
        if TemplateField.Get(TemplateCode, FieldName) then
            exit;

        TemplateField.Init();
        TemplateField."Template Code" := TemplateCode;
        TemplateField."Field Name" := FieldName;
        TemplateField."Field Label" := FieldLabel;
        TemplateField.Section := Section;
        TemplateField."Sort Order" := SortOrder;
        TemplateField.Insert();
    end;

    procedure EnsureLeaseTemplate(var Lease: Record "MTE ESign Lease")
    var
        Setup: Record "MTE ESign Setup";
        Template: Record "MTE ESign Template";
    begin
        if Lease."Template Code" <> '' then
            exit;

        if Setup.Get('DEFAULT') and (Setup."Default Template Code" <> '') then
            if Template.Get(Setup."Default Template Code") and Template.Active then begin
                Lease.Validate("Template Code", Template.Code);
                if not IsNullGuid(Lease."Lease ID") then
                    Lease.Modify();
                exit;
            end;

        Template.SetRange(Active, true);
        if not Template.FindFirst() then begin
            RefreshTemplates();
            Template.Reset();
            Template.SetRange(Active, true);
            if not Template.FindFirst() then
                exit;
        end;

        Lease.Validate("Template Code", Template.Code);
        if not IsNullGuid(Lease."Lease ID") then
            Lease.Modify();
    end;

    local procedure EnsureDraft(var Lease: Record "MTE ESign Lease"; UpdateExisting: Boolean)
    var
        ResponseObject: JsonObject;
    begin
        if (Lease.Status = Lease.Status::Sent) or (Lease.Status = Lease.Status::Signed) then
            Error('This Metro E-Sign lease has already been sent. Void the sent document before sending again.');

        if Lease."DocuSeal Draft ID" <> '' then begin
            if not UpdateExisting then
                exit;

            ResponseObject := PostJson('/api/integrations/business-central/esign/drafts/' + Lease."DocuSeal Draft ID" + '/update', BuildDraftBody(Lease));
            ApplyDraftResponse(Lease, ResponseObject);
            Lease."Last Error" := '';
            Lease.Modify();
            exit;
        end;

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
        AddDraftValue(Values, 'customer_number', Lease."Customer No.");
        AddDraftValue(Values, 'customer_name', Lease."Customer Name");
        AddDraftValue(Values, 'lessee_name', Lease."Customer Name");
        AddDraftValue(Values, 'lessee_location', BuildCustomerLocation(Lease));
        AddDraftValue(Values, 'customer_phone', Lease."Phone Number");
        AddDraftValue(Values, 'ordered_by', Lease."Ordered By");
        AddDraftValue(Values, 'order_number', Lease."Order No.");
        AddDraftValue(Values, 'rental_order_number', Lease."Rental Order No.");
        AddDraftValue(Values, 'purchase_order_number', Lease."PO No.");
        AddDraftValue(Values, 'agreement_date', FormatDateBlank(Lease."Date Signed"));
        AddDraftValue(Values, 'unit_number', Lease."Unit No.");
        AddDraftValue(Values, 'unit_description', Lease."Unit Description");
        AddDraftValue(Values, 'unit_type', Lease."Product No.");
        AddDraftValue(Values, 'vin_number', Lease.VIN);
        AddDraftValue(Values, 'tag_number', Lease."Tag No.");
        AddDraftValue(Values, 'rental_rate_per_day', FormatDecimalBlank(Lease."Per Day Rate"));
        AddDraftValue(Values, 'rental_rate_per_week', FormatDecimalBlank(Lease."Per Week Rate"));
        AddDraftValue(Values, 'rental_rate_per_month', FormatDecimalBlank(Lease."Per Month Rate"));
        AddDraftValue(Values, 'minimum_lease_period', Lease."Minimum Period");
        AddDraftValue(Values, 'special_instructions_cpu', FormatCpu(Lease.CPU));
        AddDraftValue(Values, 'special_instructions_pickup', Lease.Pickup);
        AddDraftValue(Values, 'special_instructions_line_1', Lease."Special Instructions");
        AddDraftValue(Values, 'inspection_out_brakes', Lease."Outbound Brakes");
        AddDraftValue(Values, 'inspection_out_landing_gear', Lease."Outbound Landing Gear");
        AddDraftValue(Values, 'inspection_out_lights', Lease."Outbound Lights");
        AddDraftValue(Values, 'inspection_out_undercarriage', Lease."Outbound Undercarriage");
        AddDraftValue(Values, 'inspection_out_doors', Lease."Outbound Doors");
        AddDraftValue(Values, 'inspection_out_flaps', Lease."Outbound Flaps");
        AddDraftValue(Values, 'inspection_out_fhwa', FormatDateBlank(Lease.FHWA));
        AddDraftValue(Values, 'inspection_out_comments_line_1', Lease."Outbound Comments");
        AddDraftValue(Values, 'tire_lo_front_gauge_out', Lease."LFO Reading");
        AddDraftValue(Values, 'tire_li_front_gauge_out', Lease."LFI Reading");
        AddDraftValue(Values, 'tire_lo_rear_gauge_out', Lease."LRO Reading");
        AddDraftValue(Values, 'tire_li_rear_gauge_out', Lease."LRI Reading");
        AddDraftValue(Values, 'tire_ro_front_gauge_out', Lease."RFO Reading");
        AddDraftValue(Values, 'tire_ri_front_gauge_out', Lease."RFI Reading");
        AddDraftValue(Values, 'tire_ro_rear_gauge_out', Lease."RRO Reading");
        AddDraftValue(Values, 'tire_ri_rear_gauge_out', Lease."RRI Reading");
        AddDraftValue(Values, 'tire_lo_front_gauge_in', Lease."Inbound LFO Reading");
        AddDraftValue(Values, 'tire_li_front_gauge_in', Lease."Inbound LFI Reading");
        AddDraftValue(Values, 'tire_lo_rear_gauge_in', Lease."Inbound LRO Reading");
        AddDraftValue(Values, 'tire_li_rear_gauge_in', Lease."Inbound LRI Reading");
        AddDraftValue(Values, 'tire_ro_front_gauge_in', Lease."Inbound RFO Reading");
        AddDraftValue(Values, 'tire_ri_front_gauge_in', Lease."Inbound RFI Reading");
        AddDraftValue(Values, 'tire_ro_rear_gauge_in', Lease."Inbound RRO Reading");
        AddDraftValue(Values, 'tire_ri_rear_gauge_in', Lease."Inbound RRI Reading");
        AddDraftValue(Values, 'inspection_in_notes_line_1', Lease."Inspection In 1");
        AddDraftValue(Values, 'inspection_in_notes_line_2', Lease."Inspection In 2");
        AddDraftValue(Values, 'inspection_in_month', FormatDatePartBlank(Lease."Inbound Inspection Date", 2));
        AddDraftValue(Values, 'inspection_in_day', FormatDatePartBlank(Lease."Inbound Inspection Date", 1));
        AddDraftValue(Values, 'inspection_in_year', FormatDatePartBlank(Lease."Inbound Inspection Date", 3));

        Field.SetRange("Lease ID", Lease."Lease ID");
        if Field.FindSet() then
            repeat
                if Field."Field Name" <> '' then
                    AddDraftValue(Values, Field."Field Name", Field.Value);
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

    local procedure BuildEditorSessionBody() Body: JsonObject
    begin
        Body.Add('bcUserId', UserId());
        Body.Add('bcUserSecurityId', Format(UserSecurityId()));
        Body.Add('companyName', CompanyName());
        Body.Add('canEdit', true);
        Body.Add('canSend', true);
        Body.Add('canVoid', true);
        Body.Add('canManageTemplates', false);
    end;

    local procedure BuildTemplateManagerSessionBody() Body: JsonObject
    begin
        Body.Add('bcUserId', UserId());
        Body.Add('bcUserSecurityId', Format(UserSecurityId()));
        Body.Add('companyName', CompanyName());
        Body.Add('canEdit', false);
        Body.Add('canSend', false);
        Body.Add('canVoid', false);
        Body.Add('canManageTemplates', true);
    end;

    local procedure SyncTypedLeaseFields(var Lease: Record "MTE ESign Lease")
    begin
        SetLeaseFieldValue(Lease, 'customer_phone', Lease."Phone Number");
        SetLeaseFieldValue(Lease, 'ordered_by', Lease."Ordered By");
        SetLeaseFieldValue(Lease, 'customer_number', Lease."Customer No.");
        SetLeaseFieldValue(Lease, 'order_number', Lease."Order No.");
        SetLeaseFieldValue(Lease, 'purchase_order_number', Lease."PO No.");
        SetLeaseFieldValue(Lease, 'agreement_date', FormatDateBlank(Lease."Date Signed"));
        SetLeaseFieldValue(Lease, 'lessee_name', Lease."Customer Name");
        SetLeaseFieldValue(Lease, 'lessee_location', BuildCustomerLocation(Lease));
        SetLeaseFieldValue(Lease, 'unit_number', Lease."Unit No.");
        SetLeaseFieldValue(Lease, 'unit_type', Lease."Product No.");
        SetLeaseFieldValue(Lease, 'vin_number', Lease.VIN);
        SetLeaseFieldValue(Lease, 'tag_number', Lease."Tag No.");
        SetLeaseFieldValue(Lease, 'rental_rate_per_day', FormatDecimalBlank(Lease."Per Day Rate"));
        SetLeaseFieldValue(Lease, 'rental_rate_per_week', FormatDecimalBlank(Lease."Per Week Rate"));
        SetLeaseFieldValue(Lease, 'rental_rate_per_month', FormatDecimalBlank(Lease."Per Month Rate"));
        SetLeaseFieldValue(Lease, 'minimum_lease_period', Lease."Minimum Period");
        SetLeaseFieldValue(Lease, 'special_instructions_cpu', FormatCpu(Lease.CPU));
        SetLeaseFieldValue(Lease, 'special_instructions_pickup', Lease.Pickup);
        SetLeaseFieldValue(Lease, 'special_instructions_line_1', Lease."Special Instructions");
        SetLeaseFieldValue(Lease, 'inspection_out_brakes', Lease."Outbound Brakes");
        SetLeaseFieldValue(Lease, 'inspection_out_landing_gear', Lease."Outbound Landing Gear");
        SetLeaseFieldValue(Lease, 'inspection_out_lights', Lease."Outbound Lights");
        SetLeaseFieldValue(Lease, 'inspection_out_undercarriage', Lease."Outbound Undercarriage");
        SetLeaseFieldValue(Lease, 'inspection_out_doors', Lease."Outbound Doors");
        SetLeaseFieldValue(Lease, 'inspection_out_flaps', Lease."Outbound Flaps");
        SetLeaseFieldValue(Lease, 'inspection_out_fhwa', FormatDateBlank(Lease.FHWA));
        SetLeaseFieldValue(Lease, 'inspection_out_comments_line_1', Lease."Outbound Comments");
        SetLeaseFieldValue(Lease, 'tire_lo_front_gauge_out', Lease."LFO Reading");
        SetLeaseFieldValue(Lease, 'tire_li_front_gauge_out', Lease."LFI Reading");
        SetLeaseFieldValue(Lease, 'tire_lo_rear_gauge_out', Lease."LRO Reading");
        SetLeaseFieldValue(Lease, 'tire_li_rear_gauge_out', Lease."LRI Reading");
        SetLeaseFieldValue(Lease, 'tire_ro_front_gauge_out', Lease."RFO Reading");
        SetLeaseFieldValue(Lease, 'tire_ri_front_gauge_out', Lease."RFI Reading");
        SetLeaseFieldValue(Lease, 'tire_ro_rear_gauge_out', Lease."RRO Reading");
        SetLeaseFieldValue(Lease, 'tire_ri_rear_gauge_out', Lease."RRI Reading");
        SetLeaseFieldValue(Lease, 'tire_lo_front_gauge_in', Lease."Inbound LFO Reading");
        SetLeaseFieldValue(Lease, 'tire_li_front_gauge_in', Lease."Inbound LFI Reading");
        SetLeaseFieldValue(Lease, 'tire_lo_rear_gauge_in', Lease."Inbound LRO Reading");
        SetLeaseFieldValue(Lease, 'tire_li_rear_gauge_in', Lease."Inbound LRI Reading");
        SetLeaseFieldValue(Lease, 'tire_ro_front_gauge_in', Lease."Inbound RFO Reading");
        SetLeaseFieldValue(Lease, 'tire_ri_front_gauge_in', Lease."Inbound RFI Reading");
        SetLeaseFieldValue(Lease, 'tire_ro_rear_gauge_in', Lease."Inbound RRO Reading");
        SetLeaseFieldValue(Lease, 'tire_ri_rear_gauge_in', Lease."Inbound RRI Reading");
        SetLeaseFieldValue(Lease, 'inspection_in_notes_line_1', Lease."Inspection In 1");
        SetLeaseFieldValue(Lease, 'inspection_in_notes_line_2', Lease."Inspection In 2");
        SetLeaseFieldValue(Lease, 'inspection_in_month', FormatDatePartBlank(Lease."Inbound Inspection Date", 2));
        SetLeaseFieldValue(Lease, 'inspection_in_day', FormatDatePartBlank(Lease."Inbound Inspection Date", 1));
        SetLeaseFieldValue(Lease, 'inspection_in_year', FormatDatePartBlank(Lease."Inbound Inspection Date", 3));
    end;

    local procedure SetLeaseFieldValue(Lease: Record "MTE ESign Lease"; FieldName: Text[100]; FieldValue: Text)
    var
        LeaseField: Record "MTE ESign Lease Field";
    begin
        if IsNullGuid(Lease."Lease ID") then
            exit;

        if not LeaseField.Get(Lease."Lease ID", FieldName) then
            exit;

        if LeaseField.Value = CopyStr(FieldValue, 1, MaxStrLen(LeaseField.Value)) then
            exit;

        LeaseField.Value := CopyStr(FieldValue, 1, MaxStrLen(LeaseField.Value));
        LeaseField.Modify();
    end;

    local procedure AddDraftValue(var Values: JsonObject; Name: Text; Value: Text)
    begin
        if Values.Contains(Name) then
            Values.Replace(Name, Value)
        else
            Values.Add(Name, Value);
    end;

    local procedure BuildCustomerLocation(Lease: Record "MTE ESign Lease"): Text
    var
        LocationText: Text;
    begin
        LocationText := Lease."Customer Address";

        if Lease."Customer City" <> '' then
            LocationText := AddTextPart(LocationText, Lease."Customer City");
        if Lease."Customer State" <> '' then
            LocationText := AddTextPart(LocationText, Lease."Customer State");
        if Lease."Customer ZIP Code" <> '' then
            LocationText := AddTextPart(LocationText, Lease."Customer ZIP Code");

        exit(LocationText);
    end;

    local procedure AddTextPart(Value: Text; Part: Text): Text
    begin
        if Value = '' then
            exit(Part);

        exit(Value + ', ' + Part);
    end;

    local procedure FormatCpu(Cpu: Boolean): Text
    begin
        if Cpu then
            exit('Yes');

        exit('');
    end;

    local procedure FormatDateBlank(Value: Date): Text
    begin
        if Value = 0D then
            exit('');

        exit(Format(Value));
    end;

    local procedure FormatDatePartBlank(Value: Date; PartNo: Integer): Text
    begin
        if Value = 0D then
            exit('');

        exit(Format(Date2DMY(Value, PartNo)));
    end;

    local procedure FormatDecimalBlank(Value: Decimal): Text
    begin
        if Value = 0 then
            exit('');

        exit(Format(Value));
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
                TemplateField."Customer Editable" := GetJsonBoolean(FieldObject, 'customerEditable', false);
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
        Lease."Signed Document URL" := CopyStr(GetJsonText(Data, 'signedDocumentUrl'), 1, MaxStrLen(Lease."Signed Document URL"));

        SubmissionId := GetJsonInteger(Data, 'docusealSubmissionId');
        if SubmissionId <> 0 then
            Lease."DocuSeal Submission ID" := SubmissionId;

        Lease."Signed At" := GetJsonDateTime(Data, 'signedAt');

        StatusText := LowerCase(GetJsonText(Data, 'status'));
        if StatusText = 'signed' then
            Lease.Status := Lease.Status::Signed
        else if StatusText = 'sent' then
            Lease.Status := Lease.Status::Sent
        else if StatusText = 'draft' then
            Lease.Status := Lease.Status::Draft;
    end;

    local procedure ApplyPreviewUrlResponse(var Lease: Record "MTE ESign Lease"; Root: JsonObject)
    var
        DataToken: JsonToken;
        Data: JsonObject;
    begin
        if Root.Get('data', DataToken) then
            Data := DataToken.AsObject()
        else
            Data := Root;

        Lease."Preview URL" := CopyStr(GetJsonText(Data, 'url'), 1, MaxStrLen(Lease."Preview URL"));
    end;

    local procedure ApplyEditorUrlResponse(var Lease: Record "MTE ESign Lease"; Root: JsonObject)
    var
        DataToken: JsonToken;
        Data: JsonObject;
    begin
        if Root.Get('data', DataToken) then
            Data := DataToken.AsObject()
        else
            Data := Root;

        Lease."Editor URL" := CopyStr(GetJsonText(Data, 'url'), 1, MaxStrLen(Lease."Editor URL"));
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

    local procedure GetJsonDateTime(Object: JsonObject; Name: Text): DateTime
    var
        ValueText: Text;
        Year: Integer;
        Month: Integer;
        Day: Integer;
        ParsedDate: Date;
        ParsedTime: Time;
    begin
        ValueText := GetJsonText(Object, Name);
        if ValueText = '' then
            exit(0DT);

        if StrLen(ValueText) < 19 then
            exit(0DT);

        if not Evaluate(Year, CopyStr(ValueText, 1, 4)) then
            exit(0DT);
        if not Evaluate(Month, CopyStr(ValueText, 6, 2)) then
            exit(0DT);
        if not Evaluate(Day, CopyStr(ValueText, 9, 2)) then
            exit(0DT);
        if not Evaluate(ParsedTime, CopyStr(ValueText, 12, 8)) then
            exit(0DT);

        ParsedDate := DMY2Date(Day, Month, Year);
        exit(CreateDateTime(ParsedDate, ParsedTime));
    end;

    local procedure TrimTrailingSlash(Value: Text): Text
    begin
        while CopyStr(Value, StrLen(Value), 1) = '/' do
            Value := CopyStr(Value, 1, StrLen(Value) - 1);

        exit(Value);
    end;
}
