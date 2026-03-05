param([string[]]$Buckets)

foreach ($bucket in $Buckets) {
    Write-Host "Emptying bucket $bucket"

    # Suspends versioning
    # aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Suspended
    
    $versions = aws s3api list-object-versions --bucket $bucket --query "{Objects: Versions[].{Key:Key,VersionId:VersionId}}" --output json | ConvertFrom-Json
    if ($versions -ne $null -and $versions.Objects -ne $null) {
        $chunk = @{ Objects = @() }
        foreach ($obj in $versions.Objects) {
            $chunk.Objects += @{ Key = $obj.Key; VersionId = $obj.VersionId }
            if ($chunk.Objects.Count -ge 1000) {
                $payload = $chunk | ConvertTo-Json -Depth 10
                $payload | Set-Content -Path "del-payload.json"
                aws s3api delete-objects --bucket $bucket --delete file://del-payload.json > $null
                $chunk.Objects = @()
            }
        }
        if ($chunk.Objects.Count -gt 0) {
            $payload = $chunk | ConvertTo-Json -Depth 10
            $payload | Set-Content -Path "del-payload.json"
            aws s3api delete-objects --bucket $bucket --delete file://del-payload.json > $null
        }
    }

    $markers = aws s3api list-object-versions --bucket $bucket --query "{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}" --output json | ConvertFrom-Json
    if ($markers -ne $null -and $markers.Objects -ne $null) {
        $chunk = @{ Objects = @() }
        foreach ($obj in $markers.Objects) {
            $chunk.Objects += @{ Key = $obj.Key; VersionId = $obj.VersionId }
            if ($chunk.Objects.Count -ge 1000) {
                $payload = $chunk | ConvertTo-Json -Depth 10
                $payload | Set-Content -Path "del-payload.json"
                aws s3api delete-objects --bucket $bucket --delete file://del-payload.json > $null
                $chunk.Objects = @()
            }
        }
        if ($chunk.Objects.Count -gt 0) {
            $payload = $chunk | ConvertTo-Json -Depth 10
            $payload | Set-Content -Path "del-payload.json"
            aws s3api delete-objects --bucket $bucket --delete file://del-payload.json > $null
        }
    }

    aws s3 rb s3://$bucket --force
}
