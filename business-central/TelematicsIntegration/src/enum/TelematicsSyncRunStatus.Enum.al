enum 50284 "Telematics Sync Run Status"
{
    Extensible = false;

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
        Caption = 'PartialFailure';
    }
    value(3; Failed)
    {
        Caption = 'Failed';
    }
}
