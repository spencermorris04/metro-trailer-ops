table 50252 "Telematics Sync Error"
{
    Caption = 'Telematics Sync Error';
    DataCaptionFields = "Run ID", "Provider Tracker ID";
    DataClassification = SystemMetadata;

    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
            AutoIncrement = true;
            DataClassification = SystemMetadata;
        }
        field(2; "Run ID"; Code[50])
        {
            Caption = 'Run ID';
            DataClassification = SystemMetadata;
        }
        field(3; Provider; Enum "Telematics Provider")
        {
            Caption = 'Provider';
            DataClassification = SystemMetadata;
        }
        field(4; "Provider Tracker ID"; Text[80])
        {
            Caption = 'Provider Tracker ID';
            DataClassification = SystemMetadata;
        }
        field(5; "Provider Asset ID"; Text[100])
        {
            Caption = 'Provider Asset ID';
            DataClassification = SystemMetadata;
        }
        field(6; "Error Type"; Enum "Telematics Error Type")
        {
            Caption = 'Error Type';
            DataClassification = SystemMetadata;
        }
        field(7; "Error Message"; Text[2048])
        {
            Caption = 'Error Message';
            DataClassification = SystemMetadata;
        }
        field(8; "Raw Payload Pointer"; Text[2048])
        {
            Caption = 'Raw Payload Pointer';
            DataClassification = SystemMetadata;
        }
        field(9; "Created At"; DateTime)
        {
            Caption = 'Created At';
            DataClassification = SystemMetadata;
        }
        field(10; Resolved; Boolean)
        {
            Caption = 'Resolved';
            DataClassification = SystemMetadata;
        }
        field(11; "Resolved At"; DateTime)
        {
            Caption = 'Resolved At';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; "Entry No.")
        {
            Clustered = true;
        }
        key(RunProviderTracker; "Run ID", Provider, "Provider Tracker ID")
        {
        }
    }
}
