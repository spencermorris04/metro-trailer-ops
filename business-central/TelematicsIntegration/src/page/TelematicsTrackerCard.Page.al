page 50265 "Telematics Tracker Card"
{
    PageType = Card;
    SourceTable = "Telematics Tracker";
    ApplicationArea = All;
    Caption = 'Telematics Tracker';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(General)
            {
                field(Provider; Rec.Provider)
                {
                    ApplicationArea = All;
                }
                field("Provider Tracker ID"; Rec."Provider Tracker ID")
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
                field("Observation Date Time"; Rec."Observation Date Time")
                {
                    ApplicationArea = All;
                }
                field("Received Date Time"; Rec."Received Date Time")
                {
                    ApplicationArea = All;
                }
            }
            group(Location)
            {
                field(Latitude; Rec.Latitude)
                {
                    ApplicationArea = All;
                }
                field(Longitude; Rec.Longitude)
                {
                    ApplicationArea = All;
                }
                field(Address; Rec.Address)
                {
                    ApplicationArea = All;
                }
                field(City; Rec.City)
                {
                    ApplicationArea = All;
                }
                field(State; Rec.State)
                {
                    ApplicationArea = All;
                }
                field(Country; Rec.Country)
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
            }
            group(Status)
            {
                field("Asset Type"; Rec."Asset Type")
                {
                    ApplicationArea = All;
                }
                field("Product Type"; Rec."Product Type")
                {
                    ApplicationArea = All;
                }
                field(Groups; Rec.Groups)
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
                field("Power Source"; Rec."Power Source")
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
                        Error('No coordinates are available for this telematics tracker.');

                    Hyperlink(StrSubstNo('https://www.google.com/maps?q=%1,%2', Format(Rec.Latitude), Format(Rec.Longitude)));
                end;
            }
        }
    }
}
