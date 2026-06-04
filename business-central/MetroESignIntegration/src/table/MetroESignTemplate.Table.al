table 50371 "MTE ESign Template"
{
    Caption = 'Metro E-Sign Template';
    DataCaptionFields = Code, Name;
    DataClassification = CustomerContent;

    fields
    {
        field(1; Code; Code[30])
        {
            Caption = 'Code';
            DataClassification = CustomerContent;
        }
        field(2; Name; Text[100])
        {
            Caption = 'Name';
            DataClassification = CustomerContent;
        }
        field(3; "Backend Template Key"; Text[100])
        {
            Caption = 'Backend Template Key';
            DataClassification = CustomerContent;
        }
        field(4; "DocuSeal Template ID"; Integer)
        {
            Caption = 'DocuSeal Template ID';
            DataClassification = CustomerContent;
        }
        field(5; Active; Boolean)
        {
            Caption = 'Active';
            DataClassification = CustomerContent;
            InitValue = true;
        }
        field(6; "Last Synced At"; DateTime)
        {
            Caption = 'Last Synced At';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; Code)
        {
            Clustered = true;
        }
        key(ActiveName; Active, Name)
        {
        }
    }
}
