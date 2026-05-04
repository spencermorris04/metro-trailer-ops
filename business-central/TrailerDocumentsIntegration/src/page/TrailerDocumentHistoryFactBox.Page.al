page 50226 "Trailer Doc History FB"
{
    PageType = ListPart;
    SourceTable = "Trailer Document";
    SourceTableView = where(Active = const(true));
    ApplicationArea = All;
    Caption = 'Document History';
    Editable = false;

    layout
    {
        area(Content)
        {
            repeater(History)
            {
                field("Last Modified At"; Rec."Last Modified At")
                {
                    ApplicationArea = All;
                    Caption = 'Modified';
                }
                field("Document Type"; Rec."Document Type")
                {
                    ApplicationArea = All;
                    Caption = 'Type';
                }
                field("File Name"; Rec."File Name")
                {
                    ApplicationArea = All;
                    Caption = 'File';
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

                trigger OnAction()
                begin
                    OpenCurrentDocument();
                end;
            }
            action(OpenFolder)
            {
                Caption = 'Open Folder';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                begin
                    if Rec."Folder URL" = '' then
                        Error('No SharePoint folder URL is available for this record.');

                    Hyperlink(Rec."Folder URL");
                end;
            }
            action(ViewAll)
            {
                Caption = 'View All';
                ApplicationArea = All;
                Image = List;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    Document.Copy(Rec);
                    Page.Run(Page::"Trailer Document List", Document);
                end;
            }
        }
    }

    trigger OnOpenPage()
    begin
        Rec.SetCurrentKey("Fixed Asset No.", "Last Modified At");
        Rec.Ascending(false);
    end;

    trigger OnAfterGetRecord()
    begin
        if Rec."Web URL" <> '' then
            OpenLinkText := 'Open'
        else
            OpenLinkText := '';
    end;

    local procedure OpenCurrentDocument()
    begin
        if Rec."Web URL" = '' then
            Error('No document URL is available for this record.');

        Hyperlink(Rec."Web URL");
    end;

    var
        OpenLinkText: Text[10];
}
