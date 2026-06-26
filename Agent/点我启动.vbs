Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
agentRoot = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = agentRoot
shell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & agentRoot & "\start.ps1""", 0, False
