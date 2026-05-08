pageextension 50270 "Fixed Asset Card Telematics" extends "Fixed Asset Card"
{
    layout
    {
        addlast(FactBoxes)
        {
            part(Telematics; "Telematics FactBox")
            {
                ApplicationArea = All;
                SubPageLink = "No." = field("No.");
            }
        }
    }

    actions
    {
        addlast(Processing)
        {
            action(ViewTelematicsTrackers)
            {
                Caption = 'Telematics Trackers';
                ApplicationArea = All;
                Image = List;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Tracker: Record "Telematics Tracker";
                begin
                    Tracker.SetRange("Fixed Asset No.", Rec."No.");
                    if Tracker.IsEmpty() then
                        Error('No telematics tracker data was found for fixed asset %1.', Rec."No.");

                    Page.Run(Page::"Telematics Tracker List", Tracker);
                end;
            }
            action(OpenLatestTelematicsMap)
            {
                Caption = 'Open Latest Telematics Map';
                ApplicationArea = All;
                Image = Map;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Tracker: Record "Telematics Tracker";
                begin
                    if not FindPreferredTracker(Tracker) then
                        Error('No telematics tracker data was found for fixed asset %1.', Rec."No.");

                    if (Tracker.Latitude = 0) and (Tracker.Longitude = 0) then
                        Error('The latest telematics record for fixed asset %1 does not have coordinates.', Rec."No.");

                    Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Tracker.Latitude), Format(Tracker.Longitude)));
                end;
            }
        }
    }

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
}
