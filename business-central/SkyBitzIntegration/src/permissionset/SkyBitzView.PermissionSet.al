permissionset 50191 "SKYBITZ VIEW"
{
    Assignable = true;
    Caption = 'SkyBitz View';

    Permissions =
        tabledata "SkyBitz Tracker" = R,
        table "SkyBitz Tracker" = X,
        page "SkyBitz Tracker List" = X,
        page "SkyBitz Tracker Card" = X,
        page "SkyBitz Tracker FactBox" = X,
        codeunit "SkyBitz Sync Request" = X;
}
