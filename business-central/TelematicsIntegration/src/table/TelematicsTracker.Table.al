table 50250 "Telematics Tracker"
{
    Caption = 'Telematics Tracker';
    DataCaptionFields = Provider, "Provider Asset ID", "Fixed Asset No.";
    DataClassification = CustomerContent;

    fields
    {
        field(1; Provider; Enum "Telematics Provider")
        {
            Caption = 'Provider';
            DataClassification = CustomerContent;
        }
        field(2; "Provider Tracker ID"; Text[80])
        {
            Caption = 'Provider Tracker ID';
            DataClassification = CustomerContent;
        }
        field(3; "Provider Asset ID"; Text[100])
        {
            Caption = 'Provider Asset ID';
            DataClassification = CustomerContent;
        }
        field(4; "Fixed Asset No."; Code[50])
        {
            Caption = 'Fixed Asset No.';
            DataClassification = CustomerContent;
        }
        field(5; "Fixed Asset SystemId"; Guid)
        {
            Caption = 'Fixed Asset SystemId';
            DataClassification = SystemMetadata;
        }
        field(6; "Asset Type"; Text[50])
        {
            Caption = 'Asset Type';
            DataClassification = CustomerContent;
        }
        field(7; "Product Type"; Text[50])
        {
            Caption = 'Product Type';
            DataClassification = CustomerContent;
        }
        field(8; Groups; Text[250])
        {
            Caption = 'Groups';
            DataClassification = CustomerContent;
        }
        field(9; "Message ID"; Text[80])
        {
            Caption = 'Message ID';
            DataClassification = CustomerContent;
        }
        field(10; "Observation Date Time"; DateTime)
        {
            Caption = 'Observation Date Time';
            DataClassification = CustomerContent;
        }
        field(11; "Received Date Time"; DateTime)
        {
            Caption = 'Received Date Time';
            DataClassification = CustomerContent;
        }
        field(12; Latitude; Decimal)
        {
            Caption = 'Latitude';
            DataClassification = CustomerContent;
        }
        field(13; Longitude; Decimal)
        {
            Caption = 'Longitude';
            DataClassification = CustomerContent;
        }
        field(14; Battery; Text[50])
        {
            Caption = 'Battery';
            DataClassification = CustomerContent;
        }
        field(15; "Battery Voltage"; Decimal)
        {
            Caption = 'Battery Voltage';
            DataClassification = CustomerContent;
        }
        field(16; "Power Source"; Text[50])
        {
            Caption = 'Power Source';
            DataClassification = CustomerContent;
        }
        field(17; Speed; Decimal)
        {
            Caption = 'Speed';
            DataClassification = CustomerContent;
        }
        field(18; Heading; Text[50])
        {
            Caption = 'Heading';
            DataClassification = CustomerContent;
        }
        field(19; Address; Text[250])
        {
            Caption = 'Address';
            DataClassification = CustomerContent;
        }
        field(20; City; Text[100])
        {
            Caption = 'City';
            DataClassification = CustomerContent;
        }
        field(21; State; Text[50])
        {
            Caption = 'State';
            DataClassification = CustomerContent;
        }
        field(22; Country; Code[10])
        {
            Caption = 'Country';
            DataClassification = CustomerContent;
        }
        field(23; "Nearest Geofence"; Text[100])
        {
            Caption = 'Nearest Geofence';
            DataClassification = CustomerContent;
        }
        field(24; "Geofence Status"; Text[50])
        {
            Caption = 'Geofence Status';
            DataClassification = CustomerContent;
        }
        field(25; "Match Status"; Enum "Telematics Match Status")
        {
            Caption = 'Match Status';
            DataClassification = CustomerContent;
        }
        field(26; "Matched By"; Enum "Telematics Matched By")
        {
            Caption = 'Matched By';
            DataClassification = CustomerContent;
        }
        field(27; "Sync Status"; Enum "Telematics Sync Status")
        {
            Caption = 'Sync Status';
            DataClassification = CustomerContent;
        }
        field(28; "Last Synced At"; DateTime)
        {
            Caption = 'Last Synced At';
            DataClassification = SystemMetadata;
        }
        field(29; "Source Hash"; Text[64])
        {
            Caption = 'Source Hash';
            DataClassification = SystemMetadata;
        }
        field(30; "Last Error"; Text[2048])
        {
            Caption = 'Last Error';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; Provider, "Provider Tracker ID")
        {
            Clustered = true;
        }
        key(FixedAssetObservation; "Fixed Asset No.", "Observation Date Time")
        {
        }
        key(ProviderAsset; "Provider Asset ID")
        {
        }
    }
}
