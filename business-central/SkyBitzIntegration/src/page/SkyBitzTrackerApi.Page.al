page 50170 "SkyBitz Tracker API"
{
    PageType = API;
    Caption = 'SkyBitz Tracker API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'skybitz';
    APIVersion = 'v1.0';
    EntityName = 'skybitzTracker';
    EntitySetName = 'skybitzTrackers';
    SourceTable = "SkyBitz Tracker";
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
                field(mtsn; Rec."MTSN")
                {
                    Caption = 'MTSN';
                }
                field(skybitzAssetId; Rec."SkyBitz Asset ID")
                {
                    Caption = 'SkyBitz Asset ID';
                }
                field(fixedAssetNo; Rec."Fixed Asset No.")
                {
                    Caption = 'Fixed Asset No.';
                }
                field(fixedAssetSystemId; Rec."Fixed Asset SystemId")
                {
                    Caption = 'Fixed Asset SystemId';
                }
                field(assetType; Rec."Asset Type")
                {
                    Caption = 'Asset Type';
                }
                field(owner; Rec.Owner)
                {
                    Caption = 'Owner';
                }
                field(groups; Rec.Groups)
                {
                    Caption = 'Groups';
                }
                field(messageType; Rec."Message Type")
                {
                    Caption = 'Message Type';
                }
                field(latitude; Rec.Latitude)
                {
                    Caption = 'Latitude';
                }
                field(longitude; Rec.Longitude)
                {
                    Caption = 'Longitude';
                }
                field(speed; Rec.Speed)
                {
                    Caption = 'Speed';
                }
                field(heading; Rec.Heading)
                {
                    Caption = 'Heading';
                }
                field(headingDegrees; Rec."Heading Degrees")
                {
                    Caption = 'Heading Degrees';
                }
                field(battery; Rec.Battery)
                {
                    Caption = 'Battery';
                }
                field(externalPower; Rec."External Power")
                {
                    Caption = 'External Power';
                }
                field(observationDateTime; Rec."Observation Date Time")
                {
                    Caption = 'Observation Date Time';
                }
                field(quality; Rec.Quality)
                {
                    Caption = 'Quality';
                }
                field(landmarkName; Rec."Landmark Name")
                {
                    Caption = 'Landmark Name';
                }
                field(landmarkState; Rec."Landmark State")
                {
                    Caption = 'Landmark State';
                }
                field(landmarkCountry; Rec."Landmark Country")
                {
                    Caption = 'Landmark Country';
                }
                field(landmarkDistance; Rec."Landmark Distance")
                {
                    Caption = 'Landmark Distance';
                }
                field(landmarkDirection; Rec."Landmark Direction")
                {
                    Caption = 'Landmark Direction';
                }
                field(geofenceStatus; Rec."Geofence Status")
                {
                    Caption = 'Geofence Status';
                }
                field(departureGeofence; Rec."Departure Geofence")
                {
                    Caption = 'Departure Geofence';
                }
                field(serialSensorsJson; Rec."Serial Sensors JSON")
                {
                    Caption = 'Serial Sensors JSON';
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
