page 50111 "Record360 Sync Run API"
{
    PageType = API;
    Caption = 'Record360 Sync Run API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'record360';
    APIVersion = 'v1.0';
    EntityName = 'record360SyncRun';
    EntitySetName = 'record360SyncRuns';
    SourceTable = "Record360 Sync Run";
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
                field(sourceWindowStart; Rec."Source Window Start")
                {
                    Caption = 'Source Window Start';
                }
                field(sourceWindowEnd; Rec."Source Window End")
                {
                    Caption = 'Source Window End';
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
