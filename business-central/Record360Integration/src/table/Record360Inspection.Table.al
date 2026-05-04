table 50100 "Record360 Inspection"
{
    Caption = 'Record360 Inspection';
    DataCaptionFields = "Record360 Inspection ID", "Trailer No.";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Record360 Inspection ID"; Text[50])
        {
            Caption = 'Record360 Inspection ID';
            DataClassification = CustomerContent;
        }
        field(2; "Trailer VIN"; Text[30])
        {
            Caption = 'Trailer VIN';
            DataClassification = CustomerContent;
        }
        field(3; "Normalized Trailer VIN"; Code[30])
        {
            Caption = 'Normalized Trailer VIN';
            DataClassification = CustomerContent;
        }
        field(4; "Trailer No."; Code[50])
        {
            Caption = 'Trailer No.';
            DataClassification = CustomerContent;
        }
        field(5; "Trailer SystemId"; Guid)
        {
            Caption = 'Trailer SystemId';
            DataClassification = SystemMetadata;
        }
        field(6; "Inspection DateTime"; DateTime)
        {
            Caption = 'Inspection DateTime';
            DataClassification = CustomerContent;
        }
        field(7; "Inspection Direction"; Enum "R360 Inspection Direction")
        {
            Caption = 'Inspection Direction';
            DataClassification = CustomerContent;
        }
        field(8; "New/Used Status"; Enum "R360 New Used Status")
        {
            Caption = 'New/Used Status';
            DataClassification = CustomerContent;
        }
        field(9; "Employee Name"; Text[100])
        {
            Caption = 'Employee Name';
            DataClassification = CustomerContent;
        }
        field(10; Carrier; Text[100])
        {
            Caption = 'Carrier';
            DataClassification = CustomerContent;
        }
        field(11; Driver; Text[100])
        {
            Caption = 'Driver';
            DataClassification = CustomerContent;
        }
        field(12; "Truck No."; Text[50])
        {
            Caption = 'Truck No.';
            DataClassification = CustomerContent;
        }
        field(13; "Contract No."; Text[50])
        {
            Caption = 'Contract No.';
            DataClassification = CustomerContent;
        }
        field(14; Origin; Text[100])
        {
            Caption = 'Origin';
            DataClassification = CustomerContent;
        }
        field(15; Destination; Text[100])
        {
            Caption = 'Destination';
            DataClassification = CustomerContent;
        }
        field(16; "Customer Unit No."; Text[50])
        {
            Caption = 'Customer Unit No.';
            DataClassification = CustomerContent;
        }
        field(17; "Unit Condition"; Text[100])
        {
            Caption = 'Unit Condition';
            DataClassification = CustomerContent;
        }
        field(18; Comments; Text[2048])
        {
            Caption = 'Comments';
            DataClassification = CustomerContent;
        }
        field(19; "Dashboard URL"; Text[2048])
        {
            Caption = 'Dashboard URL';
            DataClassification = CustomerContent;
        }
        field(20; "PDF Share URL"; Text[2048])
        {
            Caption = 'PDF Share URL';
            DataClassification = CustomerContent;
        }
        field(21; "Photo Count"; Integer)
        {
            Caption = 'Photo Count';
            DataClassification = CustomerContent;
        }
        field(22; "Video Count"; Integer)
        {
            Caption = 'Video Count';
            DataClassification = CustomerContent;
        }
        field(23; "Media Count"; Integer)
        {
            Caption = 'Media Count';
            DataClassification = CustomerContent;
        }
        field(24; "Match Status"; Enum "R360 Match Status")
        {
            Caption = 'Match Status';
            DataClassification = CustomerContent;
        }
        field(25; "Matched By"; Enum "R360 Matched By")
        {
            Caption = 'Matched By';
            DataClassification = CustomerContent;
        }
        field(26; "Sync Status"; Enum "R360 Sync Status")
        {
            Caption = 'Sync Status';
            DataClassification = CustomerContent;
        }
        field(27; "Last Synced At"; DateTime)
        {
            Caption = 'Last Synced At';
            DataClassification = SystemMetadata;
        }
        field(28; "Source Hash"; Text[64])
        {
            Caption = 'Source Hash';
            DataClassification = SystemMetadata;
        }
        field(29; "Last Error"; Text[2048])
        {
            Caption = 'Last Error';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; "Record360 Inspection ID")
        {
            Clustered = true;
        }
        key(NormalizedVinDateTime; "Normalized Trailer VIN", "Inspection DateTime")
        {
        }
        key(TrailerNoDateTime; "Trailer No.", "Inspection DateTime")
        {
        }
    }
}
