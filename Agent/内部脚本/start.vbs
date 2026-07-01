Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
agentRoot = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = agentRoot
pythonw = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python312\pythonw.exe"
If Not fso.FileExists(pythonw) Then
  pythonw = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\pythonw.exe"
End If
If fso.FileExists(pythonw) Then
  shell.Run """" & pythonw & """ """ & agentRoot & "\start_windows_silent.py""", 0, False
Else
  shell.Run "pyw.exe -3.12 """ & agentRoot & "\start_windows_silent.py""", 0, False
End If
