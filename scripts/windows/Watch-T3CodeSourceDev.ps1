[CmdletBinding()]
param(
    [switch]$WhatIf,
    [string]$TaskName = 'T3 Code Source Dev',
    [int]$BackendPort = 3774,
    [int]$WebPort = 5733,
    [int]$StartupGraceSeconds = 90
)
$ErrorActionPreference = 'Stop'

function Test-DevHealth {
    foreach ($port in @($BackendPort, $WebPort)) {
        try {
            $path = if ($port -eq $BackendPort) { '/.well-known/t3/environment' } else { '/' }
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port$path" -TimeoutSec 5
            if ($response.StatusCode -ne 200) { return $false }
        } catch { return $false }
    }
    return $true
}

$task = Get-ScheduledTask -TaskName $TaskName
if (Test-DevHealth) { Write-Output "Healthy: backend $BackendPort and web $WebPort respond."; exit 0 }
$info = Get-ScheduledTaskInfo -TaskName $TaskName
if ($task.State -eq 'Running' -and (Get-Date) -lt $info.LastRunTime.AddSeconds($StartupGraceSeconds)) {
    Write-Output 'No action: startup grace.'
    exit 0
}

# Match the existing task's complete action, never a process name or checkout
# substring. This also finds a Ready task's orphan root without a backend port.
$action = @($task.Actions)[0]
if ([IO.Path]::GetFileName($action.Execute) -ne 'cmd.exe' -or
    $action.Arguments -notmatch '--home-dir\s+"([^"]+)"') {
    throw 'Unsupported task action; cannot establish the exact profile owner.'
}
$profile = $Matches[1]
if (-not [IO.Path]::IsPathRooted($profile)) { throw 'Profile must be absolute.' }
$processes = @(Get-CimInstance Win32_Process)
$owners = @($processes | Where-Object {
    $_.ExecutablePath -eq $action.Execute -and $_.CommandLine -and
    $_.CommandLine.EndsWith($action.Arguments, [StringComparison]::OrdinalIgnoreCase)
})
if ($owners.Count -gt 1) { throw 'Multiple exact profile owners; refusing restart.' }
$listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
    $_.LocalPort -in @($BackendPort, $WebPort) -and $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::1', '::')
})
if ($owners.Count -eq 0) {
    # If Scheduler lost its cmd root, use a listener's ancestry to resolve the
    # surviving dev-runner with the task's exact explicit profile argument.
    $profileArgument = '--home-dir "' + $profile + '"'
    foreach ($listener in $listeners) {
        $ancestor = $processes | Where-Object ProcessId -eq $listener.OwningProcess
        while ($ancestor) {
            if ($ancestor.CommandLine -and
                $ancestor.CommandLine.Contains($profileArgument) -and
                $ancestor.CommandLine -match 'scripts[\\/]dev-runner\.ts[" ]+dev(?: |$)') {
                if ($ancestor.ProcessId -notin @($owners.ProcessId)) { $owners += $ancestor }
                break
            }
            $ancestor = $processes | Where-Object ProcessId -eq $ancestor.ParentProcessId
        }
    }
    if ($owners.Count -gt 1) { throw 'Multiple profile runner ancestors; refusing restart.' }
}
$tree = @($owners)
for ($index = 0; $index -lt $tree.Count; $index++) {
    $parent = $tree[$index]
    $tree += @($processes | Where-Object {
        $_.ParentProcessId -eq $parent.ProcessId -and $_.CreationDate -ge $parent.CreationDate
    })
}
# A listener outside the resolved tree must never be taken over.
foreach ($listener in $listeners) {
    if ($listener.OwningProcess -notin @($tree.ProcessId)) {
        throw "Port $($listener.LocalPort) belongs to an unresolved owner; refusing restart."
    }
}
if ($WhatIf) { Write-Output "WhatIf: clear exact owner tree ($($tree.Count) processes), restart '$TaskName', verify HTTP."; exit 0 }
# Snapshot descendants before Scheduler can discard the root. Recheck creation
# times before each stop so a reused PID cannot select an unrelated process.
if ($task.State -eq 'Running') { Stop-ScheduledTask -TaskName $TaskName }
for ($index = $tree.Count - 1; $index -ge 0; $index--) {
    $owned = $tree[$index]
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($owned.ProcessId)"
    if ($current -and $current.CreationDate -eq $owned.CreationDate) {
        Stop-Process -Id $owned.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Start-ScheduledTask -TaskName $TaskName
$deadline = (Get-Date).AddSeconds($StartupGraceSeconds)
do {
    if (Test-DevHealth) { Write-Output "Recovered: backend $BackendPort and web $WebPort respond; exact old tree cleared."; exit 0 }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
throw "Task '$TaskName' restarted but HTTP health did not recover within startup grace."
