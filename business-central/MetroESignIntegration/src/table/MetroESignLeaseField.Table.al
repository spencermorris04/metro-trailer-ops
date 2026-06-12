table 50373 "MTE ESign Lease Field"
{
    Caption = 'Metro E-Sign Document Field';
    DataCaptionFields = "Field Name", Value;
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Lease ID"; Guid)
        {
            Caption = 'Document ID';
            DataClassification = SystemMetadata;
            TableRelation = "MTE ESign Lease"."Lease ID";
        }
        field(2; "Field Name"; Text[100])
        {
            Caption = 'Field Name';
            DataClassification = CustomerContent;
        }
        field(3; Value; Text[2048])
        {
            Caption = 'Value';
            DataClassification = CustomerContent;
        }
        field(4; "Field Label"; Text[100])
        {
            Caption = 'Field';
            DataClassification = CustomerContent;
        }
        field(5; Section; Text[80])
        {
            Caption = 'Section';
            DataClassification = CustomerContent;
        }
        field(6; "Sort Order"; Integer)
        {
            Caption = 'Sort Order';
            DataClassification = SystemMetadata;
        }
    }

    keys
    {
        key(PK; "Lease ID", "Field Name")
        {
            Clustered = true;
        }
        key(LeaseOrder; "Lease ID", "Sort Order")
        {
        }
    }

    trigger OnInsert()
    begin
        EnsureLeaseEditable();
    end;

    trigger OnModify()
    begin
        EnsureLeaseEditable();
    end;

    trigger OnDelete()
    begin
        EnsureLeaseEditable();
    end;

    local procedure EnsureLeaseEditable()
    var
        Lease: Record "MTE ESign Lease";
    begin
        if not Lease.Get("Lease ID") then
            exit;

        if Lease.Status = Lease.Status::Sent then
            Error('Sent Metro E-Sign documents cannot be edited. Void the sent document first.');
    end;
}
