enum 50370 "MTE ESign Lease Status"
{
    Extensible = true;
    Caption = 'Metro E-Sign Document Status';

    value(0; Draft)
    {
        Caption = 'Draft';
    }
    value(1; Sent)
    {
        Caption = 'Sent';
    }
    value(2; Signed)
    {
        Caption = 'Signed';
    }
    value(3; Voided)
    {
        Caption = 'Voided';
    }
    value(4; Error)
    {
        Caption = 'Error';
    }
}
