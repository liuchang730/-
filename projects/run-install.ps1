$nodeDir = "c:\Users\lqw_w\.trae-cn\sdks\workspaces\36585377\versions\node\current"
$env:PATH = "$nodeDir;" + $env:PATH
$projectDir = "c:\Users\lqw_w\Downloads\project_20260712_205208\projects"
Set-Location $projectDir

"=== Starting install at $(Get-Date) ===" | Out-File "$projectDir\install-result.log"

# Clean
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
"Cleaned old node_modules" | Out-File "$projectDir\install-result.log" -Append

# Run pnpm install with full path to node
$startTime = Get-Date
$pnpmProcess = Start-Process -FilePath "$nodeDir\node.exe" -ArgumentList "$nodeDir\bin\pnpm.cjs", "install" -WorkingDirectory $projectDir -RedirectStandardOutput "$projectDir\install-stdout.log" -RedirectStandardError "$projectDir\install-stderr.log" -PassThru -NoNewWindow
$pnpmProcess.WaitForExit()
$endTime = Get-Date

"Install finished. Exit code: $($pnpmProcess.ExitCode)" | Out-File "$projectDir\install-result.log" -Append
"Duration: $($endTime - $startTime)" | Out-File "$projectDir\install-result.log" -Append

# Check result
if (Test-Path "node_modules\next") { "OK: next found" | Out-File "$projectDir\install-result.log" -Append }
else { "WARN: next not found" | Out-File "$projectDir\install-result.log" -Append }

$count = (Get-ChildItem "node_modules" -Directory -ErrorAction SilentlyContinue | Measure-Object).Count
"Packages: $count" | Out-File "$projectDir\install-result.log" -Append
