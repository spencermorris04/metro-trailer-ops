table 50214 "Trailer Doc Sync API Setup"
{
    Caption = 'Trailer Document Sync API Setup';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Primary Key"; Code[10])
        {
            Caption = 'Primary Key';
        }
        field(2; "API Base URL"; Text[2048])
        {
            Caption = 'API Base URL';
        }
        field(3; "API Key"; Text[250])
        {
            Caption = 'API Key';
            ExtendedDatatype = Masked;
        }
    }

    keys
    {
        key(PK; "Primary Key")
        {
            Clustered = true;
        }
    }
}
