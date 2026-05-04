permissionset 50130 "R360 INTEGRATION"
{
    Assignable = true;
    Caption = 'Record360 Integration';

    Permissions =
        tabledata "Record360 Inspection" = RIMD,
        tabledata "Record360 Sync Run" = RIMD,
        tabledata "Record360 Sync Error" = RIMD,
        tabledata "Record360 Sync API Setup" = RIMD,
        table "Record360 Inspection" = X,
        table "Record360 Sync Run" = X,
        table "Record360 Sync Error" = X,
        table "Record360 Sync API Setup" = X,
        codeunit "Record360 Sync Request" = X,
        page "Record360 Inspection API" = X,
        page "Record360 Sync Run API" = X,
        page "Record360 Sync Error API" = X,
        page "Record360 Inspection List" = X,
        page "Record360 Inspection Card" = X,
        page "Record360 Summary FactBox" = X,
        page "Record360 Recent FactBox" = X,
        page "R360 Unmatched Inspections" = X,
        page "Record360 Sync API Setup" = X;
}
