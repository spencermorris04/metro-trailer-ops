permissionset 50190 "SKYBITZ INTEGRATION"
{
    Assignable = true;
    Caption = 'SkyBitz Integration';

    Permissions =
        tabledata "SkyBitz Tracker" = RIMD,
        tabledata "SkyBitz Sync Run" = RIMD,
        tabledata "SkyBitz Sync Error" = RIMD,
        table "SkyBitz Tracker" = X,
        table "SkyBitz Sync Run" = X,
        table "SkyBitz Sync Error" = X,
        page "SkyBitz Tracker API" = X,
        page "SkyBitz Sync Run API" = X,
        page "SkyBitz Sync Error API" = X,
        page "SkyBitz Tracker List" = X,
        page "SkyBitz Tracker Card" = X,
        page "SkyBitz Tracker FactBox" = X;
}
