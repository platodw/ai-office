; AI Office — Inno Setup script
;
; Builds a per-user Windows installer that:
;   - drops native_host.exe to %LOCALAPPDATA%\Programs\AI Office\
;   - asks the user for their Chrome extension ID
;   - writes the Native Messaging manifest JSON with that ID
;   - registers the host under HKCU\Software\Google\Chrome\NativeMessagingHosts
;
; Compile with: ISCC.exe installer\aioffice.iss
; Or run installer\build.py which handles both stages.

#define MyAppName "AI Office"
#define MyAppVersion "0.3.0"
#define MyAppPublisher "Dan Plato Consulting"
#define MyAppURL "https://github.com/platodw/ai-office"
#define HostName "com.aioffice.companion"

[Setup]
AppId={{F1B6A4E2-5E4C-4F0F-8C2A-1A9F2D6B3C4D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={userpf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
; Stable filename so the "latest release" download URL doesn't change per version.
OutputBaseFilename=aioffice-setup
VersionInfoVersion={#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "dist\native_host.exe"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
; Tell Chrome where to find our Native Messaging manifest. The manifest itself
; is written by code below since it depends on the user-supplied extension ID.
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#HostName}"; \
    ValueType: string; ValueName: ""; ValueData: "{app}\{#HostName}.json"; \
    Flags: uninsdeletekey

[UninstallDelete]
Type: files; Name: "{app}\{#HostName}.json"

[Code]
var
  ExtensionIdPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ExtensionIdPage := CreateInputQueryPage(wpSelectDir,
    'Connect to your Chrome extension',
    'AI Office talks to a Chrome extension on your machine.',
    'Open chrome://extensions in Chrome (Developer mode on) and copy the ID' + #13#10 +
    'shown under the AI Office extension. It looks like a long string of letters,' + #13#10 +
    'for example: jfnbjcmjojakidfhapjfpmkmhhjbbmdh');
  ExtensionIdPage.Add('Extension ID:', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Id: String;
  i: Integer;
  C: Char;
begin
  Result := True;
  if CurPageID = ExtensionIdPage.ID then begin
    Id := Trim(ExtensionIdPage.Values[0]);
    if Length(Id) <> 32 then begin
      MsgBox('Chrome extension IDs are 32 characters long. Please double-check the ID.',
             mbError, MB_OK);
      Result := False;
      exit;
    end;
    for i := 1 to Length(Id) do begin
      C := Id[i];
      if not ((C >= 'a') and (C <= 'p')) then begin
        MsgBox('Extension IDs only contain letters a-p. Please double-check the ID.',
               mbError, MB_OK);
        Result := False;
        exit;
      end;
    end;
  end;
end;

function EscapeJsonPath(Path: String): String;
begin
  Result := Path;
  StringChangeEx(Result, '\', '\\', True);
end;

procedure WriteManifest;
var
  ExtensionId: String;
  HostPath: String;
  ManifestPath: String;
  ManifestJson: AnsiString;
begin
  ExtensionId := Trim(ExtensionIdPage.Values[0]);
  HostPath := ExpandConstant('{app}\native_host.exe');
  ManifestPath := ExpandConstant('{app}\{#HostName}.json');

  ManifestJson :=
    '{' + #13#10 +
    '  "name": "{#HostName}",' + #13#10 +
    '  "description": "AI Office companion for Claude Desktop",' + #13#10 +
    '  "path": "' + EscapeJsonPath(HostPath) + '",' + #13#10 +
    '  "type": "stdio",' + #13#10 +
    '  "allowed_origins": ["chrome-extension://' + ExtensionId + '/"]' + #13#10 +
    '}' + #13#10;

  if not SaveStringToFile(ManifestPath, ManifestJson, False) then
    RaiseException('Could not write manifest to ' + ManifestPath);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    WriteManifest;
end;

[Run]
Filename: "https://chrome.google.com/webstore"; Description: "Open Chrome Web Store"; \
    Flags: postinstall shellexec skipifsilent unchecked
