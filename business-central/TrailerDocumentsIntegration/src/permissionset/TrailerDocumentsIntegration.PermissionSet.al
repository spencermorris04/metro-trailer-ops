permissionset 50240 "TRAILER DOCS INT"
{
    Assignable = true;
    Caption = 'Trailer Documents Integration';

    Permissions =
        tabledata "Trailer Document" = RIMD,
        tabledata "SP Trailer Folder State" = RIMD,
        tabledata "Trailer Document Sync Run" = RIMD,
        tabledata "Trailer Document Sync Error" = RIMD,
        tabledata "Trailer Doc Sync API Setup" = RIMD,
        table "Trailer Document" = X,
        table "SP Trailer Folder State" = X,
        table "Trailer Document Sync Run" = X,
        table "Trailer Document Sync Error" = X,
        table "Trailer Doc Sync API Setup" = X,
        codeunit "Trailer Document Sync Request" = X,
        page "Trailer Document API" = X,
        page "SP Trailer Folder API" = X,
        page "Trailer Document Sync Run API" = X,
        page "Trailer Doc Sync Error API" = X,
        page "Trailer Document List" = X,
        page "Trailer Document Card" = X,
        page "Trailer Doc Summary FB" = X,
        page "Trailer Doc History FB" = X,
        page "Trailer Document Unmatched" = X,
        page "Trailer Doc Sync API Setup" = X;
}
