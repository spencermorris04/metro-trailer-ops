page 50224 "Trailer Document Card"
{
    PageType = Card;
    SourceTable = "Trailer Document";
    ApplicationArea = All;
    Caption = 'Trailer Document';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("Document Type"; Rec."Document Type")
                {
                    ApplicationArea = All;
                }
                field("File Name"; Rec."File Name")
                {
                    ApplicationArea = All;
                }
                field("File Extension"; Rec."File Extension")
                {
                    ApplicationArea = All;
                }
                field("Last Modified At"; Rec."Last Modified At")
                {
                    ApplicationArea = All;
                }
                field("Created At"; Rec."Created At")
                {
                    ApplicationArea = All;
                }
                field("File Size"; Rec."File Size")
                {
                    ApplicationArea = All;
                }
            }

            group(FixedAsset)
            {
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                }
                field("Folder Name"; Rec."Folder Name")
                {
                    ApplicationArea = All;
                }
                field("Match Status"; Rec."Match Status")
                {
                    ApplicationArea = All;
                }
                field("Matched By"; Rec."Matched By")
                {
                    ApplicationArea = All;
                }
            }

            group(Links)
            {
                field("Web URL"; Rec."Web URL")
                {
                    ApplicationArea = All;
                }
                field("Folder URL"; Rec."Folder URL")
                {
                    ApplicationArea = All;
                }
            }

            group(Sync)
            {
                field("Sync Status"; Rec."Sync Status")
                {
                    ApplicationArea = All;
                }
                field("Last Synced At"; Rec."Last Synced At")
                {
                    ApplicationArea = All;
                }
                field(Active; Rec.Active)
                {
                    ApplicationArea = All;
                }
                field("Removed At"; Rec."Removed At")
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
            action(OpenDocument)
            {
                Caption = 'Open Document';
                ApplicationArea = All;
                Image = ViewDetails;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    if Rec."Web URL" = '' then
                        Error('No document URL is available for this record.');

                    Hyperlink(Rec."Web URL");
                end;
            }
            action(OpenFolder)
            {
                Caption = 'Open SharePoint Folder';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    if Rec."Folder URL" = '' then
                        Error('No SharePoint folder URL is available for this record.');

                    Hyperlink(Rec."Folder URL");
                end;
            }
        }
    }
}
