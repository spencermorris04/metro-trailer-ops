enum 50204 "Trailer Doc Sync Run Status"
{
    Extensible = true;

    value(0; Running)
    {
        Caption = 'Running';
    }
    value(1; Succeeded)
    {
        Caption = 'Succeeded';
    }
    value(2; PartialFailure)
    {
        Caption = 'Partial Failure';
    }
    value(3; Failed)
    {
        Caption = 'Failed';
    }
}
