table 50160 "SkyBitz Tracker"
{
    Caption = 'SkyBitz Tracker';
    DataCaptionFields = "SkyBitz Asset ID", "Fixed Asset No.";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "MTSN"; Text[30])
        {
            Caption = 'MTSN';
            DataClassification = CustomerContent;
        }
        field(2; "SkyBitz Asset ID"; Text[50])
        {
            Caption = 'SkyBitz Asset ID';
            DataClassification = CustomerContent;
        }
        field(3; "Fixed Asset No."; Code[50])
        {
            Caption = 'Fixed Asset No.';
            DataClassification = CustomerContent;
        }
        field(4; "Fixed Asset SystemId"; Guid)
        {
            Caption = 'Fixed Asset SystemId';
            DataClassification = SystemMetadata;
        }
        field(5; "Asset Type"; Text[50])
        {
            Caption = 'Asset Type';
            DataClassification = CustomerContent;
        }
        field(6; Owner; Text[100])
        {
            Caption = 'Owner';
            DataClassification = CustomerContent;
        }
        field(7; Groups; Text[250])
        {
            Caption = 'Groups';
            DataClassification = CustomerContent;
        }
        field(8; "Message Type"; Text[50])
        {
            Caption = 'Message Type';
            DataClassification = CustomerContent;
        }
        field(9; Latitude; Decimal)
        {
            Caption = 'Latitude';
            DataClassification = CustomerContent;
        }
        field(10; Longitude; Decimal)
        {
            Caption = 'Longitude';
            DataClassification = CustomerContent;
        }
        field(11; Speed; Decimal)
        {
            Caption = 'Speed';
            DataClassification = CustomerContent;
        }
        field(12; Heading; Text[20])
        {
            Caption = 'Heading';
            DataClassification = CustomerContent;
        }
        field(13; "Heading Degrees"; Decimal)
        {
            Caption = 'Heading Degrees';
            DataClassification = CustomerContent;
        }
        field(14; Battery; Text[30])
        {
            Caption = 'Battery';
            DataClassification = CustomerContent;
        }
        field(15; "External Power"; Text[30])
        {
            Caption = 'External Power';
            DataClassification = CustomerContent;
        }
        field(16; "Observation Date Time"; DateTime)
        {
            Caption = 'Observation Date Time';
            DataClassification = CustomerContent;
        }
        field(17; Quality; Text[20])
        {
            Caption = 'Quality';
            DataClassification = CustomerContent;
        }
        field(18; "Landmark Name"; Text[100])
        {
            Caption = 'Landmark Name';
            DataClassification = CustomerContent;
        }
        field(19; "Landmark State"; Text[50])
        {
            Caption = 'Landmark State';
            DataClassification = CustomerContent;
        }
        field(20; "Landmark Country"; Code[10])
        {
            Caption = 'Landmark Country';
            DataClassification = CustomerContent;
        }
        field(21; "Landmark Distance"; Decimal)
        {
            Caption = 'Landmark Distance';
            DataClassification = CustomerContent;
        }
        field(22; "Landmark Direction"; Text[20])
        {
            Caption = 'Landmark Direction';
            DataClassification = CustomerContent;
        }
        field(23; "Geofence Status"; Text[30])
        {
            Caption = 'Geofence Status';
            DataClassification = CustomerContent;
        }
        field(24; "Departure Geofence"; Text[100])
        {
            Caption = 'Departure Geofence';
            DataClassification = CustomerContent;
        }
        field(25; "Serial Sensors JSON"; Text[2048])
        {
            Caption = 'Serial Sensors JSON';
            DataClassification = CustomerContent;
        }
        field(26; "Match Status"; Enum "SkyBitz Match Status")
        {
            Caption = 'Match Status';
            DataClassification = CustomerContent;
        }
        field(27; "Matched By"; Enum "SkyBitz Matched By")
        {
            Caption = 'Matched By';
            DataClassification = CustomerContent;
        }
        field(28; "Sync Status"; Enum "SkyBitz Sync Status")
        {
            Caption = 'Sync Status';
            DataClassification = CustomerContent;
        }
        field(29; "Last Synced At"; DateTime)
        {
            Caption = 'Last Synced At';
            DataClassification = SystemMetadata;
        }
        field(30; "Source Hash"; Text[64])
        {
            Caption = 'Source Hash';
            DataClassification = SystemMetadata;
        }
        field(31; "Last Error"; Text[2048])
        {
            Caption = 'Last Error';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; "MTSN")
        {
            Clustered = true;
        }
        key(AssetId; "SkyBitz Asset ID")
        {
        }
        key(FixedAssetObservation; "Fixed Asset No.", "Observation Date Time")
        {
        }
    }
}
