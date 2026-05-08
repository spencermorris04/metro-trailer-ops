page 50175 "SkyBitz Tracker FactBox"
{
    PageType = CardPart;
    SourceTable = "Fixed Asset";
    ApplicationArea = All;
    Caption = 'Latest SkyBitz';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(Summary)
            {
                ShowCaption = false;

                field(ObservationDateTime; ObservationDateTime)
                {
                    ApplicationArea = All;
                    Caption = 'Observed';
                }
                field(Latitude; Latitude)
                {
                    ApplicationArea = All;
                }
                field(Longitude; Longitude)
                {
                    ApplicationArea = All;
                }
                field(Battery; Battery)
                {
                    ApplicationArea = All;
                }
                field(LandmarkName; LandmarkName)
                {
                    ApplicationArea = All;
                    Caption = 'Landmark Name';
                }
                field(LandmarkState; LandmarkState)
                {
                    ApplicationArea = All;
                    Caption = 'Landmark State';
                }
                field(LandmarkDirection; LandmarkDirection)
                {
                    ApplicationArea = All;
                    Caption = 'Landmark Direction';
                }
                field(GeofenceStatus; GeofenceStatus)
                {
                    ApplicationArea = All;
                    Caption = 'Geofence Status';
                }
                field(Groups; Groups)
                {
                    ApplicationArea = All;
                }
                field(RequestSyncText; RequestSyncText)
                {
                    ApplicationArea = All;
                    Caption = 'Sync';
                    ToolTip = 'Queue a SkyBitz refresh for this fixed asset.';

                    trigger OnDrillDown()
                    begin
                        RequestSyncForCurrentAsset();
                    end;
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(OpenMap)
            {
                Caption = 'Open Map';
                ApplicationArea = All;
                Image = Map;

                trigger OnAction()
                begin
                    OpenMapForCurrentRecord();
                end;
            }
            action(ViewTracker)
            {
                Caption = 'View Tracker';
                ApplicationArea = All;
                Image = ViewDetails;

                trigger OnAction()
                var
                    Tracker: Record "SkyBitz Tracker";
                begin
                    if not FindLatestTracker(Tracker) then
                        Error('No SkyBitz tracker was found for fixed asset %1.', Rec."No.");

                    Page.Run(Page::"SkyBitz Tracker Card", Tracker);
                end;
            }
            action(RequestSync)
            {
                Caption = 'Request Sync';
                ApplicationArea = All;
                Image = Refresh;

                trigger OnAction()
                var
                begin
                    RequestSyncForCurrentAsset();
                end;
            }
        }
    }

    trigger OnAfterGetCurrRecord()
    begin
        RefreshSummary();
    end;

    local procedure OpenMapForCurrentRecord()
    var
        Tracker: Record "SkyBitz Tracker";
    begin
        if not FindLatestTracker(Tracker) then
            Error('No SkyBitz tracker was found for fixed asset %1.', Rec."No.");

        if (Tracker.Latitude = 0) and (Tracker.Longitude = 0) then
            Error('No coordinates are available for this SkyBitz tracker.');

        Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Tracker.Latitude), Format(Tracker.Longitude)));
    end;

    local procedure RequestSyncForCurrentAsset()
    var
        SyncRequest: Codeunit "SkyBitz Sync Request";
    begin
        if Rec."No." = '' then
            Error('No fixed asset number is available for this SkyBitz FactBox.');

        SyncRequest.RequestOnDemandSync(Rec."No.");
        Message('SkyBitz sync request queued for fixed asset %1.', Rec."No.");
    end;

    local procedure RefreshSummary()
    var
        Tracker: Record "SkyBitz Tracker";
    begin
        Clear(ObservationDateTime);
        Clear(Latitude);
        Clear(Longitude);
        Clear(Battery);
        Clear(LandmarkName);
        Clear(LandmarkState);
        Clear(LandmarkDirection);
        Clear(GeofenceStatus);
        Clear(Groups);
        RequestSyncText := 'Request Sync';

        if not FindLatestTracker(Tracker) then
            exit;

        ObservationDateTime := Tracker."Observation Date Time";
        Latitude := Tracker.Latitude;
        Longitude := Tracker.Longitude;
        Battery := Tracker.Battery;
        LandmarkName := Tracker."Landmark Name";
        LandmarkState := Tracker."Landmark State";
        LandmarkDirection := Tracker."Landmark Direction";
        GeofenceStatus := Tracker."Geofence Status";
        Groups := Tracker.Groups;
    end;

    local procedure FindLatestTracker(var Tracker: Record "SkyBitz Tracker"): Boolean
    begin
        Tracker.Reset();
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        Tracker.SetCurrentKey("Fixed Asset No.", "Observation Date Time");
        Tracker.Ascending(false);

        exit(Tracker.FindFirst());
    end;

    var
        ObservationDateTime: DateTime;
        Latitude: Decimal;
        Longitude: Decimal;
        Battery: Text[50];
        LandmarkName: Text[100];
        LandmarkState: Text[50];
        LandmarkDirection: Text[50];
        GeofenceStatus: Text[100];
        Groups: Text[250];
        RequestSyncText: Text[30];
}
