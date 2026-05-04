codeunit 50232 "Trailer Document Sync Request"
{
    Permissions = tabledata "Trailer Doc Sync API Setup" = r;

    procedure RequestOnDemandSync(FixedAssetNo: Code[20])
    var
        Setup: Record "Trailer Doc Sync API Setup";
    begin
        if not Setup.Get('DEFAULT') then
            Error('Trailer Document Sync API Setup has not been configured.');

        PostSyncRequest(Setup, FixedAssetNo);
    end;

    local procedure PostSyncRequest(Setup: Record "Trailer Doc Sync API Setup"; FixedAssetNo: Code[20])
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
            Error('Trailer Document Sync API Base URL has not been configured.');
        if Setup."API Key" = '' then
            Error('Trailer Document Sync API Key has not been configured.');

        Url := TrimTrailingSlash(Setup."API Base URL") + '/sync/trailer-documents';
        Body := StrSubstNo('{"fixedAssetNo":"%1","requestedBy":"bc","mode":"ondemand"}', EscapeJson(FixedAssetNo));

        Content.WriteFrom(Body);
        Content.GetHeaders(ContentHeaders);
        ContentHeaders.Clear();
        ContentHeaders.Add('Content-Type', 'application/json');

        Client.DefaultRequestHeaders().Add('X-Metro-Sync-Key', Setup."API Key");

        if not Client.Post(Url, Content, Response) then
            Error('Business Central could not call the Trailer Document sync API.');

        if not Response.IsSuccessStatusCode() then begin
            Response.Content().ReadAs(ResponseText);
            Error('Trailer Document sync API returned %1 %2. %3', Response.HttpStatusCode(), Response.ReasonPhrase(), ResponseText);
        end;
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
