page 50228 "SP Trailer Folder API"
{
    PageType = API;
    Caption = 'SharePoint Trailer Folder API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'trailerDocuments';
    APIVersion = 'v1.0';
    EntityName = 'trailerFolderState';
    EntitySetName = 'trailerFolderStates';
    SourceTable = "SP Trailer Folder State";
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
                field(folderName; Rec."Folder Name")
                {
                    Caption = 'Folder Name';
                }
                field(folderId; Rec."Folder ID")
                {
                    Caption = 'Folder ID';
                }
                field(driveId; Rec."Drive ID")
                {
                    Caption = 'Drive ID';
                }
                field(siteId; Rec."Site ID")
                {
                    Caption = 'Site ID';
                }
                field(folderUrl; Rec."Folder URL")
                {
                    Caption = 'Folder URL';
                }
                field(fixedAssetNo; Rec."Fixed Asset No.")
                {
                    Caption = 'Fixed Asset No.';
                }
                field(seenStatus; Rec."Seen Status")
                {
                    Caption = 'Seen Status';
                }
                field(lastFullTraversedAt; Rec."Last Full Traversed At")
                {
                    Caption = 'Last Full Traversed At';
                }
                field(lastDeltaRefreshedAt; Rec."Last Delta Refreshed At")
                {
                    Caption = 'Last Delta Refreshed At';
                }
                field(lastSuccessAt; Rec."Last Success At")
                {
                    Caption = 'Last Success At';
                }
                field(lastFailureAt; Rec."Last Failure At")
                {
                    Caption = 'Last Failure At';
                }
                field(lastError; Rec."Last Error")
                {
                    Caption = 'Last Error';
                }
                field(lastItemCount; Rec."Last Item Count")
                {
                    Caption = 'Last Item Count';
                }
                field(active; Rec.Active)
                {
                    Caption = 'Active';
                }
            }
        }
    }
}
