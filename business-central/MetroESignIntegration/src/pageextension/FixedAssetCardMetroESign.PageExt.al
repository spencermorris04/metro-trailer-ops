pageextension 50370 "MTE ESign Fixed Asset Ext" extends "Fixed Asset Card"
{
    layout
    {
        addlast(FactBoxes)
        {
            part(MetroESign; "MTE ESign Asset FB")
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
            action(CreateMetroESignLease)
            {
                Caption = 'Create E-Sign Lease';
                ApplicationArea = All;
                Image = CreateDocument;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Api: Codeunit "MTE ESign API";
                    Lease: Record "MTE ESign Lease";
                    LeaseId: Guid;
                begin
                    LeaseId := Api.CreateLeaseForAsset(Rec."No.");
                    Lease.Get(LeaseId);
                    Page.Run(Page::"MTE ESign Lease Card", Lease);
                end;
            }
            action(ViewMetroESignLeases)
            {
                Caption = 'Metro E-Sign Leases';
                ApplicationArea = All;
                Image = List;
                Promoted = true;
                PromotedCategory = Process;

                trigger OnAction()
                var
                    Lease: Record "MTE ESign Lease";
                begin
                    Lease.SetRange("Fixed Asset No.", Rec."No.");
                    Page.Run(Page::"MTE ESign Leases", Lease);
                end;
            }
        }
    }
}
