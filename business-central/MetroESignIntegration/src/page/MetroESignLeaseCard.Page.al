page 50374 "MTE ESign Lease Card"
{
    PageType = Card;
    SourceTable = "MTE ESign Lease";
    ApplicationArea = All;
    UsageCategory = Documents;
    Caption = 'Metro E-Sign Lease';

    layout
    {
        area(Content)
        {
            group(General)
            {
                field(Status; Rec.Status)
                {
                    ApplicationArea = All;
                    Editable = false;
                }
                field("Template Code"; Rec."Template Code")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;

                    trigger OnValidate()
                    var
                        Api: Codeunit "MTE ESign API";
                    begin
                        CurrPage.SaveRecord();
                        Api.PopulateLeaseFields(Rec);
                        CurrPage.Update(false);
                    end;
                }
                field("Template Name"; Rec."Template Name")
                {
                    ApplicationArea = All;
                }
                field("Rental Order No."; Rec."Rental Order No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(Location; Rec.Location)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
            }
            group(Customer)
            {
                field("Customer No."; Rec."Customer No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Customer Name"; Rec."Customer Name")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Customer Email"; Rec."Customer Email")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
            }
            group("Unit/Trailer")
            {
                field("Fixed Asset No."; Rec."Fixed Asset No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Unit Description"; Rec."Unit Description")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
            }
            group(Email)
            {
                field(Subject; Rec.Subject)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(Message; Rec.Message)
                {
                    ApplicationArea = All;
                    MultiLine = true;
                    Editable = IsDraftEditable;
                }
            }
            group("E-Sign")
            {
                field("DocuSeal Draft ID"; Rec."DocuSeal Draft ID")
                {
                    ApplicationArea = All;
                }
                field("DocuSeal Submission ID"; Rec."DocuSeal Submission ID")
                {
                    ApplicationArea = All;
                }
                field("Signing URL"; Rec."Signing URL")
                {
                    ApplicationArea = All;
                    ExtendedDatatype = URL;
                }
                field("Last Error"; Rec."Last Error")
                {
                    ApplicationArea = All;
                    MultiLine = true;
                }
                field("Sent At"; Rec."Sent At")
                {
                    ApplicationArea = All;
                }
                field("Voided At"; Rec."Voided At")
                {
                    ApplicationArea = All;
                }
            }
            part(Fields; "MTE ESign Field Part")
            {
                ApplicationArea = All;
                SubPageLink = "Lease ID" = field("Lease ID");
                Editable = IsDraftEditable;
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(SendESignDocument)
            {
                Caption = 'Send E-Sign Document';
                ApplicationArea = All;
                Image = SendTo;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    CurrPage.SaveRecord();
                    Api.SendLease(Rec);
                    CurrPage.Update(false);
                end;
            }
            action(PreviewESignDocument)
            {
                Caption = 'Preview E-Sign Document';
                ApplicationArea = All;
                Image = View;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    CurrPage.SaveRecord();
                    Api.PreviewLease(Rec);
                    CurrPage.Update(false);
                end;
            }
            action(VoidSentDocument)
            {
                Caption = 'Void Sent Document';
                ApplicationArea = All;
                Image = Cancel;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    Api.InvalidateLease(Rec);
                    CurrPage.Update(false);
                end;
            }
            action(OpenSigningLink)
            {
                Caption = 'Open E-Sign Document';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    if Rec."Signing URL" = '' then
                        Error('No E-Sign document URL is available for this lease. Use Preview E-Sign Document first.');

                    Hyperlink(Rec."Signing URL");
                end;
            }
            action(RefreshPrefillFields)
            {
                Caption = 'Refresh Prefill Fields';
                ApplicationArea = All;
                Image = RefreshLines;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    CurrPage.SaveRecord();
                    Api.PopulateLeaseFields(Rec);
                    CurrPage.Update(false);
                end;
            }
            action(RefreshTemplates)
            {
                Caption = 'Refresh Templates';
                ApplicationArea = All;
                Image = Refresh;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    Api.RefreshTemplates();
                    CurrPage.SaveRecord();
                    Api.EnsureLeaseTemplate(Rec);
                    Api.PopulateLeaseFields(Rec);
                    CurrPage.Update(false);
                end;
            }
        }
    }

    trigger OnNewRecord(BelowxRec: Boolean)
    var
        Api: Codeunit "MTE ESign API";
    begin
        Api.EnsureLeaseTemplate(Rec);
    end;

    trigger OnAfterGetCurrRecord()
    begin
        IsDraftEditable := Rec.Status <> Rec.Status::Sent;
    end;

    var
        IsDraftEditable: Boolean;
}
