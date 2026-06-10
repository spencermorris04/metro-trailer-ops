controladdin "MTE ESign Web Viewer"
{
    Scripts = 'src/controladdin/MetroESignWebViewer.js';
    StartupScript = 'src/controladdin/MetroESignWebViewerStartup.js';
    HorizontalStretch = true;
    VerticalStretch = true;
    RequestedHeight = 720;
    MinimumHeight = 420;

    event ControlAddInReady()

    procedure Navigate(Url: Text)

    procedure SetContent(Html: Text)
}
