table 50162 "SkyBitz Sync Error"
{
    Caption = 'SkyBitz Sync Error';
    DataCaptionFields = "Run ID", "MTSN";
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
        field(3; "MTSN"; Text[30])
        {
            Caption = 'MTSN';
            DataClassification = SystemMetadata;
        }
        field(4; "SkyBitz Asset ID"; Text[50])
        {
            Caption = 'SkyBitz Asset ID';
            DataClassification = SystemMetadata;
        }
        field(5; "Error Type"; Enum "SkyBitz Error Type")
        {
            Caption = 'Error Type';
            DataClassification = SystemMetadata;
        }
        field(6; "Error Message"; Text[2048])
        {
            Caption = 'Error Message';
            DataClassification = SystemMetadata;
        }
        field(7; "Raw Payload Pointer"; Text[2048])
        {
            Caption = 'Raw Payload Pointer';
            DataClassification = SystemMetadata;
        }
        field(8; "Created At"; DateTime)
        {
            Caption = 'Created At';
            DataClassification = SystemMetadata;
        }
        field(9; Resolved; Boolean)
        {
            Caption = 'Resolved';
            DataClassification = SystemMetadata;
        }
        field(10; "Resolved At"; DateTime)
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
        key(RunMtsn; "Run ID", "MTSN")
        {
        }
    }
}
