enum 50281 "Telematics Match Status"
{
    Extensible = false;

    value(0; Unknown)
    {
        Caption = 'Unknown';
    }
    value(1; Matched)
    {
        Caption = 'Matched';
    }
    value(2; Unmatched)
    {
        Caption = 'Unmatched';
    }
    value(3; Ambiguous)
    {
        Caption = 'Ambiguous';
    }
    value(4; Error)
    {
        Caption = 'Error';
    }
}
