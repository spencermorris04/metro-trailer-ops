table 50374 "MTE ESign Template Field"
{
    Caption = 'Metro E-Sign Template Field';
    DataCaptionFields = "Field Label", "Field Name";
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Template Code"; Code[30])
        {
            Caption = 'Template Code';
            DataClassification = CustomerContent;
            TableRelation = "MTE ESign Template".Code;
        }
        field(2; "Field Name"; Text[100])
        {
            Caption = 'Field Name';
            DataClassification = CustomerContent;
        }
        field(3; "Field Label"; Text[100])
        {
            Caption = 'Field Label';
            DataClassification = CustomerContent;
        }
        field(4; Section; Text[80])
        {
            Caption = 'Section';
            DataClassification = CustomerContent;
        }
        field(5; "Sort Order"; Integer)
        {
            Caption = 'Sort Order';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; "Template Code", "Field Name")
        {
            Clustered = true;
        }
        key(TemplateOrder; "Template Code", "Sort Order")
        {
        }
    }
}
