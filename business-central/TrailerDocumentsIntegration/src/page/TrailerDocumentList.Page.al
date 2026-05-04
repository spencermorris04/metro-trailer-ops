page 50223 "Trailer Document List"
{
    PageType = List;
    SourceTable = "Trailer Document";
    SourceTableView = where(Active = const(true));
    ApplicationArea = All;
    UsageCategory = Lists;
    Caption = 'Trailer Documents';
    Editable = false;
    CardPageId = "Trailer Document Card";

    layout
    {
        area(Content)
        {
            repeater(Documents)
            {
                field("Last Modified At"; Rec."Last Modified At")
                {
                    ApplicationArea = All;
                    Caption = 'Modified';
                }
                field("Document Type"; Rec."Document Type")
                {
                    ApplicationArea = All;
                }
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                }
                field("Folder Name"; Rec."Folder Name")
                {
                    ApplicationArea = All;
                }
                field("File Name"; Rec."File Name")
                {
                    ApplicationArea = All;
                }
                field(OpenLinkText; OpenLinkText)
                {
                    ApplicationArea = All;
                    Caption = 'Open';

                    trigger OnDrillDown()
                    begin
                        OpenCurrentDocument();
                    end;
                }
                field(FolderLinkText; FolderLinkText)
                {
                    ApplicationArea = All;
                    Caption = 'Folder';

                    trigger OnDrillDown()
                    begin
                        OpenCurrentFolder();
                    end;
                }
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
                    OpenCurrentDocument();
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
                    OpenCurrentFolder();
                end;
            }
        }
    }

    trigger OnAfterGetRecord()
    begin
        SetLinkTexts();
    end;

    local procedure OpenCurrentDocument()
    begin
        if Rec."Web URL" = '' then
            Error('No document URL is available for this record.');

        Hyperlink(Rec."Web URL");
    end;

    local procedure OpenCurrentFolder()
    begin
        if Rec."Folder URL" = '' then
            Error('No SharePoint folder URL is available for this record.');

        Hyperlink(Rec."Folder URL");
    end;

    local procedure SetLinkTexts()
    begin
        if Rec."Web URL" <> '' then
            OpenLinkText := 'Open'
        else
            OpenLinkText := '';

        if Rec."Folder URL" <> '' then
            FolderLinkText := 'Open'
        else
            FolderLinkText := '';
    end;

    var
        OpenLinkText: Text[10];
        FolderLinkText: Text[10];
}
