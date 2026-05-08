page 50264 "Telematics Tracker List"
{
    PageType = List;
    SourceTable = "Telematics Tracker";
    SourceTableView = sorting("Fixed Asset No.", "Observation Date Time") order(descending);
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Telematics Trackers';
    Editable = false;
    CardPageId = "Telematics Tracker Card";

    layout
    {
        area(Content)
        {
            repeater(Trackers)
            {
                field(Provider; Rec.Provider)
                {
                    ApplicationArea = All;
                }
                field("Observation Date Time"; Rec."Observation Date Time")
                {
                    ApplicationArea = All;
                }
                field("Provider Asset ID"; Rec."Provider Asset ID")
                {
                    ApplicationArea = All;
                }
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
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
                field("Battery Voltage"; Rec."Battery Voltage")
                {
                    ApplicationArea = All;
                }
                field(Address; Rec.Address)
                {
                    ApplicationArea = All;
                }
                field("Nearest Geofence"; Rec."Nearest Geofence")
                {
                    ApplicationArea = All;
                }
                field("Geofence Status"; Rec."Geofence Status")
                {
                    ApplicationArea = All;
                }
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                }
                field("Sync Status"; Rec."Sync Status")
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
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    OpenMapForCurrentRecord();
                end;
            }
        }
    }

    local procedure OpenMapForCurrentRecord()
    begin
        if (Rec.Latitude = 0) and (Rec.Longitude = 0) then
            Error('No coordinates are available for this telematics tracker.');

        Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Rec.Latitude), Format(Rec.Longitude)));
    end;
}
