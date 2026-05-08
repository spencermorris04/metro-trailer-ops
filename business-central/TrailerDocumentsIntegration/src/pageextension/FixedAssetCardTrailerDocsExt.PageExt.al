pageextension 50230 "Fixed Asset Card Trailer Docs" extends "Fixed Asset Card"
{
    layout
    {
        addlast(FactBoxes)
        {
            part(TrailerDocumentSummary; "Trailer Doc Summary FB")
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
            action(ViewTrailerDocuments)
            {
                Caption = 'Trailer Documents';
                ApplicationArea = All;
                Image = List;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    Document.SetRange("Fixed Asset No.", Rec."No.");
                    Document.SetRange(Active, true);
                    Page.Run(Page::"Trailer Document List", Document);
                end;
            }
            action(OpenRegistrationPdf)
            {
                Caption = 'Open Registration PDF';
                ApplicationArea = All;
                Image = Print;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    if not FindLatestByType(Document, Document."Document Type"::Registration) then
                        Error('No registration PDF was found for fixed asset %1.', Rec."No.");

                    Hyperlink(Document."Web URL");
                end;
            }
            action(OpenLatestFhwaInspection)
            {
                Caption = 'Open Latest FHWA Inspection';
                ApplicationArea = All;
                Image = Print;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    if not FindLatestByType(Document, Document."Document Type"::"FHWA Inspection") then
                        Error('No FHWA inspection PDF was found for fixed asset %1.', Rec."No.");

                    Hyperlink(Document."Web URL");
                end;
            }
            action(OpenSharePointFolder)
            {
                Caption = 'Open SharePoint Folder';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Document: Record "Trailer Document";
                begin
                    if not FindAnyActiveDocument(Document) then
                        Error('No trailer documents were found for fixed asset %1.', Rec."No.");

                    if Document."Folder URL" = '' then
                        Error('No SharePoint folder URL was found for fixed asset %1.', Rec."No.");

                    Hyperlink(Document."Folder URL");
                end;
            }
        }
    }

    local procedure FindLatestByType(var Document: Record "Trailer Document"; DocumentType: Enum "Trailer Document Type"): Boolean
    begin
        Document.Reset();
        Document.SetRange("Fixed Asset No.", Rec."No.");
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
        Document.SetRange("Fixed Asset No.", Rec."No.");
        Document.SetRange(Active, true);
        Document.SetCurrentKey("Fixed Asset No.", "Last Modified At");
        Document.Ascending(false);

        exit(Document.FindFirst());
    end;
}
