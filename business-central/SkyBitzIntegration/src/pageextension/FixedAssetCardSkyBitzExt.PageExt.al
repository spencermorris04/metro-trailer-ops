pageextension 50180 "Fixed Asset Card SkyBitz Ext" extends "Fixed Asset Card"
{
    layout
    {
        addlast(FactBoxes)
        {
            part(SkyBitzLatest; "SkyBitz Tracker FactBox")
            {
                ApplicationArea = All;
                SubPageLink = "Fixed Asset No." = field("No.");
            }
        }
    }

    actions
    {
        addlast(Processing)
        {
            action(ViewSkyBitzTrackers)
            {
                Caption = 'SkyBitz Trackers';
                ApplicationArea = All;
                Image = List;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Tracker: Record "SkyBitz Tracker";
                begin
                    Tracker.SetRange("Fixed Asset No.", Rec."No.");
                    Page.Run(Page::"SkyBitz Tracker List", Tracker);
                end;
            }
            action(OpenLatestSkyBitzMap)
            {
                Caption = 'Open Latest SkyBitz Map';
                ApplicationArea = All;
                Image = Map;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Tracker: Record "SkyBitz Tracker";
                begin
                    if not FindLatestTracker(Tracker) then
                        Error('No SkyBitz tracker data was found for fixed asset %1.', Rec."No.");

                    if (Tracker.Latitude = 0) and (Tracker.Longitude = 0) then
                        Error('The latest SkyBitz record for fixed asset %1 does not have coordinates.', Rec."No.");

                    Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Tracker.Latitude), Format(Tracker.Longitude)));
                end;
            }
            action(RequestSkyBitzSync)
            {
                Caption = 'Request SkyBitz Sync';
                ApplicationArea = All;
                Image = Refresh;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    SyncRequest: Codeunit "SkyBitz Sync Request";
                begin
                    SyncRequest.RequestOnDemandSync(Rec."No.");
                    Message('SkyBitz sync request queued for fixed asset %1.', Rec."No.");
                end;
            }
        }
    }

    local procedure FindLatestTracker(var Tracker: Record "SkyBitz Tracker"): Boolean
    begin
        Tracker.Reset();
        Tracker.SetRange("Fixed Asset No.", Rec."No.");
        Tracker.SetCurrentKey("Fixed Asset No.", "Observation Date Time");
        Tracker.Ascending(false);

        exit(Tracker.FindFirst());
    end;
}
