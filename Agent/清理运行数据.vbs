Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

agentRoot = fso.GetParentFolderName(WScript.ScriptFullName)
internalDir = agentRoot & "\" & ChrW(&H5185) & ChrW(&H90E8) & ChrW(&H811A) & ChrW(&H672C)
scriptPath = internalDir & "\cleanup-runtime.ps1"

shell.CurrentDirectory = agentRoot
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """", 0, False
