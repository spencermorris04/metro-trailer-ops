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
                    Clear("Customer Address");
                    Clear("Customer City");
                    Clear("Customer ZIP Code");
                    Clear("Customer State");
                    Clear("Customer Country/Region Code");
                    Clear("Phone Number");
                    Clear("Payment Terms Code");
                    exit;
                end;

                Customer.Get("Customer No.");
                "Customer Name" := Customer.Name;
                "Customer Email" := Customer."E-Mail";
                "Customer Address" := Customer.Address;
                "Customer City" := Customer.City;
                "Customer ZIP Code" := Customer."Post Code";
                "Customer State" := Customer.County;
                "Customer Country/Region Code" := Customer."Country/Region Code";
                "Phone Number" := Customer."Phone No.";
                "Payment Terms Code" := Customer."Payment Terms Code";
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
            TableRelation = "Fixed Asset"."No." where(Inactive = const(false), Blocked = const(false));

            trigger OnValidate()
            var
                FixedAsset: Record "Fixed Asset";
            begin
                if "Fixed Asset No." = '' then begin
                    Clear("Unit Description");
                    Clear("Unit No.");
                    Clear(VIN);
                    Clear("Product No.");
                    Clear("Location Code");
                    exit;
                end;

                FixedAsset.Get("Fixed Asset No.");
                if FixedAsset.Inactive then
                    Error('Fixed asset %1 is inactive and cannot be added to an E-Sign lease.', "Fixed Asset No.");
                if FixedAsset.Blocked then
                    Error('Fixed asset %1 is blocked and cannot be added to an E-Sign lease.', "Fixed Asset No.");

                "Unit Description" := FixedAsset.Description;
                "Unit No." := FixedAsset."No.";
                VIN := FixedAsset."Serial No.";
                "Product No." := FixedAsset."FA Subclass Code";
                "Location Code" := FixedAsset."FA Location Code";
                Location := FixedAsset."FA Location Code";
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
        field(24; "Document No."; Code[30])
        {
            Caption = 'No.';
            DataClassification = CustomerContent;
        }
        field(25; "Customer Address"; Text[100])
        {
            Caption = 'Customer Address';
            DataClassification = CustomerContent;
        }
        field(26; "Customer City"; Text[50])
        {
            Caption = 'Customer City';
            DataClassification = CustomerContent;
        }
        field(27; "Customer ZIP Code"; Code[20])
        {
            Caption = 'Customer ZIP Code';
            DataClassification = CustomerContent;
        }
        field(28; "Customer State"; Text[50])
        {
            Caption = 'Customer State';
            DataClassification = CustomerContent;
        }
        field(29; "Customer Country/Region Code"; Code[10])
        {
            Caption = 'Customer Country/Region Code';
            DataClassification = CustomerContent;
            TableRelation = "Country/Region".Code;
        }
        field(30; "Phone Number"; Text[30])
        {
            Caption = 'Phone Number';
            DataClassification = CustomerContent;
        }
        field(31; "Payment Terms Code"; Code[10])
        {
            Caption = 'Payment Terms Code';
            DataClassification = CustomerContent;
            TableRelation = "Payment Terms".Code;
        }
        field(32; "Ordered By"; Text[100])
        {
            Caption = 'Ordered By';
            DataClassification = CustomerContent;
        }
        field(33; "Order No."; Code[30])
        {
            Caption = 'Order No.';
            DataClassification = CustomerContent;
        }
        field(34; "PO No."; Code[30])
        {
            Caption = 'PO No.';
            DataClassification = CustomerContent;
        }
        field(35; "Date Signed"; Date)
        {
            Caption = 'Date Signed';
            DataClassification = CustomerContent;
        }
        field(36; "Inbound Inspection Date"; Date)
        {
            Caption = 'Inbound Inspection Date';
            DataClassification = CustomerContent;
        }
        field(37; "Location Code"; Code[20])
        {
            Caption = 'Location Code';
            DataClassification = CustomerContent;
            TableRelation = Location.Code;
        }
        field(38; "Responsibility Center"; Code[10])
        {
            Caption = 'Responsibility Center';
            DataClassification = CustomerContent;
            TableRelation = "Responsibility Center".Code;
        }
        field(39; "Unit No."; Code[20])
        {
            Caption = 'Unit No.';
            DataClassification = CustomerContent;
            TableRelation = "Fixed Asset"."No." where(Inactive = const(false), Blocked = const(false));

            trigger OnValidate()
            begin
                Validate("Fixed Asset No.", "Unit No.");
            end;
        }
        field(40; "Product No."; Code[30])
        {
            Caption = 'Product No.';
            DataClassification = CustomerContent;
        }
        field(41; "Tag No."; Code[30])
        {
            Caption = 'Tag No.';
            DataClassification = CustomerContent;
        }
        field(42; VIN; Text[50])
        {
            Caption = 'VIN';
            DataClassification = CustomerContent;
        }
        field(43; "Unit Value"; Decimal)
        {
            Caption = 'Value';
            DataClassification = CustomerContent;
            AutoFormatType = 1;
        }
        field(44; "Per Day Rate"; Decimal)
        {
            Caption = 'Per Day Rate';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
        }
        field(45; "Per Week Rate"; Decimal)
        {
            Caption = 'Per Week Rate';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
        }
        field(46; "Per Month Rate"; Decimal)
        {
            Caption = 'Per Month Rate';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
        }
        field(47; "Minimum Period"; Text[50])
        {
            Caption = 'Minimum Period';
            DataClassification = CustomerContent;
        }
        field(48; CPU; Boolean)
        {
            Caption = 'CPU';
            DataClassification = CustomerContent;
        }
        field(49; Del; Text[100])
        {
            Caption = 'Del';
            DataClassification = CustomerContent;
        }
        field(50; Pickup; Text[100])
        {
            Caption = 'Pickup';
            DataClassification = CustomerContent;
        }
        field(51; Year; Text[10])
        {
            Caption = 'Year';
            DataClassification = CustomerContent;
        }
        field(52; Make; Text[50])
        {
            Caption = 'Make';
            DataClassification = CustomerContent;
        }
        field(53; "Unit Status"; Text[50])
        {
            Caption = 'Status';
            DataClassification = CustomerContent;
        }
        field(54; "Inspection Type"; Text[30])
        {
            Caption = 'Inspection Type';
            DataClassification = CustomerContent;
        }
        field(55; "In Amount"; Decimal)
        {
            Caption = 'In';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
        }
        field(56; "Out Amount"; Decimal)
        {
            Caption = 'Out';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
        }
        field(57; "Total Amount"; Decimal)
        {
            Caption = 'Total';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
            Editable = false;
        }
        field(58; "Treadwear Depth"; Decimal)
        {
            Caption = 'Treadwear Depth';
            DataClassification = CustomerContent;
            DecimalPlaces = 0 : 2;
        }
        field(59; "Treadwear Price"; Decimal)
        {
            Caption = 'Treadwear Price';
            DataClassification = CustomerContent;
            DecimalPlaces = 2 : 2;
        }
        field(60; "Outbound Brakes"; Text[30])
        {
            Caption = 'Brakes';
            DataClassification = CustomerContent;
        }
        field(61; "Outbound Landing Gear"; Text[30])
        {
            Caption = 'Landing Gear';
            DataClassification = CustomerContent;
        }
        field(62; "Outbound Lights"; Text[30])
        {
            Caption = 'Lights';
            DataClassification = CustomerContent;
        }
        field(63; "Outbound Undercarriage"; Text[30])
        {
            Caption = 'Undercarriage';
            DataClassification = CustomerContent;
        }
        field(64; "Outbound Doors"; Text[30])
        {
            Caption = 'Doors';
            DataClassification = CustomerContent;
        }
        field(65; "Outbound Flaps"; Text[30])
        {
            Caption = 'Flaps';
            DataClassification = CustomerContent;
        }
        field(66; "Tire Condition"; Text[30])
        {
            Caption = 'Tire Condition';
            DataClassification = CustomerContent;
        }
        field(67; FHWA; Date)
        {
            Caption = 'FHWA';
            DataClassification = CustomerContent;
        }
        field(68; "Outbound Comments"; Text[2048])
        {
            Caption = 'Outbound Comments';
            DataClassification = CustomerContent;
        }
        field(69; "Special Instructions"; Text[2048])
        {
            Caption = 'Special Instructions';
            DataClassification = CustomerContent;
        }
        field(70; "LFO Reading"; Text[20])
        {
            Caption = 'LFO Reading';
            DataClassification = CustomerContent;
        }
        field(71; "LFI Reading"; Text[20])
        {
            Caption = 'LFI Reading';
            DataClassification = CustomerContent;
        }
        field(72; "LRO Reading"; Text[20])
        {
            Caption = 'LRO Reading';
            DataClassification = CustomerContent;
        }
        field(73; "LRI Reading"; Text[20])
        {
            Caption = 'LRI Reading';
            DataClassification = CustomerContent;
        }
        field(74; "RFO Reading"; Text[20])
        {
            Caption = 'RFO Reading';
            DataClassification = CustomerContent;
        }
        field(75; "RFI Reading"; Text[20])
        {
            Caption = 'RFI Reading';
            DataClassification = CustomerContent;
        }
        field(76; "RRO Reading"; Text[20])
        {
            Caption = 'RRO Reading';
            DataClassification = CustomerContent;
        }
        field(77; "RRI Reading"; Text[20])
        {
            Caption = 'RRI Reading';
            DataClassification = CustomerContent;
        }
        field(78; "Inbound LFO Reading"; Text[20])
        {
            Caption = 'LFO Reading';
            DataClassification = CustomerContent;
        }
        field(79; "Inbound LFI Reading"; Text[20])
        {
            Caption = 'LFI Reading';
            DataClassification = CustomerContent;
        }
        field(80; "Inbound LRO Reading"; Text[20])
        {
            Caption = 'LRO Reading';
            DataClassification = CustomerContent;
        }
        field(81; "Inbound LRI Reading"; Text[20])
        {
            Caption = 'LRI Reading';
            DataClassification = CustomerContent;
        }
        field(82; "Inbound RFO Reading"; Text[20])
        {
            Caption = 'RFO Reading';
            DataClassification = CustomerContent;
        }
        field(83; "Inbound RFI Reading"; Text[20])
        {
            Caption = 'RFI Reading';
            DataClassification = CustomerContent;
        }
        field(84; "Inbound RRO Reading"; Text[20])
        {
            Caption = 'RRO Reading';
            DataClassification = CustomerContent;
        }
        field(85; "Inbound RRI Reading"; Text[20])
        {
            Caption = 'RRI Reading';
            DataClassification = CustomerContent;
        }
        field(86; "Inspection In 1"; Text[250])
        {
            Caption = 'Inspection In 1';
            DataClassification = CustomerContent;
        }
        field(87; "Inspection In 2"; Text[250])
        {
            Caption = 'Inspection In 2';
            DataClassification = CustomerContent;
        }
        field(88; "Preview URL"; Text[2048])
        {
            Caption = 'Preview URL';
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

        ApplyDefaultTemplate();

        if "Created At" = 0DT then
            "Created At" := CurrentDateTime();

        "Updated At" := CurrentDateTime();

        if Subject = '' then
            Subject := 'Your signature is requested for a Metro Trailer Document';

        if Message = '' then
            Message := 'Please review the prepared Metro Trailer document and complete any remaining fields. Click the Review and Submit link below to open the document. If the button is missing, copy and paste this link into your browser: {submitter.link} [Review and Submit]({submitter.link})';
    end;

    trigger OnRename()
    begin
        Error('Metro E-Sign leases cannot be renamed.');
    end;

    trigger OnModify()
    begin
        "Total Amount" := "In Amount" + "Out Amount";
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

    local procedure ApplyDefaultTemplate()
    var
        Setup: Record "MTE ESign Setup";
        Template: Record "MTE ESign Template";
    begin
        if "Template Code" <> '' then
            exit;

        if Setup.Get('DEFAULT') and (Setup."Default Template Code" <> '') then
            if Template.Get(Setup."Default Template Code") and Template.Active then begin
                Validate("Template Code", Template.Code);
                exit;
            end;

        Template.SetRange(Active, true);
        if Template.FindFirst() then
            Validate("Template Code", Template.Code);
    end;
}
