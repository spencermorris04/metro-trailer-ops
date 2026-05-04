page 50112 "Record360 Sync Error API"
{
    PageType = API;
    Caption = 'Record360 Sync Error API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'record360';
    APIVersion = 'v1.0';
    EntityName = 'record360SyncError';
    EntitySetName = 'record360SyncErrors';
    SourceTable = "Record360 Sync Error";
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
                field(record360InspectionId; Rec."Record360 Inspection ID")
                {
                    Caption = 'Record360 Inspection ID';
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
