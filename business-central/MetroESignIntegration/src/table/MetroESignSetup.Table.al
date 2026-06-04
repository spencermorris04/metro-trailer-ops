table 50370 "MTE ESign Setup"
{
    Caption = 'Metro E-Sign Setup';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Primary Key"; Code[10])
        {
            Caption = 'Primary Key';
            DataClassification = SystemMetadata;
        }
        field(2; "API Base URL"; Text[2048])
        {
            Caption = 'API Base URL';
            DataClassification = CustomerContent;
        }
        field(3; "API Key"; Text[250])
        {
            Caption = 'API Key';
            DataClassification = CustomerContent;
        }
        field(4; "Default Template Code"; Code[30])
        {
            Caption = 'Default Template Code';
            DataClassification = CustomerContent;
            TableRelation = "MTE ESign Template".Code where(Active = const(true));
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
