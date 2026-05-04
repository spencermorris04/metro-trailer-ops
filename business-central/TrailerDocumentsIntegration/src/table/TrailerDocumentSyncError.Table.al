table 50212 "Trailer Document Sync Error"
{
    Caption = 'Trailer Document Sync Error';
    DataClassification = CustomerContent;

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
        field(3; "SharePoint Item ID"; Text[120])
        {
            Caption = 'SharePoint Item ID';
            DataClassification = SystemMetadata;
        }
        field(4; "Folder ID"; Text[120])
        {
            Caption = 'Folder ID';
            DataClassification = SystemMetadata;
        }
        field(5; "Folder Name"; Text[100])
        {
            Caption = 'Folder Name';
            DataClassification = CustomerContent;
        }
        field(6; "Error Type"; Enum "Trailer Document Error Type")
        {
            Caption = 'Error Type';
            DataClassification = CustomerContent;
        }
        field(7; "Error Message"; Text[2048])
        {
            Caption = 'Error Message';
            DataClassification = CustomerContent;
        }
        field(8; "Raw Payload Pointer"; Text[2048])
        {
            Caption = 'Raw Payload Pointer';
            DataClassification = CustomerContent;
        }
        field(9; "Created At"; DateTime)
        {
            Caption = 'Created At';
            DataClassification = SystemMetadata;
        }
        field(10; Resolved; Boolean)
        {
            Caption = 'Resolved';
            DataClassification = CustomerContent;
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
        key(RunKey; "Run ID")
        {
        }
        key(ItemKey; "SharePoint Item ID")
        {
        }
    }
}
