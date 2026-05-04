page 50222 "Trailer Doc Sync Error API"
{
    PageType = API;
    Caption = 'Trailer Document Sync Error API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'trailerDocuments';
    APIVersion = 'v1.0';
    EntityName = 'trailerDocumentSyncError';
    EntitySetName = 'trailerDocumentSyncErrors';
    SourceTable = "Trailer Document Sync Error";
    DelayedInsert = true;
    ODataKeyFields = SystemId;
    Extensible = false;
    InsertAllowed = true;
    ModifyAllowed = true;
    DeleteAllowed = false;

    layout
    {
        area(Content)
        {
            repeater(General)
            {
                field(id; Rec.SystemId)
                {
                    Caption = 'Id';
                    Editable = false;
                }
                field(entryNo; Rec."Entry No.")
                {
                    Caption = 'Entry No.';
                    Editable = false;
                }
                field(runId; Rec."Run ID")
                {
                    Caption = 'Run ID';
                }
                field(sharePointItemId; Rec."SharePoint Item ID")
                {
                    Caption = 'SharePoint Item ID';
                }
                field(folderId; Rec."Folder ID")
                {
                    Caption = 'Folder ID';
                }
                field(folderName; Rec."Folder Name")
                {
                    Caption = 'Folder Name';
                }
                field(errorType; Rec."Error Type")
                {
                    Caption = 'Error Type';
                }
                field(errorMessage; Rec."Error Message")
                {
                    Caption = 'Error Message';
                }
                field(rawPayloadPointer; Rec."Raw Payload Pointer")
                {
                    Caption = 'Raw Payload Pointer';
                }
                field(createdAt; Rec."Created At")
                {
                    Caption = 'Created At';
                }
                field(resolved; Rec.Resolved)
                {
                    Caption = 'Resolved';
                }
                field(resolvedAt; Rec."Resolved At")
                {
                    Caption = 'Resolved At';
                }
            }
        }
    }
}
