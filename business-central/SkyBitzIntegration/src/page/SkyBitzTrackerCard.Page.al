page 50174 "SkyBitz Tracker Card"
{
    PageType = Card;
    SourceTable = "SkyBitz Tracker";
    ApplicationArea = All;
    Caption = 'SkyBitz Tracker';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("SkyBitz Asset ID"; Rec."SkyBitz Asset ID")
                {
                    ApplicationArea = All;
                }
                field("MTSN"; Rec."MTSN")
                {
                    ApplicationArea = All;
                }
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                }
                field("Asset Type"; Rec."Asset Type")
                {
                    ApplicationArea = All;
                }
                field(Owner; Rec.Owner)
                {
                    ApplicationArea = All;
                }
                field(Groups; Rec.Groups)
                {
                    ApplicationArea = All;
                }
                field("Message Type"; Rec."Message Type")
                {
                    ApplicationArea = All;
                }
            }
            group(Location)
            {
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
                field(Speed; Rec.Speed)
                {
                    ApplicationArea = All;
                }
                field(Heading; Rec.Heading)
                {
                    ApplicationArea = All;
                }
                field("Heading Degrees"; Rec."Heading Degrees")
                {
                    ApplicationArea = All;
                }
                field(Battery; Rec.Battery)
                {
                    ApplicationArea = All;
                }
                field("External Power"; Rec."External Power")
                {
                    ApplicationArea = All;
                }
                field(Quality; Rec.Quality)
                {
                    ApplicationArea = All;
                }
            }
            group(Landmark)
            {
                field("Landmark Name"; Rec."Landmark Name")
                {
                    ApplicationArea = All;
                }
                field("Landmark State"; Rec."Landmark State")
                {
                    ApplicationArea = All;
                }
                field("Landmark Country"; Rec."Landmark Country")
                {
                    ApplicationArea = All;
                }
                field("Landmark Distance"; Rec."Landmark Distance")
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
                field("Departure Geofence"; Rec."Departure Geofence")
                {
                    ApplicationArea = All;
                }
            }
            group(Sync)
            {
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                }
                field("Matched By"; Rec."Matched By")
                {
                    ApplicationArea = All;
                }
                field("Sync Status"; Rec."Sync Status")
                {
                    ApplicationArea = All;
                }
                field("Last Synced At"; Rec."Last Synced At")
                {
                    ApplicationArea = All;
                }
                field("Last Error"; Rec."Last Error")
                {
                    ApplicationArea = All;
                    MultiLine = true;
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
                    if (Rec.Latitude = 0) and (Rec.Longitude = 0) then
                        Error('No coordinates are available for this SkyBitz tracker.');

                    Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Rec.Latitude), Format(Rec.Longitude)));
                end;
            }
        }
    }
}
