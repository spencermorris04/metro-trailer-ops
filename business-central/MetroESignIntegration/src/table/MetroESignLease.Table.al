table 50372 "MTE ESign Lease"
{
    Caption = 'Metro E-Sign Lease';
    DataCaptionFields = "Customer Name", "Fixed Asset No.", "Rental Order No.";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Lease ID"; Guid)
        {
            Caption = 'Lease ID';
            DataClassification = SystemMetadata;
        }
        field(2; "Template Code"; Code[30])
        {
            Caption = 'Template Code';
            DataClassification = CustomerContent;
            TableRelation = "MTE ESign Template".Code where(Active = const(true));

            trigger OnValidate()
            var
                Template: Record "MTE ESign Template";
            begin
                if "Template Code" = '' then begin
                    Clear("Template Name");
                    Clear("Backend Template Key");
                    exit;
                end;

                Template.Get("Template Code");
                "Template Name" := Template.Name;
                "Backend Template Key" := Template."Backend Template Key";
                if "Created At" <> 0DT then
                    PopulateTemplateFields();
            end;
        }
        field(3; "Template Name"; Text[100])
        {
            Caption = 'Template Name';
            DataClassification = CustomerContent;
            Editable = false;
        }
        field(4; "Backend Template Key"; Text[100])
        {
            Caption = 'Backend Template Key';
            DataClassification = CustomerContent;
            Editable = false;
        }
        field(5; Status; Enum "MTE ESign Lease Status")
        {
            Caption = 'Status';
            DataClassification = CustomerContent;
        }
        field(6; "Customer No."; Code[20])
        {
            Caption = 'Customer No.';
            DataClassification = CustomerContent;
            TableRelation = Customer."No.";

            trigger OnValidate()
            var
                Customer: Record Customer;
            begin
                if "Customer No." = '' then begin
                    Clear("Customer Name");
                    Clear("Customer Email");
                    exit;
                end;

                Customer.Get("Customer No.");
                "Customer Name" := Customer.Name;
                "Customer Email" := Customer."E-Mail";
            end;
        }
        field(7; "Customer Name"; Text[100])
        {
            Caption = 'Customer Name';
            DataClassification = CustomerContent;
        }
        field(8; "Customer Email"; Text[250])
        {
            Caption = 'Customer Email';
            DataClassification = CustomerContent;
        }
        field(9; "Fixed Asset No."; Code[20])
        {
            Caption = 'Unit/Trailer No.';
            DataClassification = CustomerContent;
            TableRelation = "Fixed Asset"."No.";

            trigger OnValidate()
            var
                FixedAsset: Record "Fixed Asset";
            begin
                if "Fixed Asset No." = '' then begin
                    Clear("Unit Description");
                    exit;
                end;

                FixedAsset.Get("Fixed Asset No.");
                "Unit Description" := FixedAsset.Description;
            end;
        }
        field(10; "Unit Description"; Text[100])
        {
            Caption = 'Unit Description';
            DataClassification = CustomerContent;
        }
        field(11; "Rental Order No."; Code[30])
        {
            Caption = 'Rental Order No.';
            DataClassification = CustomerContent;
        }
        field(12; Location; Code[30])
        {
            Caption = 'Location';
            DataClassification = CustomerContent;
        }
        field(13; Subject; Text[250])
        {
            Caption = 'Subject';
            DataClassification = CustomerContent;
        }
        field(14; Message; Text[2048])
        {
            Caption = 'Message';
            DataClassification = CustomerContent;
        }
        field(15; "DocuSeal Draft ID"; Text[80])
        {
            Caption = 'E-Sign Draft ID';
            DataClassification = SystemMetadata;
            Editable = false;
        }
        field(16; "DocuSeal Submission ID"; Integer)
        {
            Caption = 'E-Sign Submission ID';
            DataClassification = SystemMetadata;
            Editable = false;
        }
        field(17; "Signing URL"; Text[2048])
        {
            Caption = 'E-Sign Document URL';
            DataClassification = CustomerContent;
            Editable = false;
        }
        field(18; "Last Error"; Text[2048])
        {
            Caption = 'Last Error';
            DataClassification = CustomerContent;
            Editable = false;
        }
        field(19; "Created At"; DateTime)
        {
            Caption = 'Created At';
            DataClassification = SystemMetadata;
            Editable = false;
        }
        field(20; "Updated At"; DateTime)
        {
            Caption = 'Updated At';
            DataClassification = SystemMetadata;
            Editable = false;
        }
        field(21; "Sent At"; DateTime)
        {
            Caption = 'Sent At';
            DataClassification = CustomerContent;
            Editable = false;
        }
        field(22; "Signed At"; DateTime)
        {
            Caption = 'Signed At';
            DataClassification = CustomerContent;
            Editable = false;
        }
        field(23; "Voided At"; DateTime)
        {
            Caption = 'Voided At';
            DataClassification = CustomerContent;
            Editable = false;
        }
    }

    keys
    {
        key(PK; "Lease ID")
        {
            Clustered = true;
        }
        key(CustomerStatus; "Customer No.", Status, "Updated At")
        {
        }
        key(FixedAssetStatus; "Fixed Asset No.", Status, "Updated At")
        {
        }
        key(RentalOrder; "Rental Order No.")
        {
        }
        key(StatusUpdated; Status, "Updated At")
        {
        }
    }

    trigger OnInsert()
    begin
        if IsNullGuid("Lease ID") then
            "Lease ID" := CreateGuid();

        if "Created At" = 0DT then
            "Created At" := CurrentDateTime();

        "Updated At" := CurrentDateTime();

        if Subject = '' then
            Subject := 'Your signature is requested for a Metro Trailer Document';

        if Message = '' then
            Message := 'Please review the prepared Metro Trailer document and complete any remaining fields. Click the Review and Submit link below to open the document. If the button is missing, copy and paste this link into your browser: {submitter.link} [Review and Submit]({submitter.link})';
    end;

    trigger OnModify()
    begin
        "Updated At" := CurrentDateTime();
    end;

    local procedure PopulateTemplateFields()
    var
        TemplateField: Record "MTE ESign Template Field";
        LeaseField: Record "MTE ESign Lease Field";
    begin
        if IsNullGuid("Lease ID") or ("Template Code" = '') then
            exit;

        TemplateField.SetRange("Template Code", "Template Code");
        TemplateField.SetCurrentKey("Template Code", "Sort Order");
        if TemplateField.FindSet() then
            repeat
                if not LeaseField.Get("Lease ID", TemplateField."Field Name") then begin
                    LeaseField.Init();
                    LeaseField."Lease ID" := "Lease ID";
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
}
