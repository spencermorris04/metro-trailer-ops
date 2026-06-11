table 50375 "MTE ESign Email Attempt"
{
    Caption = 'Metro E-Sign Email Attempt';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Attempt ID"; Guid)
        {
            Caption = 'Attempt ID';
            DataClassification = SystemMetadata;
        }
        field(2; "Lease ID"; Guid)
        {
            Caption = 'Lease ID';
            DataClassification = SystemMetadata;
            TableRelation = "MTE ESign Lease"."Lease ID";
        }
        field(3; "Attempted At"; DateTime)
        {
            Caption = 'Attempted At';
            DataClassification = CustomerContent;
        }
        field(4; "Recipient Email"; Text[250])
        {
            Caption = 'Recipient Email';
            DataClassification = CustomerContent;
        }
        field(5; Subject; Text[250])
        {
            Caption = 'Subject';
            DataClassification = CustomerContent;
        }
        field(6; "Delivery Status"; Text[30])
        {
            Caption = 'Delivery Status';
            DataClassification = CustomerContent;
        }
        field(7; "Delivered At"; DateTime)
        {
            Caption = 'Delivered At';
            DataClassification = CustomerContent;
        }
        field(8; "E-Sign Submission ID"; Integer)
        {
            Caption = 'E-Sign Submission ID';
            DataClassification = SystemMetadata;
        }
        field(9; "Signing URL"; Text[2048])
        {
            Caption = 'Signing URL';
            DataClassification = CustomerContent;
        }
        field(10; "BC User ID"; Text[80])
        {
            Caption = 'BC User ID';
            DataClassification = EndUserIdentifiableInformation;
        }
        field(11; "Error Message"; Text[2048])
        {
            Caption = 'Error Message';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; "Attempt ID")
        {
            Clustered = true;
        }
        key(LeaseAttempt; "Lease ID", "Attempted At")
        {
        }
        key(Submission; "E-Sign Submission ID")
        {
        }
    }

    trigger OnInsert()
    begin
        if IsNullGuid("Attempt ID") then
            "Attempt ID" := CreateGuid();
        if "Attempted At" = 0DT then
            "Attempted At" := CurrentDateTime();
    end;
}
