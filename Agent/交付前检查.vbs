Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

agentRoot = fso.GetParentFolderName(WScript.ScriptFullName)
testDir = agentRoot & "\" & ChrW(&H6D4B) & ChrW(&H8BD5)
scriptPath = testDir & "\preflight_delivery_check.ps1"
logPath = shell.ExpandEnvironmentStrings("%TEMP%") & "\watersupply-preflight-delivery.log"

shell.CurrentDirectory = agentRoot
command = "cmd.exe /c powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """ > """ & logPath & """ 2>&1"
exitCode = shell.Run(command, 0, True)
If exitCode = 0 Then
  shell.Popup "Preflight check passed. Details are in runtime test-results.", 0, "Watersupply Assessment", 64
Else
  shell.Popup "Preflight check failed. Please check:" & vbCrLf & logPath, 0, "Watersupply Assessment", 16
End If
