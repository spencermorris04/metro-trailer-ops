permissionset 50131 "R360 VIEW"
{
    Assignable = true;
    Caption = 'Record360 View';

    Permissions =
        tabledata "Record360 Inspection" = R,
        table "Record360 Inspection" = X,
        page "Record360 Inspection List" = X,
        page "Record360 Inspection Card" = X,
        page "Record360 Summary FactBox" = X,
        page "Record360 Recent FactBox" = X,
        page "R360 Unmatched Inspections" = X,
        codeunit "Record360 Sync Request" = X;
}
