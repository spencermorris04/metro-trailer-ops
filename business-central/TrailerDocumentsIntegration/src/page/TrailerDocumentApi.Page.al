page 50220 "Trailer Document API"
{
    PageType = API;
    Caption = 'Trailer Document API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'trailerDocuments';
    APIVersion = 'v1.0';
    EntityName = 'trailerDocument';
    EntitySetName = 'trailerDocuments';
    SourceTable = "Trailer Document";
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
                field(sharePointItemId; Rec."SharePoint Item ID")
                {
                    Caption = 'SharePoint Item ID';
                }
                field(driveId; Rec."Drive ID")
                {
                    Caption = 'Drive ID';
                }
                field(siteId; Rec."Site ID")
                {
                    Caption = 'Site ID';
                }
                field(folderId; Rec."Folder ID")
                {
                    Caption = 'Folder ID';
                }
                field(folderName; Rec."Folder Name")
                {
                    Caption = 'Folder Name';
                }
                field(folderUrl; Rec."Folder URL")
                {
                    Caption = 'Folder URL';
                }
                field(fixedAssetNo; Rec."Fixed Asset No.")
                {
                    Caption = 'Fixed Asset No.';
                }
                field(fixedAssetSystemId; Rec."Fixed Asset SystemId")
                {
                    Caption = 'Fixed Asset SystemId';
                }
                field(documentType; Rec."Document Type")
                {
                    Caption = 'Document Type';
                }
                field(fileName; Rec."File Name")
                {
                    Caption = 'File Name';
                }
                field(fileExtension; Rec."File Extension")
                {
                    Caption = 'File Extension';
                }
                field(webUrl; Rec."Web URL")
                {
                    Caption = 'Web URL';
                }
                field(lastModifiedAt; Rec."Last Modified At")
                {
                    Caption = 'Last Modified At';
                }
                field(createdAt; Rec."Created At")
                {
                    Caption = 'Created At';
                }
                field(fileSize; Rec."File Size")
                {
                    Caption = 'File Size';
                }
                field(matchStatus; Rec."Match Status")
                {
                    Caption = 'Match Status';
                }
                field(matchedBy; Rec."Matched By")
                {
                    Caption = 'Matched By';
                }
                field(syncStatus; Rec."Sync Status")
                {
                    Caption = 'Sync Status';
                }
                field(lastSyncedAt; Rec."Last Synced At")
                {
                    Caption = 'Last Synced At';
                }
                field(sourceHash; Rec."Source Hash")
                {
                    Caption = 'Source Hash';
                }
                field(lastError; Rec."Last Error")
                {
                    Caption = 'Last Error';
                }
                field(active; Rec.Active)
                {
                    Caption = 'Active';
                }
                field(removedAt; Rec."Removed At")
                {
                    Caption = 'Removed At';
                }
            }
        }
    }
}
