table 50253 "Telematics Sync API Setup"
{
    Caption = 'Telematics Sync API Setup';
    DataClassification = SystemMetadata;

    fields
    {
        field(1; "Primary Key"; Code[20])
        {
            Caption = 'Primary Key';
            DataClassification = SystemMetadata;
        }
        field(2; "API Base URL"; Text[2048])
        {
            Caption = 'API Base URL';
            DataClassification = SystemMetadata;
        }
        field(3; "API Key"; Text[250])
        {
            Caption = 'API Key';
            DataClassification = SystemMetadata;
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
