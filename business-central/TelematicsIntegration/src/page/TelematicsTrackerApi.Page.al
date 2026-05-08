page 50260 "Telematics Tracker API"
{
    PageType = API;
    Caption = 'Telematics Tracker API';
    APIPublisher = 'metroTrailer';
    APIGroup = 'telematics';
    APIVersion = 'v1.0';
    EntityName = 'telematicsTracker';
    EntitySetName = 'telematicsTrackers';
    SourceTable = "Telematics Tracker";
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
                field(productType; Rec."Product Type")
                {
                    Caption = 'Product Type';
                }
                field(groups; Rec.Groups)
                {
                    Caption = 'Groups';
                }
                field(messageId; Rec."Message ID")
                {
                    Caption = 'Message ID';
                }
                field(observationDateTime; Rec."Observation Date Time")
                {
                    Caption = 'Observation Date Time';
                }
                field(receivedDateTime; Rec."Received Date Time")
                {
                    Caption = 'Received Date Time';
                }
                field(latitude; Rec.Latitude)
                {
                    Caption = 'Latitude';
                }
                field(longitude; Rec.Longitude)
                {
                    Caption = 'Longitude';
                }
                field(battery; Rec.Battery)
                {
                    Caption = 'Battery';
                }
                field(batteryVoltage; Rec."Battery Voltage")
                {
                    Caption = 'Battery Voltage';
                }
                field(powerSource; Rec."Power Source")
                {
                    Caption = 'Power Source';
                }
                field(speed; Rec.Speed)
                {
                    Caption = 'Speed';
                }
                field(heading; Rec.Heading)
                {
                    Caption = 'Heading';
                }
                field(address; Rec.Address)
                {
                    Caption = 'Address';
                }
                field(city; Rec.City)
                {
                    Caption = 'City';
                }
                field(state; Rec.State)
                {
                    Caption = 'State';
                }
                field(country; Rec.Country)
                {
                    Caption = 'Country';
                }
                field(nearestGeofence; Rec."Nearest Geofence")
                {
                    Caption = 'Nearest Geofence';
                }
                field(geofenceStatus; Rec."Geofence Status")
                {
                    Caption = 'Geofence Status';
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
