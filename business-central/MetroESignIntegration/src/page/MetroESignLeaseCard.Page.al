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
                field("Document No."; Rec."Document No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
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
                field("Customer Address"; Rec."Customer Address")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Customer City"; Rec."Customer City")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Customer ZIP Code"; Rec."Customer ZIP Code")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Customer State"; Rec."Customer State")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Customer Country/Region Code"; Rec."Customer Country/Region Code")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Phone Number"; Rec."Phone Number")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Payment Terms Code"; Rec."Payment Terms Code")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Ordered By"; Rec."Ordered By")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Order No."; Rec."Order No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("PO No."; Rec."PO No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Date Signed"; Rec."Date Signed")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound Inspection Date"; Rec."Inbound Inspection Date")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Location Code"; Rec."Location Code")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Responsibility Center"; Rec."Responsibility Center")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Unit No."; Rec."Unit No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Product No."; Rec."Product No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Tag No."; Rec."Tag No.")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(VIN; Rec.VIN)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Unit Description"; Rec."Unit Description")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Unit Value"; Rec."Unit Value")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Per Day Rate"; Rec."Per Day Rate")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Per Week Rate"; Rec."Per Week Rate")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Per Month Rate"; Rec."Per Month Rate")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Minimum Period"; Rec."Minimum Period")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(CPU; Rec.CPU)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(Del; Rec.Del)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(Pickup; Rec.Pickup)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(Year; Rec.Year)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(Make; Rec.Make)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Unit Status"; Rec."Unit Status")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inspection Type"; Rec."Inspection Type")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("In Amount"; Rec."In Amount")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Out Amount"; Rec."Out Amount")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Total Amount"; Rec."Total Amount")
                {
                    ApplicationArea = All;
                    Editable = false;
                }
                field("Treadwear Depth"; Rec."Treadwear Depth")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Treadwear Price"; Rec."Treadwear Price")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
            }
            group(Email)
            {
                field("Customer Email"; Rec."Customer Email")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
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
            group(Outbound)
            {
                field("Outbound Brakes"; Rec."Outbound Brakes")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Outbound Landing Gear"; Rec."Outbound Landing Gear")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Outbound Lights"; Rec."Outbound Lights")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Outbound Undercarriage"; Rec."Outbound Undercarriage")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Outbound Doors"; Rec."Outbound Doors")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Outbound Flaps"; Rec."Outbound Flaps")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Tire Condition"; Rec."Tire Condition")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field(FHWA; Rec.FHWA)
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("LFO Reading"; Rec."LFO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("LFI Reading"; Rec."LFI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("LRO Reading"; Rec."LRO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("LRI Reading"; Rec."LRI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("RFO Reading"; Rec."RFO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("RFI Reading"; Rec."RFI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("RRO Reading"; Rec."RRO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("RRI Reading"; Rec."RRI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Outbound Comments"; Rec."Outbound Comments")
                {
                    ApplicationArea = All;
                    MultiLine = true;
                    Editable = IsDraftEditable;
                }
                field("Special Instructions"; Rec."Special Instructions")
                {
                    ApplicationArea = All;
                    MultiLine = true;
                    Editable = IsDraftEditable;
                }
            }
            group(Inbound)
            {
                field("Inbound LFO Reading"; Rec."Inbound LFO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound LFI Reading"; Rec."Inbound LFI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound LRO Reading"; Rec."Inbound LRO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound LRI Reading"; Rec."Inbound LRI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound RFO Reading"; Rec."Inbound RFO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound RFI Reading"; Rec."Inbound RFI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound RRO Reading"; Rec."Inbound RRO Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inbound RRI Reading"; Rec."Inbound RRI Reading")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inspection In 1"; Rec."Inspection In 1")
                {
                    ApplicationArea = All;
                    Editable = IsDraftEditable;
                }
                field("Inspection In 2"; Rec."Inspection In 2")
                {
                    ApplicationArea = All;
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
                field("Preview URL"; Rec."Preview URL")
                {
                    ApplicationArea = All;
                    ExtendedDatatype = URL;
                }
                field("Editor URL"; Rec."Editor URL")
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
            part(Preview; "MTE ESign Preview Part")
            {
                ApplicationArea = All;
                SubPageLink = "Lease ID" = field("Lease ID");
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
            action(OpenESignEditor)
            {
                Caption = 'Open E-Sign Editor';
                ApplicationArea = All;
                Image = EditLines;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                begin
                    CurrPage.SaveRecord();
                    Api.OpenEditor(Rec);
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
            action(OpenESignAdmin)
            {
                Caption = 'Open E-Sign Admin';
                ApplicationArea = All;
                Image = LinkWeb;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                begin
                    Hyperlink('https://esign.lumpkindevelopment.com');
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
