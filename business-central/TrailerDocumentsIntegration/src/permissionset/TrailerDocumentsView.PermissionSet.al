permissionset 50241 "TRAILER DOCS VIEW"
{
    Assignable = true;
    Caption = 'Trailer Documents View';

    Permissions =
        tabledata "Trailer Document" = R,
        tabledata "SP Trailer Folder State" = R,
        tabledata "Trailer Document Sync Run" = R,
        tabledata "Trailer Document Sync Error" = R,
        table "Trailer Document" = X,
        table "SP Trailer Folder State" = X,
        table "Trailer Document Sync Run" = X,
        table "Trailer Document Sync Error" = X,
        page "Trailer Document List" = X,
        page "Trailer Document Card" = X,
        page "Trailer Doc Summary FB" = X,
        page "Trailer Doc History FB" = X,
        page "Trailer Document Unmatched" = X,
        codeunit "Trailer Document Sync Request" = X;
}
