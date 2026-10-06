$sourceFiles = @(
    "install_autostart.bat",
    "uninstall_autostart.bat",
    "start_cheeni.bat",
    "start_cheeni.vbs",
    "README_SETUP.txt"
)

$destZip = "frontend\public\downloads\Cheeni-Desktop-Agent-Setup.zip"
$backendZip = "backend\public\downloads\Cheeni-Desktop-Agent-Setup.zip"

Write-Host "Creating $destZip..."
Compress-Archive -Path $sourceFiles -DestinationPath $destZip -Force

Write-Host "Copying to backend..."
Copy-Item $destZip $backendZip -Force
Copy-Item "install_autostart.bat" "frontend\public\downloads\install_autostart.bat" -Force

Write-Host "Done! File size: $((Get-Item $destZip).Length) bytes"
