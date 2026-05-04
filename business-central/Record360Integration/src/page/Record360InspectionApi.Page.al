page 50110 "Record360 Inspection API"
{
    PageType = API;
    Caption = 'Record360 Inspection API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'record360';
    APIVersion = 'v1.0';
    EntityName = 'record360Inspection';
    EntitySetName = 'record360Inspections';
    SourceTable = "Record360 Inspection";
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
                field(record360InspectionId; Rec."Record360 Inspection ID")
                {
                    Caption = 'Record360 Inspection ID';
                }
                field(trailerVin; Rec."Trailer VIN")
                {
                    Caption = 'Trailer VIN';
                }
                field(normalizedTrailerVin; Rec."Normalized Trailer VIN")
                {
                    Caption = 'Normalized Trailer VIN';
                }
                field(trailerNo; Rec."Trailer No.")
                {
                    Caption = 'Trailer No.';
                }
                field(trailerSystemId; Rec."Trailer SystemId")
                {
                    Caption = 'Trailer SystemId';
                }
                field(inspectionDateTime; Rec."Inspection DateTime")
                {
                    Caption = 'Inspection DateTime';
                }
                field(inspectionDirection; Rec."Inspection Direction")
                {
                    Caption = 'Inspection Direction';
                }
                field(newUsedStatus; Rec."New/Used Status")
                {
                    Caption = 'New/Used Status';
                }
                field(employeeName; Rec."Employee Name")
                {
                    Caption = 'Employee Name';
                }
                field(carrier; Rec.Carrier)
                {
                    Caption = 'Carrier';
                }
                field(driver; Rec.Driver)
                {
                    Caption = 'Driver';
                }
                field(truckNo; Rec."Truck No.")
                {
                    Caption = 'Truck No.';
                }
                field(contractNo; Rec."Contract No.")
                {
                    Caption = 'Contract No.';
                }
                field(origin; Rec.Origin)
                {
                    Caption = 'Origin';
                }
                field(destination; Rec.Destination)
                {
                    Caption = 'Destination';
                }
                field(customerUnitNo; Rec."Customer Unit No.")
                {
                    Caption = 'Customer Unit No.';
                }
                field(unitCondition; Rec."Unit Condition")
                {
                    Caption = 'Unit Condition';
                }
                field(comments; Rec.Comments)
                {
                    Caption = 'Comments';
                }
                field(dashboardUrl; Rec."Dashboard URL")
                {
                    Caption = 'Dashboard URL';
                }
                field(pdfShareUrl; Rec."PDF Share URL")
                {
                    Caption = 'PDF Share URL';
                }
                field(photoCount; Rec."Photo Count")
                {
                    Caption = 'Photo Count';
                }
                field(videoCount; Rec."Video Count")
                {
                    Caption = 'Video Count';
                }
                field(mediaCount; Rec."Media Count")
                {
                    Caption = 'Media Count';
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
            }
        }
    }
}
