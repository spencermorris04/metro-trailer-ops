permissionset 50350 "BC EXPORT READ"
{
    Assignable = true;
    Caption = 'BC Export Read';

    Permissions =
        tabledata "G/L Account" = R,
        tabledata "G/L Entry" = R,
        tabledata Customer = R,
        tabledata "Cust. Ledger Entry" = R,
        tabledata "Sales Header" = R,
        tabledata "Sales Line" = R,
        tabledata "Dimension Set Entry" = R,
        page "Chart of Accounts" = X,
        page "General Ledger Entries" = X,
        page "Customer Card" = X,
        page "Customer List" = X,
        page "Customer Ledger Entries" = X,
        page "Sales Order" = X,
        page "Sales Order Subform" = X,
        page "Sales Document Entity" = X,
        page "Sales Document Line Entity" = X;
}
