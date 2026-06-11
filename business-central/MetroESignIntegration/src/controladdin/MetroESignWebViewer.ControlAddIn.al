controladdin "MTE ESign Web Viewer"
{
    Scripts = 'src/controladdin/MetroESignWebViewer.js';
    StartupScript = 'src/controladdin/MetroESignWebViewerStartup.js';
    HorizontalStretch = true;
    VerticalStretch = true;
    RequestedHeight = 1100;
    MinimumHeight = 720;

    event ControlAddInReady()
    event EditorStateChanged(Payload: Text)

    procedure Navigate(Url: Text)

    procedure SetContent(Html: Text)
}
