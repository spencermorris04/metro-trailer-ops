table 50211 "Trailer Document Sync Run"
{
    Caption = 'Trailer Document Sync Run';
    DataCaptionFields = "Run ID";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Run ID"; Code[50])
        {
            Caption = 'Run ID';
            DataClassification = SystemMetadata;
        }
        field(2; "Started At"; DateTime)
        {
            Caption = 'Started At';
            DataClassification = SystemMetadata;
        }
        field(3; "Finished At"; DateTime)
        {
            Caption = 'Finished At';
            DataClassification = SystemMetadata;
        }
        field(4; Status; Enum "Trailer Doc Sync Run Status")
        {
            Caption = 'Status';
            DataClassification = CustomerContent;
        }
        field(5; Mode; Text[30])
        {
            Caption = 'Mode';
            DataClassification = CustomerContent;
        }
        field(6; "Folders Seen"; Integer)
        {
            Caption = 'Folders Seen';
            DataClassification = CustomerContent;
        }
        field(7; "Records Seen"; Integer)
        {
            Caption = 'Records Seen';
            DataClassification = CustomerContent;
        }
        field(8; "Records Inserted"; Integer)
        {
            Caption = 'Records Inserted';
            DataClassification = CustomerContent;
        }
        field(9; "Records Updated"; Integer)
        {
            Caption = 'Records Updated';
            DataClassification = CustomerContent;
        }
        field(10; "Records Skipped"; Integer)
        {
            Caption = 'Records Skipped';
            DataClassification = CustomerContent;
        }
        field(11; "Records Removed"; Integer)
        {
            Caption = 'Records Removed';
            DataClassification = CustomerContent;
        }
        field(12; "Records Failed"; Integer)
        {
            Caption = 'Records Failed';
            DataClassification = CustomerContent;
        }
        field(13; "Unmatched Count"; Integer)
        {
            Caption = 'Unmatched Count';
            DataClassification = CustomerContent;
        }
        field(14; "Error Summary"; Text[2048])
        {
            Caption = 'Error Summary';
            DataClassification = CustomerContent;
        }
        field(15; "Job Version"; Text[50])
        {
            Caption = 'Job Version';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; "Run ID")
        {
            Clustered = true;
        }
        key(StartedAtKey; "Started At")
        {
        }
    }
}
