permissionset 50290 "TELEMATICS INTEG"
{
    Assignable = true;
    Caption = 'Telematics Integration';

    Permissions =
        tabledata "Telematics Tracker" = RIMD,
        tabledata "Telematics Sync Run" = RIMD,
        tabledata "Telematics Sync Error" = RIMD,
        tabledata "Telematics Sync API Setup" = RIMD,
        table "Telematics Tracker" = X,
        table "Telematics Sync Run" = X,
        table "Telematics Sync Error" = X,
        table "Telematics Sync API Setup" = X,
        codeunit "Telematics Sync Request" = X,
        page "Telematics Tracker API" = X,
        page "Telematics Sync Run API" = X,
        page "Telematics Sync Error API" = X,
        page "Telematics Sync API Setup" = X,
        page "Telematics Tracker List" = X,
        page "Telematics Tracker Card" = X,
        page "Telematics FactBox" = X;
}
