table 50213 "SP Trailer Folder State"
{
    Caption = 'SharePoint Trailer Folder State';
    DataCaptionFields = "Folder Name", "Fixed Asset No.";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Folder Name"; Text[100])
        {
            Caption = 'Folder Name';
            DataClassification = CustomerContent;
        }
        field(2; "Folder ID"; Text[120])
        {
            Caption = 'Folder ID';
            DataClassification = SystemMetadata;
        }
        field(3; "Drive ID"; Text[120])
        {
            Caption = 'Drive ID';
            DataClassification = SystemMetadata;
        }
        field(4; "Site ID"; Text[120])
        {
            Caption = 'Site ID';
            DataClassification = SystemMetadata;
        }
        field(5; "Folder URL"; Text[2048])
        {
            Caption = 'Folder URL';
            DataClassification = CustomerContent;
        }
        field(6; "Fixed Asset No."; Code[50])
        {
            Caption = 'Fixed Asset No.';
            DataClassification = CustomerContent;
        }
        field(7; "Seen Status"; Enum "Trailer Folder Seen Status")
        {
            Caption = 'Seen Status';
            DataClassification = CustomerContent;
        }
        field(8; "Last Full Traversed At"; DateTime)
        {
            Caption = 'Last Full Traversed At';
            DataClassification = SystemMetadata;
        }
        field(9; "Last Delta Refreshed At"; DateTime)
        {
            Caption = 'Last Delta Refreshed At';
            DataClassification = SystemMetadata;
        }
        field(10; "Last Success At"; DateTime)
        {
            Caption = 'Last Success At';
            DataClassification = SystemMetadata;
        }
        field(11; "Last Failure At"; DateTime)
        {
            Caption = 'Last Failure At';
            DataClassification = SystemMetadata;
        }
        field(12; "Last Error"; Text[2048])
        {
            Caption = 'Last Error';
            DataClassification = CustomerContent;
        }
        field(13; "Last Item Count"; Integer)
        {
            Caption = 'Last Item Count';
            DataClassification = CustomerContent;
        }
        field(14; Active; Boolean)
        {
            Caption = 'Active';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; "Folder Name")
        {
            Clustered = true;
        }
        key(FolderIdKey; "Folder ID")
        {
        }
        key(SeenStatusKey; "Seen Status", Active)
        {
        }
        key(FixedAssetKey; "Fixed Asset No.", "Seen Status")
        {
        }
    }
}
