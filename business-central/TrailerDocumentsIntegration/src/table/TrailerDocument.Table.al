table 50210 "Trailer Document"
{
    Caption = 'Trailer Document';
    DataCaptionFields = "File Name", "Fixed Asset No.";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "SharePoint Item ID"; Text[120])
        {
            Caption = 'SharePoint Item ID';
            DataClassification = SystemMetadata;
        }
        field(2; "Drive ID"; Text[120])
        {
            Caption = 'Drive ID';
            DataClassification = SystemMetadata;
        }
        field(3; "Site ID"; Text[120])
        {
            Caption = 'Site ID';
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
        field(6; "Folder URL"; Text[2048])
        {
            Caption = 'Folder URL';
            DataClassification = CustomerContent;
        }
        field(7; "Fixed Asset No."; Code[50])
        {
            Caption = 'Fixed Asset No.';
            DataClassification = CustomerContent;
        }
        field(8; "Fixed Asset SystemId"; Guid)
        {
            Caption = 'Fixed Asset SystemId';
            DataClassification = SystemMetadata;
        }
        field(9; "Document Type"; Enum "Trailer Document Type")
        {
            Caption = 'Document Type';
            DataClassification = CustomerContent;
        }
        field(10; "File Name"; Text[250])
        {
            Caption = 'File Name';
            DataClassification = CustomerContent;
        }
        field(11; "File Extension"; Text[20])
        {
            Caption = 'File Extension';
            DataClassification = CustomerContent;
        }
        field(12; "Web URL"; Text[2048])
        {
            Caption = 'Web URL';
            DataClassification = CustomerContent;
        }
        field(13; "Last Modified At"; DateTime)
        {
            Caption = 'Last Modified At';
            DataClassification = CustomerContent;
        }
        field(14; "Created At"; DateTime)
        {
            Caption = 'Created At';
            DataClassification = CustomerContent;
        }
        field(15; "File Size"; BigInteger)
        {
            Caption = 'File Size';
            DataClassification = CustomerContent;
        }
        field(16; "Match Status"; Enum "Trailer Document Match Status")
        {
            Caption = 'Match Status';
            DataClassification = CustomerContent;
        }
        field(17; "Matched By"; Enum "Trailer Document Matched By")
        {
            Caption = 'Matched By';
            DataClassification = CustomerContent;
        }
        field(18; "Sync Status"; Enum "Trailer Document Sync Status")
        {
            Caption = 'Sync Status';
            DataClassification = CustomerContent;
        }
        field(19; "Last Synced At"; DateTime)
        {
            Caption = 'Last Synced At';
            DataClassification = SystemMetadata;
        }
        field(20; "Source Hash"; Text[64])
        {
            Caption = 'Source Hash';
            DataClassification = SystemMetadata;
        }
        field(21; "Last Error"; Text[2048])
        {
            Caption = 'Last Error';
            DataClassification = CustomerContent;
        }
        field(22; Active; Boolean)
        {
            Caption = 'Active';
            DataClassification = CustomerContent;
        }
        field(23; "Removed At"; DateTime)
        {
            Caption = 'Removed At';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; "SharePoint Item ID")
        {
            Clustered = true;
        }
        key(FixedAssetDocument; "Fixed Asset No.", "Document Type", "Last Modified At")
        {
        }
        key(FixedAssetModified; "Fixed Asset No.", "Last Modified At")
        {
        }
        key(FolderDocument; "Folder ID", "Document Type", "Last Modified At")
        {
        }
        key(FolderNameDocument; "Folder Name", "Document Type", "Last Modified At")
        {
        }
        key(MatchStatusKey; "Match Status", Active)
        {
        }
    }
}
