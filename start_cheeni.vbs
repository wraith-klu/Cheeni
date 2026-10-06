' ============================================================
'  Cheeni Desktop Agent — Silent VBS Wrapper
'  Runs start_cheeni.bat with ZERO visible console windows
'  Place this in Windows Startup folder for auto-launch on boot
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
cheeniDir = fso.GetParentFolderName(WScript.ScriptFullName)

' If executed directly from Startup folder, fall back to the actual project root
If Not fso.FileExists(cheeniDir & "\start_cheeni.bat") Then
    cheeniDir = "c:\BTech\AI Based Projects\Cheeni"
End If

WshShell.Run """" & cheeniDir & "\start_cheeni.bat""", 0, False

Set fso = Nothing
Set WshShell = Nothing
