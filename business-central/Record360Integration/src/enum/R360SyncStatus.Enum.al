enum 50124 "R360 Sync Status"
{
    Extensible = true;

    value(0; Pending)
    {
        Caption = 'Pending';
    }
    value(1; Synced)
    {
        Caption = 'Synced';
    }
    value(2; Failed)
    {
        Caption = 'Failed';
    }
    value(3; Skipped)
    {
        Caption = 'Skipped';
    }
}
