table 50101 "Record360 Sync Run"
{
    Caption = 'Record360 Sync Run';
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
        field(4; Status; Enum "R360 Sync Run Status")
        {
            Caption = 'Status';
            DataClassification = CustomerContent;
        }
        field(5; "Source Window Start"; DateTime)
        {
            Caption = 'Source Window Start';
            DataClassification = CustomerContent;
        }
        field(6; "Source Window End"; DateTime)
        {
            Caption = 'Source Window End';
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
        field(11; "Records Failed"; Integer)
        {
            Caption = 'Records Failed';
            DataClassification = CustomerContent;
        }
        field(12; "Unmatched Count"; Integer)
        {
            Caption = 'Unmatched Count';
            DataClassification = CustomerContent;
        }
        field(13; "Error Summary"; Text[2048])
        {
            Caption = 'Error Summary';
            DataClassification = CustomerContent;
        }
        field(14; "Job Version"; Text[50])
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
        key(StartedAt; "Started At")
        {
        }
    }
}
