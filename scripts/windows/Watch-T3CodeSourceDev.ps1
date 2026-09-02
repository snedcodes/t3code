<#[
Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Watch-T3CodeSourceDev.ps1 [-WhatIf]
Checks localhost ports 3774 and 5733. It starts the existing "T3 Code Source Dev"
 scheduled task when either port is missing; a running task gets a 90-second
 startup grace from LastRunTime before it is stopped and restarted.
#>
[CmdletBinding()]
param(
    [switch]$WhatIf
)

$taskName = "T3 Code Source Dev"
$ports = @(3774, 5733)
$listeningPorts = @(
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in $ports } |
        Select-Object -ExpandProperty LocalPort -Unique
)

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
    Write-Error "Scheduled task '$taskName' was not found; no action taken."
    exit 1
}

$taskRunning = $task.State -eq "Running"
$portsReady = @($ports | Where-Object { $_ -in $listeningPorts })

if ($portsReady.Count -eq $ports.Count) {
    $portSummary = if ($listeningPorts.Count -gt 0) { $listeningPorts -join ", " } else { "none" }
    Write-Output "No action: listening ports [$portSummary]; scheduled task state [$($task.State)]."
    exit 0
}

$taskInfo = if ($taskRunning) { Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop } else { $null }
$lastRunTime = if ($null -ne $taskInfo) { $taskInfo.LastRunTime } else { $null }
$graceUntil = if ($null -ne $lastRunTime -and $lastRunTime -gt [datetime]::MinValue.AddSeconds(1)) { $lastRunTime.AddSeconds(90) } else { $null }
$withinStartupGrace = $taskRunning -and $null -ne $graceUntil -and (Get-Date) -lt $graceUntil

if ($WhatIf) {
    if (-not $taskRunning) {
        Write-Output "WhatIf: would start scheduled task '$taskName' (missing ports: $($ports -join ', '); task is not running)."
    } elseif ($withinStartupGrace) {
        Write-Output "WhatIf: would wait during startup grace for '$taskName' until $graceUntil (missing ports: $($ports -join ', '))."
    } else {
        Write-Output "WhatIf: would stop and restart scheduled task '$taskName' (startup grace elapsed at $graceUntil; missing ports: $($ports -join ', '))."
    }
    exit 0
}

if ($taskRunning -and $withinStartupGrace) {
    Write-Output "No action: '$taskName' is within startup grace until $graceUntil; missing ports: $($ports -join ', ')."
    exit 0
}

if ($taskRunning) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $action = "Restarted"
} else {
    $action = "Started"
}
Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
Write-Output "$action scheduled task '$taskName' (at least one required port was missing)."
