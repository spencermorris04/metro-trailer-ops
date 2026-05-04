enum 50126 "R360 Error Type"
{
    Extensible = true;

    value(0; Unknown)
    {
        Caption = 'Unknown';
    }
    value(1; Validation)
    {
        Caption = 'Validation';
    }
    value(2; TrailerMatch)
    {
        Caption = 'Trailer Match';
    }
    value(3; Api)
    {
        Caption = 'API';
    }
    value(4; Permission)
    {
        Caption = 'Permission';
    }
    value(5; FieldLength)
    {
        Caption = 'Field Length';
    }
}
