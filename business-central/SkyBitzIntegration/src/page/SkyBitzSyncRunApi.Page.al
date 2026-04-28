page 50171 "SkyBitz Sync Run API"
{
    PageType = API;
    Caption = 'SkyBitz Sync Run API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'skybitz';
    APIVersion = 'v1.0';
    EntityName = 'skybitzSyncRun';
    EntitySetName = 'skybitzSyncRuns';
    SourceTable = "SkyBitz Sync Run";
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
                field(runId; Rec."Run ID")
                {
                    Caption = 'Run ID';
                }
                field(startedAt; Rec."Started At")
                {
                    Caption = 'Started At';
                }
                field(finishedAt; Rec."Finished At")
                {
                    Caption = 'Finished At';
                }
                field(status; Rec.Status)
                {
                    Caption = 'Status';
                }
                field(recordsSeen; Rec."Records Seen")
                {
                    Caption = 'Records Seen';
                }
                field(recordsInserted; Rec."Records Inserted")
                {
                    Caption = 'Records Inserted';
                }
                field(recordsUpdated; Rec."Records Updated")
                {
                    Caption = 'Records Updated';
                }
                field(recordsSkipped; Rec."Records Skipped")
                {
                    Caption = 'Records Skipped';
                }
                field(recordsFailed; Rec."Records Failed")
                {
                    Caption = 'Records Failed';
                }
                field(matchedCount; Rec."Matched Count")
                {
                    Caption = 'Matched Count';
                }
                field(unmatchedCount; Rec."Unmatched Count")
                {
                    Caption = 'Unmatched Count';
                }
                field(errorSummary; Rec."Error Summary")
                {
                    Caption = 'Error Summary';
                }
                field(jobVersion; Rec."Job Version")
                {
                    Caption = 'Job Version';
                }
            }
        }
    }
}
