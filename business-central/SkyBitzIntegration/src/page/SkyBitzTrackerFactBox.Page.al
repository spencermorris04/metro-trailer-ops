page 50175 "SkyBitz Tracker FactBox"
{
    PageType = CardPart;
    SourceTable = "SkyBitz Tracker";
    SourceTableView = sorting("Fixed Asset No.", "Observation Date Time") order(descending);
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

                field("Observation Date Time"; Rec."Observation Date Time")
                {
                    ApplicationArea = All;
                    Caption = 'Observed';
                }
                field(Latitude; Rec.Latitude)
                {
                    ApplicationArea = All;
                }
                field(Longitude; Rec.Longitude)
                {
                    ApplicationArea = All;
                }
                field(Battery; Rec.Battery)
                {
                    ApplicationArea = All;
                }
                field("Landmark Name"; Rec."Landmark Name")
                {
                    ApplicationArea = All;
                }
                field("Landmark State"; Rec."Landmark State")
                {
                    ApplicationArea = All;
                }
                field("Landmark Direction"; Rec."Landmark Direction")
                {
                    ApplicationArea = All;
                }
                field("Geofence Status"; Rec."Geofence Status")
                {
                    ApplicationArea = All;
                }
                field(Groups; Rec.Groups)
                {
                    ApplicationArea = All;
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
                begin
                    Page.Run(Page::"SkyBitz Tracker Card", Rec);
                end;
            }
            action(RequestSync)
            {
                Caption = 'Request Sync';
                ApplicationArea = All;
                Image = Refresh;

                trigger OnAction()
                var
                    SyncRequest: Codeunit "SkyBitz Sync Request";
                    FixedAssetNo: Code[20];
                begin
                    FixedAssetNo := GetCurrentFixedAssetNo();
                    SyncRequest.RequestOnDemandSync(FixedAssetNo);
                    Message('SkyBitz sync request queued for fixed asset %1.', FixedAssetNo);
                end;
            }
        }
    }

    trigger OnOpenPage()
    begin
        Rec.SetCurrentKey("Fixed Asset No.", "Observation Date Time");
        Rec.Ascending(false);
    end;

    local procedure OpenMapForCurrentRecord()
    begin
        if (Rec.Latitude = 0) and (Rec.Longitude = 0) then
            Error('No coordinates are available for this SkyBitz tracker.');

        Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Rec.Latitude), Format(Rec.Longitude)));
    end;

    local procedure GetCurrentFixedAssetNo(): Code[20]
    var
        FixedAssetFilter: Text;
    begin
        if Rec."Fixed Asset No." <> '' then
            exit(CopyStr(Rec."Fixed Asset No.", 1, 20));

        FixedAssetFilter := Rec.GetFilter("Fixed Asset No.");
        FixedAssetFilter := DelChr(FixedAssetFilter, '=', '''');
        if FixedAssetFilter <> '' then
            exit(CopyStr(FixedAssetFilter, 1, 20));

        Error('No fixed asset number is available for this SkyBitz FactBox.');
    end;
}
