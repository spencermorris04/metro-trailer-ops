enum 50205 "Trailer Document Error Type"
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
    value(2; Matching)
    {
        Caption = 'Matching';
    }
    value(3; Api)
    {
        Caption = 'API';
    }
    value(4; Permission)
    {
        Caption = 'Permission';
    }
    value(5; Removed)
    {
        Caption = 'Removed';
    }
}
