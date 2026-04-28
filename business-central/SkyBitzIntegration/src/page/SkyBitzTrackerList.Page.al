page 50173 "SkyBitz Tracker List"
{
    PageType = List;
    SourceTable = "SkyBitz Tracker";
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'SkyBitz Trackers';
    Editable = false;
    CardPageId = "SkyBitz Tracker Card";

    layout
    {
        area(Content)
        {
            repeater(Trackers)
            {
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                }
                field("SkyBitz Asset ID"; Rec."SkyBitz Asset ID")
                {
                    ApplicationArea = All;
                }
                field("MTSN"; Rec."MTSN")
                {
                    ApplicationArea = All;
                }
                field("Observation Date Time"; Rec."Observation Date Time")
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
            Error('No coordinates are available for this SkyBitz tracker.');

        Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Rec.Latitude), Format(Rec.Longitude)));
    end;
}
