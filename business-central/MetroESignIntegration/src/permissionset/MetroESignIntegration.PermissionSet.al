permissionset 50370 "MTE ESIGN"
{
    Assignable = true;
    Caption = 'Metro E-Sign Integration';

    Permissions =
        tabledata "MTE ESign Setup" = RIMD,
        tabledata "MTE ESign Template" = RIMD,
        tabledata "MTE ESign Template Field" = RIMD,
        tabledata "MTE ESign Lease" = RIMD,
        tabledata "MTE ESign Lease Field" = RIMD,
        table "MTE ESign Setup" = X,
        table "MTE ESign Template" = X,
        table "MTE ESign Template Field" = X,
        table "MTE ESign Lease" = X,
        table "MTE ESign Lease Field" = X,
        codeunit "MTE ESign API" = X,
        page "MTE ESign Setup" = X,
        page "MTE ESign Templates" = X,
        page "MTE ESign Field Part" = X,
        page "MTE ESign Leases" = X,
        page "MTE ESign Lease Card" = X,
        page "MTE ESign Preview Part" = X,
        page "MTE ESign Asset FB" = X,
        page "MTE ESign Customer FB" = X;
}
