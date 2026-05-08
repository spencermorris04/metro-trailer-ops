codeunit 50132 "Record360 Sync Request"
{
    Permissions = tabledata "Record360 Sync API Setup" = r;

    procedure RequestOnDemandSync(FixedAssetNo: Code[20])
    var
        Setup: Record "Record360 Sync API Setup";
    begin
        if not Setup.Get('DEFAULT') then
            Error('Record360 Sync API Setup has not been configured.');

        PostSyncRequest(Setup, FixedAssetNo);
    end;

    procedure GetFreshPdfShareUrl(Record360InspectionId: Text[50]; FallbackPdfShareUrl: Text): Text
    var
        Setup: Record "Record360 Sync API Setup";
    begin
        if Record360InspectionId = '' then
            exit(FallbackPdfShareUrl);

        if not Setup.Get('DEFAULT') then
            exit(FallbackPdfShareUrl);

        if (Setup."API Base URL" = '') or (Setup."API Key" = '') then
            exit(FallbackPdfShareUrl);

        exit(GetFreshPdfShareUrlFromApi(Setup, Record360InspectionId, FallbackPdfShareUrl));
    end;

    local procedure PostSyncRequest(Setup: Record "Record360 Sync API Setup"; FixedAssetNo: Code[20])
    var
        Client: HttpClient;
        Content: HttpContent;
        ContentHeaders: HttpHeaders;
        Response: HttpResponseMessage;
        ResponseText: Text;
        Body: Text;
        Url: Text;
    begin
        if Setup."API Base URL" = '' then
            Error('Record360 Sync API Base URL has not been configured.');
        if Setup."API Key" = '' then
            Error('Record360 Sync API Key has not been configured.');

        Url := TrimTrailingSlash(Setup."API Base URL") + '/sync/record360';
        Body := StrSubstNo('{"fixedAssetNo":"%1","requestedBy":"bc","mode":"ondemand"}', EscapeJson(FixedAssetNo));

        Content.WriteFrom(Body);
        Content.GetHeaders(ContentHeaders);
        ContentHeaders.Clear();
        ContentHeaders.Add('Content-Type', 'application/json');

        Client.DefaultRequestHeaders().Add('X-Metro-Sync-Key', Setup."API Key");

        if not Client.Post(Url, Content, Response) then
            Error('Business Central could not call the Record360 sync API.');

        if not Response.IsSuccessStatusCode() then begin
            Response.Content().ReadAs(ResponseText);
            Error('Record360 sync API returned %1 %2. %3', Response.HttpStatusCode(), Response.ReasonPhrase(), ResponseText);
        end;
    end;

    local procedure GetFreshPdfShareUrlFromApi(Setup: Record "Record360 Sync API Setup"; Record360InspectionId: Text[50]; FallbackPdfShareUrl: Text): Text
    var
        Client: HttpClient;
        Response: HttpResponseMessage;
        ResponseText: Text;
        Url: Text;
        Json: JsonObject;
        Token: JsonToken;
    begin
        Url := TrimTrailingSlash(Setup."API Base URL") + '/record360/pdf-url/' + Record360InspectionId;
        Client.DefaultRequestHeaders().Add('X-Metro-Sync-Key', Setup."API Key");

        if not Client.Get(Url, Response) then
            Error('Business Central could not call the Record360 PDF URL API.');

        Response.Content().ReadAs(ResponseText);
        if not Response.IsSuccessStatusCode() then
            Error('Record360 PDF URL API returned %1 %2. %3', Response.HttpStatusCode(), Response.ReasonPhrase(), ResponseText);

        if not Json.ReadFrom(ResponseText) then
            Error('Record360 PDF URL API returned invalid JSON.');

        if Json.Get('pdfShareUrl', Token) then
            exit(Token.AsValue().AsText());

        exit(FallbackPdfShareUrl);
    end;

    local procedure TrimTrailingSlash(Value: Text): Text
    begin
        while CopyStr(Value, StrLen(Value), 1) = '/' do
            Value := CopyStr(Value, 1, StrLen(Value) - 1);

        exit(Value);
    end;

    local procedure EscapeJson(Value: Text): Text
    begin
        exit(Value.Replace('\', '\\').Replace('"', '\"'));
    end;
}
