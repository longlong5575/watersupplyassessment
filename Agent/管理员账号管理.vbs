Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
agentRoot = fso.GetParentFolderName(WScript.ScriptFullName)
internalDir = agentRoot & "\" & ChrW(&H5185) & ChrW(&H90E8) & ChrW(&H811A) & ChrW(&H672C)
shell.CurrentDirectory = agentRoot
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & internalDir & "\start-admin-account.ps1""", 0, False
