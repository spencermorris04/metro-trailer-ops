permissionset 50291 "TELEMATICS VIEW"
{
    Assignable = true;
    Caption = 'Telematics View';

    Permissions =
        tabledata "Telematics Tracker" = R,
        table "Telematics Tracker" = X,
        codeunit "Telematics Sync Request" = X,
        page "Telematics Tracker List" = X,
        page "Telematics Tracker Card" = X,
        page "Telematics FactBox" = X;
}
