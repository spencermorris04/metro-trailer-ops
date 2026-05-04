page 50225 "Trailer Doc Summary FB"
{
    PageType = CardPart;
    SourceTable = "Trailer Document";
    SourceTableView = where(Active = const(true));
    ApplicationArea = All;
    Caption = 'Trailer Documents';
    Editable = false;

    layout
    {
        area(Content)
        {
            group(Summary)
            {
                ShowCaption = false;

                field(OpenRegistrationTxt; OpenRegistrationTxt)
                {
                    ApplicationArea = All;
                    Caption = 'Registration';

                    trigger OnDrillDown()
                    begin
                        OpenLatestDocumentByType(Rec."Document Type"::Registration, 'No registration PDF was found for this fixed asset.');
                    end;
                }
                field(RegistrationModifiedAt; RegistrationModifiedAt)
                {
                    ApplicationArea = All;
                    Caption = 'Registration Updated';
                }
                field(OpenFhwaTxt; OpenFhwaTxt)
                {
                    ApplicationArea = All;
                    Caption = 'FHWA';

                    trigger OnDrillDown()
                    begin
                        OpenLatestDocumentByType(Rec."Document Type"::"FHWA Inspection", 'No FHWA inspection PDF was found for this fixed asset.');
                    end;
                }
                field(FhwaModifiedAt; FhwaModifiedAt)
                {
                    ApplicationArea = All;
                    Caption = 'FHWA Updated';
                }
                field(SyncStatusTxt; SyncStatusTxt)
                {
                    ApplicationArea = All;
                    Caption = 'Sync';
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(OpenLatestRegistration)
            {
                Caption = 'Open Registration PDF';
                ApplicationArea = All;
                Image = Print;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    if not FindLatestByType(Document, Document."Document Type"::Registration) then
                        Error('No registration PDF was found for this fixed asset.');

                    Hyperlink(Document."Web URL");
                end;
            }
            action(OpenLatestFhwa)
            {
                Caption = 'Open Latest FHWA Inspection';
                ApplicationArea = All;
                Image = Print;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    if not FindLatestByType(Document, Document."Document Type"::"FHWA Inspection") then
                        Error('No FHWA inspection PDF was found for this fixed asset.');

                    Hyperlink(Document."Web URL");
                end;
            }
            action(OpenFolder)
            {
                Caption = 'Open SharePoint Folder';
                ApplicationArea = All;
                Image = LinkWeb;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    if not FindAnyActiveDocument(Document) then
                        Error('No trailer documents were found for this fixed asset.');

                    if Document."Folder URL" = '' then
                        Error('No SharePoint folder URL is available for this fixed asset.');

                    Hyperlink(Document."Folder URL");
                end;
            }
        }
    }

    trigger OnOpenPage()
    begin
        Rec.SetCurrentKey("Fixed Asset No.", "Last Modified At");
        Rec.Ascending(false);
        RefreshSummary();
    end;

    trigger OnAfterGetCurrRecord()
    begin
        RefreshSummary();
    end;

    local procedure RefreshSummary()
    var
        Document: Record "Trailer Document";
    begin
        Clear(OpenRegistrationTxt);
        Clear(RegistrationModifiedAt);
        Clear(OpenFhwaTxt);
        Clear(FhwaModifiedAt);
        Clear(SyncStatusTxt);

        if FindLatestByType(Document, Document."Document Type"::Registration) then begin
            OpenRegistrationTxt := 'Open';
            RegistrationModifiedAt := Document."Last Modified At";
        end else
            OpenRegistrationTxt := '';

        if FindLatestByType(Document, Document."Document Type"::"FHWA Inspection") then begin
            OpenFhwaTxt := 'Open';
            FhwaModifiedAt := Document."Last Modified At";
        end else
            OpenFhwaTxt := '';

        if FindAnyActiveDocument(Document) then
            SyncStatusTxt := Format(Document."Sync Status")
        else
            SyncStatusTxt := '';
    end;

    local procedure OpenLatestDocumentByType(DocumentType: Enum "Trailer Document Type"; MissingMessage: Text)
    var
        Document: Record "Trailer Document";
    begin
        if not FindLatestByType(Document, DocumentType) then
            Error(MissingMessage);

        Hyperlink(Document."Web URL");
    end;

    local procedure FindLatestByType(var Document: Record "Trailer Document"; DocumentType: Enum "Trailer Document Type"): Boolean
    begin
        Document.Reset();
        Document.CopyFilters(Rec);
        Document.SetRange(Active, true);
        Document.SetRange("Document Type", DocumentType);
        Document.SetFilter("Web URL", '<>%1', '');
        Document.SetCurrentKey("Fixed Asset No.", "Document Type", "Last Modified At");
        Document.Ascending(false);

        exit(Document.FindFirst());
    end;

    local procedure FindAnyActiveDocument(var Document: Record "Trailer Document"): Boolean
    begin
        Document.Reset();
        Document.CopyFilters(Rec);
        Document.SetRange(Active, true);
        Document.SetCurrentKey("Fixed Asset No.", "Last Modified At");
        Document.Ascending(false);

        exit(Document.FindFirst());
    end;

    var
        OpenRegistrationTxt: Text[10];
        RegistrationModifiedAt: DateTime;
        OpenFhwaTxt: Text[10];
        FhwaModifiedAt: DateTime;
        SyncStatusTxt: Text[50];
}
