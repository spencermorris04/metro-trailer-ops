page 50262 "Telematics Sync Error API"
{
    PageType = API;
    Caption = 'Telematics Sync Error API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'telematics';
    APIVersion = 'v1.0';
    EntityName = 'telematicsSyncError';
    EntitySetName = 'telematicsSyncErrors';
    SourceTable = "Telematics Sync Error";
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
                field(provider; Rec.Provider)
                {
                    Caption = 'Provider';
                }
                field(providerTrackerId; Rec."Provider Tracker ID")
                {
                    Caption = 'Provider Tracker ID';
                }
                field(providerAssetId; Rec."Provider Asset ID")
                {
                    Caption = 'Provider Asset ID';
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
