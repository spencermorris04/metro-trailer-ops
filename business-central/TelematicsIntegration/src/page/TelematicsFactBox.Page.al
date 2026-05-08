page 50266 "Telematics FactBox"
{
    PageType = CardPart;
    SourceTable = "Fixed Asset";
    ApplicationArea = All;
    Caption = 'Telematics';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(Summary)
            {
                ShowCaption = false;

                field(ProviderTxt; ProviderTxt)
                {
                    ApplicationArea = All;
                    Caption = 'Provider';
                    ToolTip = 'Shows the preferred telematics provider. Drill down to see all trackers for this fixed asset.';

                    trigger OnDrillDown()
                    begin
                        ViewAllTrackersForCurrentAsset();
                    end;
                }
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
                field(BatteryTxt; BatteryTxt)
                {
                    ApplicationArea = All;
                    Caption = 'Battery';
                }
                field(AddressTxt; AddressTxt)
                {
                    ApplicationArea = All;
                    Caption = 'Address';
                }
                field(GeofenceTxt; GeofenceTxt)
                {
                    ApplicationArea = All;
                    Caption = 'Geofence';
                }
                field(OpenMapText; OpenMapText)
                {
                    ApplicationArea = All;
                    Caption = 'Map';
                    ToolTip = 'Open the latest telematics location in Google Maps.';

                    trigger OnDrillDown()
                    begin
                        OpenMapForCurrentAsset();
                    end;
                }
                field(RequestSyncText; RequestSyncText)
                {
                    ApplicationArea = All;
                    Caption = 'Sync';
                    ToolTip = 'Queue SkyBitz and ORBCOMM refreshes for this fixed asset.';

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
                    OpenMapForCurrentAsset();
                end;
            }
            action(ViewTracker)
            {
                Caption = 'View Tracker';
                ApplicationArea = All;
                Image = ViewDetails;

                trigger OnAction()
                var
                    Tracker: Record "Telematics Tracker";
                begin
                    if not FindLatestTracker(Tracker) then
                        Error('No telematics tracker data was found for fixed asset %1.', Rec."No.");

                    Page.Run(Page::"Telematics Tracker Card", Tracker);
                end;
            }
            action(ViewAll)
            {
                Caption = 'View All';
                ApplicationArea = All;
                Image = List;

                trigger OnAction()
                begin
                    ViewAllTrackersForCurrentAsset();
                end;
            }
            action(RequestSync)
            {
                Caption = 'Request Sync';
                ApplicationArea = All;
                Image = Refresh;

                trigger OnAction()
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

    local procedure RefreshSummary()
    var
        Tracker: Record "Telematics Tracker";
    begin
        Clear(ProviderTxt);
        Clear(ObservationDateTime);
        Clear(Latitude);
        Clear(Longitude);
        Clear(BatteryTxt);
        Clear(AddressTxt);
        Clear(GeofenceTxt);
        OpenMapText := '';
        RequestSyncText := 'Request Sync';

        if not FindLatestTracker(Tracker) then
            exit;

        ProviderTxt := BuildProviderText(Tracker);
        ObservationDateTime := Tracker."Observation Date Time";
        Latitude := Tracker.Latitude;
        Longitude := Tracker.Longitude;
        BatteryTxt := BuildBatteryText(Tracker);
        AddressTxt := Tracker.Address;
        GeofenceTxt := BuildGeofenceText(Tracker);

        if (Tracker.Latitude <> 0) or (Tracker.Longitude <> 0) then
            OpenMapText := 'Open';
    end;

    local procedure FindLatestTracker(var Tracker: Record "Telematics Tracker"): Boolean
    begin
        exit(FindPreferredTracker(Tracker));
    end;

    local procedure FindPreferredTracker(var Tracker: Record "Telematics Tracker"): Boolean
    begin
        Tracker.Reset();
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        Tracker.SetRange(Provider, Tracker.Provider::ORBCOMM);
        Tracker.SetCurrentKey("Fixed Asset No.", "Observation Date Time");
        Tracker.Ascending(false);

        if Tracker.FindFirst() then
            exit(true);

        Tracker.Reset();
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        Tracker.SetCurrentKey("Fixed Asset No.", "Observation Date Time");
        Tracker.Ascending(false);

        exit(Tracker.FindFirst());
    end;

    local procedure OpenMapForCurrentAsset()
    var
        Tracker: Record "Telematics Tracker";
    begin
        if not FindLatestTracker(Tracker) then
            Error('No telematics tracker data was found for fixed asset %1.', Rec."No.");

        if (Tracker.Latitude = 0) and (Tracker.Longitude = 0) then
            Error('The latest telematics record for fixed asset %1 does not have coordinates.', Rec."No.");

        Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Tracker.Latitude), Format(Tracker.Longitude)));
    end;

    local procedure ViewAllTrackersForCurrentAsset()
    var
        Tracker: Record "Telematics Tracker";
    begin
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        if Tracker.IsEmpty() then
            Error('No telematics tracker data was found for fixed asset %1.', Rec."No.");

        Page.Run(Page::"Telematics Tracker List", Tracker);
    end;

    local procedure RequestSyncForCurrentAsset()
    var
        SyncRequest: Codeunit "Telematics Sync Request";
    begin
        if Rec."No." = '' then
            Error('No fixed asset number is available for this Telematics FactBox.');

        SyncRequest.RequestOnDemandSync(Rec."No.");
        Message('Telematics sync request queued for fixed asset %1.', Rec."No.");
    end;

    local procedure BuildBatteryText(Tracker: Record "Telematics Tracker"): Text[80]
    begin
        if Tracker.Battery <> '' then
            exit(CopyStr(Tracker.Battery, 1, 80));

        if Tracker."Battery Voltage" <> 0 then
            exit(CopyStr(StrSubstNo('%1 V', Tracker."Battery Voltage"), 1, 80));

        exit('');
    end;

    local procedure BuildGeofenceText(Tracker: Record "Telematics Tracker"): Text[160]
    var
        Value: Text;
    begin
        Value := Tracker."Geofence Status";
        if Tracker."Nearest Geofence" <> '' then begin
            if Value <> '' then
                Value := Value + ' - ';
            Value := Value + Tracker."Nearest Geofence";
        end;

        exit(CopyStr(Value, 1, 160));
    end;

    local procedure BuildProviderText(SelectedTracker: Record "Telematics Tracker"): Text[80]
    var
        TotalTrackers: Integer;
        HasSkyBitz: Boolean;
        HasORBCOMM: Boolean;
    begin
        TotalTrackers := CountTrackersForCurrentAsset();
        HasSkyBitz := HasProvider(SelectedTracker.Provider::SkyBitz);
        HasORBCOMM := HasProvider(SelectedTracker.Provider::ORBCOMM);

        if HasORBCOMM and HasSkyBitz then
            exit('ORBCOMM + SkyBitz');

        if TotalTrackers > 1 then
            exit(CopyStr(StrSubstNo('%1 (%2 trackers)', Format(SelectedTracker.Provider), TotalTrackers), 1, 80));

        exit(CopyStr(Format(SelectedTracker.Provider), 1, 80));
    end;

    local procedure CountTrackersForCurrentAsset(): Integer
    var
        Tracker: Record "Telematics Tracker";
    begin
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        exit(Tracker.Count());
    end;

    local procedure HasProvider(ProviderFilter: Enum "Telematics Provider"): Boolean
    var
        Tracker: Record "Telematics Tracker";
    begin
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        Tracker.SetRange(Provider, ProviderFilter);
        exit(not Tracker.IsEmpty());
    end;

    var
        ProviderTxt: Text[80];
        ObservationDateTime: DateTime;
        Latitude: Decimal;
        Longitude: Decimal;
        BatteryTxt: Text[80];
        AddressTxt: Text[250];
        GeofenceTxt: Text[160];
        OpenMapText: Text[30];
        RequestSyncText: Text[30];
}
