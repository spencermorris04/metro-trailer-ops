table 50161 "SkyBitz Sync Run"
{
    Caption = 'SkyBitz Sync Run';
    DataCaptionFields = "Run ID";
    DataClassification = SystemMetadata;

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
        field(4; Status; Enum "SkyBitz Sync Run Status")
        {
            Caption = 'Status';
            DataClassification = SystemMetadata;
        }
        field(5; "Records Seen"; Integer)
        {
            Caption = 'Records Seen';
            DataClassification = SystemMetadata;
        }
        field(6; "Records Inserted"; Integer)
        {
            Caption = 'Records Inserted';
            DataClassification = SystemMetadata;
        }
        field(7; "Records Updated"; Integer)
        {
            Caption = 'Records Updated';
            DataClassification = SystemMetadata;
        }
        field(8; "Records Skipped"; Integer)
        {
            Caption = 'Records Skipped';
            DataClassification = SystemMetadata;
        }
        field(9; "Records Failed"; Integer)
        {
            Caption = 'Records Failed';
            DataClassification = SystemMetadata;
        }
        field(10; "Matched Count"; Integer)
        {
            Caption = 'Matched Count';
            DataClassification = SystemMetadata;
        }
        field(11; "Unmatched Count"; Integer)
        {
            Caption = 'Unmatched Count';
            DataClassification = SystemMetadata;
        }
        field(12; "Error Summary"; Text[2048])
        {
            Caption = 'Error Summary';
            DataClassification = SystemMetadata;
        }
        field(13; "Job Version"; Text[50])
        {
            Caption = 'Job Version';
            DataClassification = SystemMetadata;
        }
        field(14; "Source Window Start"; DateTime)
        {
            Caption = 'Source Window Start';
            DataClassification = SystemMetadata;
        }
        field(15; "Source Window End"; DateTime)
        {
            Caption = 'Source Window End';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; "Run ID")
        {
            Clustered = true;
        }
    }
}
