table 50102 "Record360 Sync Error"
{
    Caption = 'Record360 Sync Error';
    DataCaptionFields = "Run ID", "Record360 Inspection ID";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Entry No."; Integer)
        {
            AutoIncrement = true;
            Caption = 'Entry No.';
            DataClassification = SystemMetadata;
        }
        field(2; "Run ID"; Code[50])
        {
            Caption = 'Run ID';
            DataClassification = SystemMetadata;
            TableRelation = "Record360 Sync Run"."Run ID";
        }
        field(3; "Record360 Inspection ID"; Text[50])
        {
            Caption = 'Record360 Inspection ID';
            DataClassification = CustomerContent;
        }
        field(4; "Error Type"; Enum "R360 Error Type")
        {
            Caption = 'Error Type';
            DataClassification = CustomerContent;
        }
        field(5; "Error Message"; Text[2048])
        {
            Caption = 'Error Message';
            DataClassification = CustomerContent;
        }
        field(6; "Raw Payload Pointer"; Text[2048])
        {
            Caption = 'Raw Payload Pointer';
            DataClassification = CustomerContent;
        }
        field(7; "Created At"; DateTime)
        {
            Caption = 'Created At';
            DataClassification = SystemMetadata;
        }
        field(8; Resolved; Boolean)
        {
            Caption = 'Resolved';
            DataClassification = CustomerContent;
        }
        field(9; "Resolved At"; DateTime)
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
        key(RunInspection; "Run ID", "Record360 Inspection ID")
        {
        }
        key(ResolvedCreatedAt; Resolved, "Created At")
        {
        }
    }
}
